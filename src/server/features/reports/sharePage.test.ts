import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderSharePage } from "./sharePage";
import { REPORT_IFRAME_SANDBOX } from "@/shared/report-sandbox";

const mocks = vi.hoisted(() => ({
  env: {
    AUTH_MODE: "hosted" as string | undefined,
  },
  getSharedReportByToken: vi.fn(),
  getForShare: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: mocks.env }));
vi.mock("@/server/features/reports/repositories/ReportRepository", () => ({
  ReportRepository: { getSharedReportByToken: mocks.getSharedReportByToken },
}));
vi.mock(
  "@/server/features/reports/repositories/ReportBrandingRepository",
  () => ({ ReportBrandingRepository: { getForShare: mocks.getForShare } }),
);

const TOKEN = "a".repeat(32);
const request = () => new Request(`https://app.example.com/s/${TOKEN}`);

// Only what the page reads off the row. The title and summary carry the
// characters that must not reach the HTML unescaped.
const SHARED_REPORT = {
  title: "badseo.dev <SEO> audit",
  summary: '\nFix the "titles" first.\n\nThen the meta descriptions.',
  updatedAt: "2026-09-01T10:00:00.000Z",
  projectDomain: "badseo.dev",
  archived: false,
};

// A 1x1 PNG.
const LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";

beforeEach(() => {
  mocks.env.AUTH_MODE = "hosted";
  mocks.getSharedReportByToken.mockResolvedValue(SHARED_REPORT);
  mocks.getForShare.mockResolvedValue({
    name: "Acme",
    brandColor: null,
    logoDataUrl: null,
    isPaying: true,
  });
});

describe("renderSharePage", () => {
  it("puts the framed document, the escaped title and the preview tags in the first response", async () => {
    const response = await renderSharePage(TOKEN, request());
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain(
      `<iframe src="/s/${TOKEN}/raw" sandbox="${REPORT_IFRAME_SANDBOX}"`,
    );
    expect(html).toContain(
      "<title>badseo.dev &lt;SEO&gt; audit · OpenSEO</title>",
    );
    expect(html).toContain(
      '<meta property="og:description" content="Fix the &quot;titles&quot; first."/>',
    );
    expect(html).toContain(
      `<meta property="og:url" content="https://app.example.com/s/${TOKEN}"/>`,
    );
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
    const $ = load(html);
    const imageUrl = `https://app.example.com/s/${TOKEN}/og.png?v=2026-09-01T10%3A00%3A00.000Z&domain=badseo.dev`;
    expect($('meta[property="og:image"]').attr("content")).toBe(imageUrl);
    expect($('meta[name="twitter:image"]').attr("content")).toBe(imageUrl);
    expect($('meta[property="og:image:alt"]').attr("content")).toBe(
      `${SHARED_REPORT.title} · OpenSEO`,
    );
    expect($('meta[name="twitter:image:alt"]').attr("content")).toBe(
      `${SHARED_REPORT.title} · OpenSEO`,
    );
    // No app bundle: the reader has never signed in and needs none of it.
    expect(html).not.toContain("/assets/");
  });

  // RFC-0007 6.7: white-label is opt-in branding, and the Relay mark comes
  // off only on a paid plan.
  it.each([
    [true, false],
    [false, true],
  ])(
    "shows the organization's logo and color, with the Relay mark when paying is %s: %s",
    async (isPaying, showsMark) => {
      mocks.getForShare.mockResolvedValue({
        name: "Acme",
        brandColor: "#1C4ED8",
        logoDataUrl: LOGO,
        isPaying,
      });
      const $ = load(await (await renderSharePage(TOKEN, request())).text());
      expect($("header img.logo").attr("src")).toBe(LOGO);
      expect($("header img.logo").attr("alt")).toBe("Acme");
      // On body: the page's own :root colors come after this style.
      expect($("style").text()).toContain(
        "body{--primary:#1c4ed8;--primary-text:#ffffff}",
      );
      expect($("header").text().includes("Made with OpenSEO")).toBe(showsMark);
      expect($("a.btn.primary").length > 0).toBe(showsMark);
      expect($("title").text()).toBe(
        `${SHARED_REPORT.title} · ${showsMark ? "OpenSEO" : "Acme"}`,
      );
    },
  );

  it("drops a stored logo that is not a PNG or JPEG", async () => {
    mocks.getForShare.mockResolvedValue({
      name: "Acme",
      brandColor: null,
      logoDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
      isPaying: true,
    });
    const html = await (await renderSharePage(TOKEN, request())).text();
    expect(html).not.toContain("data:image/svg");
    expect(html).toContain("Made with OpenSEO");
  });

  // The reader is told the project is archived; the report's own title is
  // content the link no longer grants access to.
  it("names the archived state without naming the report", async () => {
    mocks.getSharedReportByToken.mockResolvedValue({
      ...SHARED_REPORT,
      archived: true,
    });

    const response = await renderSharePage(TOKEN, request());
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(html).toContain("This project has been archived.");
    expect(html).not.toContain("badseo.dev");
    expect(html).not.toContain("og:image");
    expect(html).not.toContain("twitter:image");
  });

  // A revoked link and a guessed one are the same answer: a link that stopped
  // working must not confirm it once did.
  it.each([
    [
      "an unknown or revoked token",
      TOKEN,
      () => mocks.getSharedReportByToken.mockResolvedValue(null),
    ],
    // A token of the wrong shape is refused before the database is asked.
    ["a malformed token", "nope", () => {}],
    // Sharing is hosted-only: a self-hosted deployment answers as if the
    // link had never existed.
    [
      "a deployment that is not hosted",
      TOKEN,
      () => {
        mocks.env.AUTH_MODE = "cloudflare_access";
      },
    ],
  ])("answers not shared for %s", async (_case, token, arrange) => {
    arrange();

    const response = await renderSharePage(token, request());

    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("This report isn&#x27;t shared.");
    expect(html).not.toContain("og:image");
    expect(html).not.toContain("twitter:image");
    if (token !== TOKEN) {
      expect(mocks.getSharedReportByToken).not.toHaveBeenCalled();
    }
  });
});
