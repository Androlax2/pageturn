/** A travel's timing, and a leg's own values laid over it. */
import type { Leg, Timing } from "./types.ts";

/** The timing with what the leg says over it: what the leg leaves out stays. */
export const over = (timing: Timing, leg: Leg = {}): Timing => ({
  ...timing,
  duration: leg.duration ?? timing.duration,
  delay: leg.delay ?? timing.delay,
  easing: leg.easing ?? timing.easing,
});
