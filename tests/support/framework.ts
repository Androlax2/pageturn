/**
 * What the framework adapters' specs share. Each fixture app notes, in sessionStorage,
 * the marks on <html> each time they change ("marks"), the events ("arrived", "stay"),
 * the arrival at each real load ("loaded"), and what its moves are told; and sets a
 * flag once its router handles the links.
 */
import { expect, type Page } from "@playwright/test";
import { notes } from "./site.ts";

export interface Marks {
  leaving: string | null;
  arriving: string | null;
  tone: string | null;
}

/** A fixture app: where it is served, and the flag that says its router is ready. */
export interface App {
  base: string;
  ready: string;
}

export async function open(page: Page, app: App, path = "/"): Promise<void> {
  await page.goto(app.base + path);
  await page.waitForFunction((flag) => flag in window, app.ready);
}

/** The values noted under key, in order. */
export const noted = async (page: Page, key: string): Promise<unknown[]> =>
  (await notes(page))
    .filter((note) => note.key === key)
    .map((note) => note.value);

/** How many arrivals under move have ended so far (the first load has its own, move null). */
export const arrivalsOf = async (page: Page, move: string): Promise<number> =>
  ((await noted(page, "arrived")) as { move: string | null }[]).filter(
    (arrived) => arrived.move === move,
  ).length;

/** The marks as they changed, once an arrival under move has been seen. */
export async function arrivedUnder(page: Page, move: string): Promise<Marks[]> {
  await expect
    .poll(async () =>
      ((await noted(page, "marks")) as Marks[]).some(
        (marks) => marks.arriving === move,
      ),
    )
    .toBe(true);
  return (await noted(page, "marks")) as Marks[];
}

/** The arrival under move came in one step from its leave: no frame at rest between. */
export function expectOneStep(
  marks: Marks[],
  move: string,
  leave = move,
): void {
  const at = marks.findIndex((each) => each.arriving === move);
  expect(marks[at - 1]).toMatchObject({ leaving: leave, arriving: null });
  expect(marks[at]).toMatchObject({ leaving: null, arriving: move });
}
