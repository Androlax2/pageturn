/** A plain link between two pages with no pageturn on them: the server and the fixture work. */
import { expect, test } from "@playwright/test";

test("a link leads to the next page", async ({ page }) => {
  await page.goto("/plain/index.html");
  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/plain\/about\.html$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About");
});
