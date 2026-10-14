/**
 * The examples the README shows: each step plays the move it says, in the browsers the
 * recordings are made in.
 */
import { expect, type Page, test } from "@playwright/test";
import { scenarios, WATCH } from "../../examples/scenarios.ts";

interface Note {
  page: string;
  arrives?: string;
  tint?: string;
  layer?: boolean;
}

const notes = (page: Page): Promise<Note[]> =>
  page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("example-notes") || "[]"),
  );

test.beforeEach(async ({ page }) => {
  await page.addInitScript(WATCH);
});

for (const { name, start, steps } of scenarios) {
  test(`the ${name} example plays each of its moves`, async ({ page }) => {
    await page.goto(start);
    await page.waitForLoadState("load");
    for (const step of steps) {
      const before = (await notes(page)).length;
      const left = page.url();
      if (step.click) await page.click(step.click);
      else await page.goBack();
      await expect.poll(() => page.url()).not.toBe(left);
      await page.waitForLoadState("load");
      const added = async (): Promise<Note[]> =>
        (await notes(page)).slice(before);
      // Polled: a transition the browser plays is noted a task after it is revealed.
      if (step.arrives) {
        await expect
          .poll(async () => (await added()).map((note) => note.arrives))
          .toContain(step.arrives);
      }
      // Settled: the arrival has ended.
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.dataset.turnArriving ?? null,
          ),
        )
        .toBeNull();
      const seen = await added();
      const arrived = seen.filter((note) => note.arrives);
      if (!step.arrives) expect(arrived).toEqual([]);
      // A move's data, read in the arriving CSS as --turn-tint.
      if (step.tint) {
        expect(
          arrived.find((note) => note.arrives === step.arrives)?.tint,
        ).toBe(step.tint);
      }
      if (step.morph) expect(seen.some((note) => note.layer)).toBe(true);
    }
  });
}
