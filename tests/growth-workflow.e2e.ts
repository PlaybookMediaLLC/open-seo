import { expect, test, type Page } from "@playwright/test";

// The growth workflow end to end (RFC-0001 S4). The dev server runs with
// VITE_E2E_GROWTH_FIXTURES=1, so the worker's Google and GitHub calls reach
// the provider fake in src/server/e2e/growthProviderFake.ts. Every Relay
// service runs its real code.

async function confirmDialog(page: Page, name: string) {
  await page.getByRole("alertdialog").getByRole("button", { name }).click();
}

async function dismissProviderSetup(page: Page) {
  const dismiss = page.getByRole("button", { name: "Dismiss" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
}

test("detect, review, prepare, open a pull request and track it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  // Google's consent screen sends the browser straight back to the callback.
  await page.route("https://accounts.google.com/**", (route) => {
    const consent = new URL(route.request().url());
    const callback = new URL(consent.searchParams.get("redirect_uri") ?? "");
    callback.searchParams.set("code", "e2e-code");
    callback.searchParams.set("state", consent.searchParams.get("state") ?? "");
    return route.fulfill({
      status: 302,
      headers: { location: callback.toString() },
    });
  });

  await page.goto("/app");
  await page.waitForURL(/\/p\/[^/]+/);
  await dismissProviderSetup(page);
  const previousUrl = page.url();
  await page.getByRole("combobox", { name: "Switch project" }).click();
  await page.getByRole("button", { name: "New project" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill(`UX workflow ${Date.now()}`);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page).not.toHaveURL(previousUrl);
  const projectId = /\/p\/([^/?#]+)/.exec(page.url())?.[1];
  await dismissProviderSetup(page);

  // Connect Search Console and choose the property.
  await page.goto(`/p/${projectId}/settings/integrations`);
  // Search Console is the first card, so its Connect button comes first.
  await page
    .getByRole("button", { name: "Connect", exact: true })
    .first()
    .click();
  await page.getByText("Select a property…").click();
  await page
    .getByRole("region", { name: "Google properties" })
    .getByText("sc-domain:example.com")
    .click();
  await page.getByRole("button", { name: "Save property" }).click();
  await expect(page.getByText("sc-domain:example.com")).toBeVisible();

  // Connect the repository with a personal token.
  await page.getByLabel("Repository owner").fill("acme");
  await page.getByLabel("Repository name").fill("site");
  await page
    .getByLabel("Fine-grained token")
    .fill("github_pat_e2e_0123456789abcdefghij");
  await page.getByRole("checkbox", { name: /I authorize access/ }).click();
  await page.getByRole("button", { name: "Connect repository" }).click();
  await expect(page.getByText("acme/site")).toBeVisible();

  // Detect, open the opportunity, review it and approve preparation.
  await page.goto(`/p/${projectId}/opportunities`);
  await page.getByText("Find opportunities", { exact: true }).click();
  await page
    .getByRole("button", { name: "Analyze connected search data" })
    .click();
  await expect(page.getByText(/Saved 1 evidence-backed/)).toBeVisible();
  await page
    .getByRole("row", { name: /example\.com\/about/ })
    .getByRole("link", { name: "Review a striking-distance query" })
    .click();
  await page.getByRole("button", { name: "Mark reviewed" }).click();
  await confirmDialog(page, "Mark reviewed");
  await page
    .getByRole("button", { name: "Approve proposal preparation" })
    .click();
  await confirmDialog(page, "Approve proposal preparation");

  // Prepare a title and description change, then approve the pull request.
  await page
    .getByLabel("Existing page file (repository-relative)")
    .fill("app/about/page.tsx");
  await page.getByLabel("Your replacement title (optional)").fill("About us");
  await page
    .getByLabel("Your replacement description (optional)")
    .fill("Example builds useful software for small teams.");
  await page.getByRole("button", { name: "Prepare verified proposal" }).click();
  await expect(
    page.getByText('"About us | Example" (18 characters)'),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Review a striking-distance query" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/relay-review-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "Review sections" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("heading", { name: "Review a striking-distance query" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/relay-review-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("checkbox", { name: /I reviewed this exact diff/ })
    .click();
  await page
    .getByRole("button", { name: "Approve and create pull request" })
    .click();
  await confirmDialog(page, "Approve and create pull request");
  await expect(
    page.getByRole("button", { name: /View pull request #\d+/ }),
  ).toBeVisible();

  // Start tracking and read the pull request status.
  await page.getByRole("button", { name: "Track results" }).click();
  await page.waitForURL(/\/experiments\//);
  await page.getByRole("button", { name: "Refresh GitHub status" }).click();
  await expect(
    page.getByText("GitHub reports this pull request is open."),
  ).toBeVisible();
});

test("workspaces retain project scope, keyboard access and research drafts", async ({
  page,
}) => {
  await page.goto("/app");
  await page.waitForURL(/\/p\/[^/]+/);
  await dismissProviderSetup(page);
  const projectId = /\/p\/([^/?#]+)/.exec(page.url())?.[1];
  const mainNav = page.getByRole("navigation", { name: "Main navigation" });
  for (const name of ["Home", "Work", "Research", "Monitor", "Library"]) {
    await expect(
      mainNav.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", new RegExp(`/p/${projectId}(?:/|$)`));
  }
  await expect(
    page.getByRole("dialog", { name: "Set up DataForSEO research" }),
  ).not.toBeVisible();
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.screenshot({
    path: "test-results/relay-home-desktop.png",
    fullPage: true,
  });
  await mainNav.getByRole("link", { name: "Research", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Keywords", exact: true })
    .fill("seo");
  await expect(
    page.getByText(/Estimated maximum for 1 fresh search/),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/keyword=/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/relay-research-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Search & start a task" }).click();
  await page
    .getByRole("textbox", { name: "Search tasks and views" })
    .fill("saved");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Saved Keywords", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/p/${projectId}/saved`));
  await expect(
    page.getByText("Build your keyword collection", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update keyword stats" }),
  ).not.toBeVisible();
  await page.screenshot({
    path: "test-results/relay-library-mobile.png",
    fullPage: true,
  });
});
