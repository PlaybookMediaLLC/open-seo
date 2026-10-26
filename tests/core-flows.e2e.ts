import { expect, test, type Page } from "@playwright/test";
import { handleMissingProviderSetup } from "./domain-overview-test-utils";

const PAGES = [
  "",
  "/work",
  "/keywords",
  "/saved",
  "/audit",
  "/rank-tracking",
  "/settings",
];

async function openDefaultProject(page: Page) {
  await page.goto("/app");
  await page.waitForURL(/\/p\/[^/]+\/?$/);
  return page.url().replace(/\/$/, "");
}

/** Uncaught exceptions and server errors seen while the test runs. */
function watchForFailures(page: Page) {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500)
      failures.push(`${response.status()} ${response.url()}`);
  });
  return failures;
}

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label} scrolls sideways`).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await handleMissingProviderSetup(page);
});

for (const viewport of [
  { width: 1400, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`main pages load cleanly at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const failures = watchForFailures(page);
    const projectUrl = await openDefaultProject(page);
    for (const path of PAGES) {
      await page.goto(projectUrl + path);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expectNoSidewaysScroll(page, path || "home");
    }
    expect(failures).toEqual([]);
  });
}

test("Back returns to the page before the /app redirect", async ({ page }) => {
  const projectUrl = await openDefaultProject(page);
  await page.goto(`${projectUrl}/work`);
  await page.goto("/app");
  await page.waitForURL(/\/p\/[^/]+\/?$/);
  await page.goBack();
  await expect(page).toHaveURL(`${projectUrl}/work`);
});

test("project settings keep a rejected domain and say why", async ({
  page,
}) => {
  const name = `e2e project ${Date.now()}`;
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/p\/[^/]+\/?$/);

  await page.goto(`${page.url().replace(/\/$/, "")}/settings`);
  const domain = page.getByLabel(/^Domain/);
  await domain.fill("not a domain!!");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Enter a valid domain, like acme.com."),
  ).toBeVisible();
  await expect(domain).toHaveValue("not a domain!!");

  await page.getByRole("button", { name: "Archive project" }).click();
  await page.getByRole("button", { name: "Yes, archive project" }).click();
  await page.waitForURL(/\/p\/[^/]+\/?$/);
});

test("rank tracking names a duplicate domain", async ({ page }) => {
  const domain = `e2e-${Date.now()}.com`;
  const projectUrl = await openDefaultProject(page);
  const addDomain = async (value: string) => {
    await page.goto(`${projectUrl}/rank-tracking`);
    await page.getByRole("button", { name: "Add Domain" }).first().click();
    await page.getByLabel("Target Domain").fill(value);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Domain" })
      .click();
  };

  await addDomain(domain);
  await expect(page.getByText("Domain added for rank tracking")).toBeVisible();
  await addDomain(domain.toUpperCase());
  await expect(
    page.getByText(
      "This domain is already tracked for this country, city and language.",
    ),
  ).toBeVisible();
  // The dialog stays open with the domain, lowercased when the field blurred.
  await expect(page.getByLabel("Target Domain")).toHaveValue(domain);

  await page.goto(`${projectUrl}/rank-tracking`);
  await page.getByRole("button", { name: `Archive ${domain}` }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByRole("link", { name: `Open ${domain}` })).toHaveCount(
    0,
  );
});
