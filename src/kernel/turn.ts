/**
 * A turn, whichever engine plays it: which move a visit plays, the turn given to its
 * leave, and the leave itself, with the default move in its place when it declines.
 */
import { isDeclined, registry } from "../common/registry.ts";
import type { Handover, Turn, Visit } from "../common/types.ts";
import { endArrivalBy } from "./arrival.ts";
import { playCssLeave } from "./leaving.ts";

/** The data-turn attribute, then the choosers, then the moves' match, then the default. */
export function choose(visit: Visit): string | null {
  const named = visit.link.closest("[data-turn]")?.getAttribute("data-turn");
  if (named) return named === "none" ? null : named;
  try {
    for (const chooser of registry.choosers) {
      const name = chooser(visit);
      if (name !== undefined) return name;
    }
    for (const [name, move] of registry.moves) {
      if (move.match?.(visit)) return name;
    }
  } catch (error) {
    reportError(error);
  }
  return registry.settings.defaultMove;
}

export function turnOf(visit: Visit, move: string): Turn {
  let leaving: Promise<void> | undefined;
  return {
    ...visit,
    move,
    leaving: () => {
      // The page is left: whatever of its arrival still plays gives way to the leave.
      if (!leaving) endArrivalBy("leave");
      leaving ??= playCssLeave(move, registry.settings.leaveTimeout);
      return leaving;
    },
    decline: () => registry.declined,
  };
}

/**
 * Plays the move's leave, or the default's when it declines; `played` is told each turn
 * that plays. Null: the page is left unmarked, also when the leave throws or outlasts
 * leaveTimeout.
 */
export function leave(
  turn: Turn,
  played: (turn: Turn) => void,
): Promise<Handover | null> {
  const timedOut = new Promise<null>((resolve) =>
    setTimeout(resolve, registry.settings.leaveTimeout, null),
  );
  return Promise.race([run(turn, played).catch(() => null), timedOut]);
}

async function run(
  turn: Turn,
  played: (turn: Turn) => void,
): Promise<Handover | null> {
  played(turn);
  const outcome = await registry.moves.get(turn.move)?.leave?.(turn);
  if (isDeclined(outcome)) {
    const fallback = registry.settings.defaultMove;
    if (fallback === null) return null;
    if (fallback !== turn.move) return run(turnOf(turn, fallback), played);
  } else if (outcome) {
    return outcome as Handover;
  }
  await turn.leaving();
  return {};
}
