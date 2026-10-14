/** The CSS half of a leave, and the wait on it. */
import { capOf, isEnding, untilEnded } from "./cap.ts";

/**
 * Sets data-turn-leaving and resolves when the animations and transitions it started have
 * ended. Infinite animations are not waited for: they would never end. The wait is cut at
 * the leave's timeout, or sooner at --turn-leave-max when the page sets it: the animation
 * then plays on while the next page loads.
 */
export function playCssLeave(name: string, timeout: number): Promise<void> {
  const root = document.documentElement;
  const before = new Set(document.getAnimations());
  root.dataset.turnLeaving = name;
  // Reading the animations again flushes style, so the new ones exist by now.
  const started = document
    .getAnimations()
    .filter((animation) => !before.has(animation) && isEnding(animation));
  if (started.length === 0) return Promise.resolve();
  return untilEnded(started, capOf("--turn-leave-max", timeout)).then(
    () => undefined,
  );
}
