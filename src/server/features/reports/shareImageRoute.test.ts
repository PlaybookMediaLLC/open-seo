import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleReportSocialImage } from "@/routes/s/$token/og[.]png";

const mocks = vi.hoisted(() => ({
  sharesEnabled: vi.fn(),
  getSharedReportByToken: vi.fn(),
  renderReportSocialImage: vi.fn(),
  forShare: vi.fn(),
}));

vi.mock("@/server/features/reports/shareAccess", () => ({
  sharesEnabled: mocks.sharesEnabled,
  SHARE_TOKEN_PATTERN: /^[A-Za-z0-9_-]{32}$/,
}));
vi.mock("@/server/features/reports/repositories/ReportRepository", () => ({
  ReportRepository: { getSharedReportByToken: mocks.getSharedReportByToken },
}));
vi.mock("@/server/features/reports/reportSocialImage", () => ({
  renderReportSocialImage: mocks.renderReportSocialImage,
}));
vi.mock("@/server/features/reports/services/ReportBrandingService", () => ({
  ReportBrandingService: { forShare: mocks.forShare },
}));

const TOKEN = "a".repeat(32);

beforeEach(() => {
  mocks.sharesEnabled.mockResolvedValue(true);
  mocks.getSharedReportByToken.mockResolvedValue({
    title: "Acme SEO audit",
    projectDomain: "acme.com",
    archived: false,
  });
  mocks.renderReportSocialImage.mockResolvedValue(new Response("image"));
  mocks.forShare.mockResolvedValue(null);
});

describe("report social image access", () => {
  it("renders the title from the authorized report", async () => {
    const response = await handleReportSocialImage(TOKEN);
    expect(mocks.getSharedReportByToken).toHaveBeenCalledWith(TOKEN);
    expect(mocks.renderReportSocialImage).toHaveBeenCalledWith(
      "Acme SEO audit",
      "acme.com",
      null,
    );
    expect(await response.text()).toBe("image");
  });

  // RFC-0007 6.7: a white-label card names the organization, not Relay.
  it("names a white-label organization instead of Relay", async () => {
    mocks.forShare.mockResolvedValue({
      organizationName: "Acme Agency",
      branding: { brandColor: "#112233", logoDataUrl: null },
      hideRelayMark: true,
    });
    await handleReportSocialImage(TOKEN);
    expect(mocks.renderReportSocialImage).toHaveBeenCalledWith(
      "Acme SEO audit",
      "acme.com",
      { name: "Acme Agency", logo: null },
    );
  });

  it("falls back to the marketing card on rendering failure and retries next time", async () => {
    const error = new Error("Renderer failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.renderReportSocialImage.mockRejectedValueOnce(error);
    const response = await handleReportSocialImage(TOKEN);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://openseo.so/social-card.jpg",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(log).toHaveBeenCalledWith(
      "Report social image rendering failed",
      error,
    );
    expect(await (await handleReportSocialImage(TOKEN)).text()).toBe("image");
  });

  it("does not hide report lookup failures behind the fallback", async () => {
    mocks.getSharedReportByToken.mockRejectedValue(
      new Error("Database unavailable"),
    );
    await expect(handleReportSocialImage(TOKEN)).rejects.toThrow(
      "Database unavailable",
    );
    expect(mocks.renderReportSocialImage).not.toHaveBeenCalled();
  });

  it.each(["missing", "archived"])(
    "does not reveal a %s report's title",
    async (state) => {
      mocks.getSharedReportByToken.mockResolvedValue(
        state === "missing" ? null : { title: "Private title", archived: true },
      );
      const response = await handleReportSocialImage(TOKEN);
      expect(response.status).toBe(404);
      expect(response.headers.get("Location")).toBeNull();
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(await response.text()).toBe("This report isn't shared.");
      expect(mocks.renderReportSocialImage).not.toHaveBeenCalled();
    },
  );

  it.each(["disabled", "invalid"])(
    "skips both lookup and rendering when sharing is %s",
    async (state) => {
      mocks.sharesEnabled.mockResolvedValue(state !== "disabled");
      expect(
        (await handleReportSocialImage(state === "invalid" ? "bad" : TOKEN))
          .status,
      ).toBe(404);
      expect(mocks.getSharedReportByToken).not.toHaveBeenCalled();
      expect(mocks.renderReportSocialImage).not.toHaveBeenCalled();
    },
  );
});
