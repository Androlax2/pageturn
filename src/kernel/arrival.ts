/**
 * How a page's arrival ends: the kernel follows `data-turn-arriving` and
 * `data-turn-entering` from its start to their end, fires `pageturn:arrived` as they go,
 * whoever removes them, and with `arrivalEnds: "animations"` removes them itself once
 * the page's animations have ended. And `arrive`, told to the move the page arrives under.
 */
import { warn } from "../common/dev.ts";
import { afterDomContentLoaded } from "../common/page.ts";
import { registry } from "../common/registry.ts";
import type { Arrival, Arrived } from "../common/types.ts";
import { capOf, isEnding, untilEnded } from "./cap.ts";

/** The page's root, read when needed: the module may be imported where there is none. */
const root = (): HTMLElement => document.documentElement;

/** Watches the arrival under way, until its marks are gone. */
let watching: MutationObserver | null = null;

/** Who ended it, when the kernel did: its wait, or a leave. */
let endedBy: "settled" | "leave" | null = null;

/**
 * The longest an arrival waits for its animations, unless --turn-arrive-max says less.
 * Long: ending the arrival cuts what still plays under its mark short, and an entrance
 * runs for seconds. It is there for a page that starts finite animations without end.
 */
const ARRIVE_MAX_MS = 10000;

const isArriving = (): boolean =>
  "turnArriving" in root().dataset || "turnEntering" in root().dataset;

const nextFrame = (): Promise<unknown> =>
  new Promise((resolve) => requestAnimationFrame(resolve));

/** Ends the arrival under way, saying who did. */
export function endArrivalBy(by: "settled" | "leave"): void {
  if (!isArriving()) return;
  endedBy = by;
  window.pageturn?.endArrival();
}

/** Starts following the arrival under way: at the kernel's start, and on a return from bfcache. */
export function followArrival(): void {
  stopFollowing();
  if (!isArriving()) return;
  let move = root().dataset.turnArriving ?? null;
  let entering = "turnEntering" in root().dataset;
  let isCut = false;
  endedBy = null;
  const watch = new MutationObserver(() => {
    // The mark may come after the following started: pagereveal sets it when the browser
    // turns out not to play the default move.
    move = root().dataset.turnArriving ?? move;
    if (
      entering &&
      !("turnEntering" in root().dataset) &&
      window.pageturn?.notAnew
    ) {
      // Taken off by the package (a page loaded scrolled, a page put back): it was not
      // shown anew. Not an end.
      entering = false;
    } else if (endedBy === null) {
      // Removed by the page, not by the kernel: endArrival(), or the attribute itself.
      isCut = true;
    }
    if (isArriving()) return;
    watch.disconnect();
    if (watching === watch) watching = null;
    // Only the mark of a page shown anew, taken off: there was no arrival to end.
    if (!entering && move === null) return;
    // Read now: the page may have configured it after the kernel started.
    const isManual = registry.settings.arrivalEnds === "manually";
    const whole =
      endedBy !== "leave" && (isManual || (endedBy === "settled" && !isCut));
    document.dispatchEvent(
      new CustomEvent<Arrived>("pageturn:arrived", {
        detail: { move, entering, whole },
      }),
    );
  });
  watching = watch;
  watch.observe(root(), {
    attributeFilter: ["data-turn-arriving", "data-turn-entering"],
  });
  // Two frames after the page is parsed: every module has run, what it started has started.
  afterDomContentLoaded(async () => {
    await nextFrame();
    await nextFrame();
    if (watching !== watch) return;
    if (registry.settings.arrivalEnds !== "manually") waitForAnimations(watch);
  });
}

/**
 * Waits until no animation is running on the page, then ends the arrival. Looked at
 * again as each round ends: an animation one starts is waited for too. CSS transitions
 * (a hover) and infinite animations are not.
 */
async function waitForAnimations(watch: MutationObserver): Promise<void> {
  const until = performance.now() + capOf("--turn-arrive-max", ARRIVE_MAX_MS);
  for (let isFirst = true; ; isFirst = false) {
    const running = document.getAnimations().filter(
      (animation) =>
        animation.playState === "running" &&
        // A hover's transition is not part of an arrival.
        !(
          typeof CSSTransition !== "undefined" &&
          animation instanceof CSSTransition
        ) &&
        isEnding(animation),
    );
    const arrival = window.pageturn?.arrival;
    if (DEV && isFirst && running.length === 0 && arrival?.via === "history") {
      warn(
        `return:${arrival.move}`,
        `this page was returned to under "${arrival.move}" with no animation: Back cannot play a leave, so the page left goes at once and this one shows at once. Animate it in, as html[data-turn-arriving="${arrival.move}"] main { animation: … }.`,
      );
    }
    const left = until - performance.now();
    if (running.length === 0 || left <= 0) break;
    await untilEnded(running, left);
    // A frame on: the animationend handlers have run, and what they start has started.
    await nextFrame();
    if (watching !== watch) return;
  }
  if (watching === watch) endArrivalBy("settled");
}

/** Tells the move the page arrives under, if this page defines it. */
export function tellArrival(arrival: Arrival): void {
  try {
    registry.moves.get(arrival.move)?.arrive?.(arrival);
  } catch (error) {
    reportError(error);
  }
}

/** The page goes, into the back/forward cache or for good: its arrival is not followed. */
export function stopFollowing(): void {
  watching?.disconnect();
  watching = null;
}
