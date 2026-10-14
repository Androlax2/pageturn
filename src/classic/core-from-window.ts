/**
 * pageturn/core as pageturn.js has put it on window.pageturn, for pageturn-morph.js: the
 * morph's imports of the core resolve here in that build, so the kernel is not shipped
 * twice. Without pageturn.js before it, a morph defines nothing.
 */
import type * as Core from "../kernel/core.ts";

export const defineMove: typeof Core.defineMove = (name, move) =>
  window.pageturn?.defineMove?.(name, move) ?? (() => {});

export const arrival: typeof Core.arrival = () =>
  (window.pageturn?.arrival ?? null) as ReturnType<typeof Core.arrival>;
