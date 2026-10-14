/**
 * Compile-time checks of the public types: what a move carries, declared once, and the
 * answers that decline. Never
 * run: `make check` type-checks it, and each @ts-expect-error fails the check if the line
 * below it stops being an error.
 */
import {
  arrival,
  type Carries,
  defineMove,
  type Json,
  whenLeft,
} from "../../src/kernel/core.ts";
import { defineMorph } from "../../src/morph/index.ts";

// An interface of JSON values is accepted where a site hands data over.
interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
const box: Box = { left: 0, top: 0, width: 1, height: 1 };

// One declaration types what a move carries, on both pages.
interface ProjectMove extends Carries {
  data: { project: string; box: Box | null };
  remember: { scrollTop: number };
  report: { box: Box | null };
}

defineMove<ProjectMove>("project", {
  match: ({ link }) => link.pathname.startsWith("/projets/"),
  async leave(turn) {
    // The named answer that declines.
    if (!turn.canHandOver) return turn.decline();
    await turn.leaving();
    return {
      data: { project: "/projets/a", box },
      returnAs: "project-back",
      remember: { scrollTop: 40 },
    };
  },
  arrive(reached) {
    // The page reached, typed by the same declaration, whichever way it came.
    const project: string | undefined =
      reached.via === "link" ? reached.data?.project : undefined;
    const reported: Box | null | undefined =
      reached.via === "history" ? reached.reported?.box : undefined;
    void project;
    void reported;
  },
  stay(_turn, stay) {
    // What leave answered, typed by the declaration.
    const scrollTop: number | undefined = stay.handover?.remember?.scrollTop;
    void scrollTop;
  },
});

const reached = arrival<ProjectMove>();
if (reached?.via === "link") {
  const project: string | undefined = reached.data?.project;
  // @ts-expect-error A link arrival remembers nothing.
  const kept: { scrollTop: number } = reached.remembered;
  void project;
  void kept;
} else if (reached?.via === "history") {
  const reported: Box | null | undefined = reached.reported?.box;
  const scrollTop: number | undefined = reached.remembered?.scrollTop;
  // @ts-expect-error By history there is no data: it is what was reported, or remembered.
  const data: { project: string } = reached.data;
  void reported;
  void scrollTop;
  void data;
}

whenLeft(() => ({ box }));
whenLeft(() => ({ box: null as Box | null, unsaid: undefined }));

// Undeclared, a move carries any Json.
const anything = null as unknown as Json;
defineMove("loose", {
  leave: () => ({ data: anything, remember: [1, "two"] }),
});

defineMove<ProjectMove>("wrong", {
  // @ts-expect-error The data does not match the declaration.
  leave: () => ({ data: { project: 1, box: null } }),
});

defineMove<{ data: { at: Date } }>("dated", {
  // @ts-expect-error A Date is not JSON.
  leave: () => ({ data: { at: new Date() } }),
});

// @ts-expect-error A Map is not JSON.
whenLeft(() => ({ seen: new Map<string, number>() }));

// @ts-expect-error A function is not JSON.
whenLeft(() => ({ run: () => 1 }));

defineMove("old", {
  // @ts-expect-error false no longer declines: return turn.decline().
  leave: () => false,
});

defineMove("restored", {
  // @ts-expect-error restore is now stay.
  restore() {},
});

// The report's answer that declines is decline(), as everywhere.
whenLeft((leaving) => leaving.decline());

// A morph's ends declines the same way; false leaves the types.
defineMorph("card", {
  to: "#hero",
  ends: (_ends, { decline }) => decline(),
});
defineMorph("old-card", {
  to: "#hero",
  // @ts-expect-error false no longer declines: return decline().
  ends: () => false,
});

// window.pageturn is typed whole: the classic API, and the morph's under `morph`.
window.pageturn?.defineMove?.("classic", {});
window.pageturn?.morph?.defineMorph("classic", {
  to: "#hero",
  use: [window.pageturn.morph.linkBack()],
});
