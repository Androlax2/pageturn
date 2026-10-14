/** The `shadow()` part of pageturn/morph. */
import type { Part } from "./types.ts";

/**
 * A shadow as `drop-shadow()` takes it, `x y blur color`. Given that way, or as a
 * computed `box-shadow` (`color x y blur spread`, its first shadow, without the spread).
 */
function asDropShadow(shadow: string): string | undefined {
  if (/^[-\d.]/.test(shadow)) return shadow;
  const [, color, x, y, blur] =
    /^(.*?\)|\S+) (\S+) (\S+) (\S+)/.exec(shadow) ?? [];
  return color && blur ? `${x} ${y} ${blur} ${color}` : undefined;
}

const dropShadow = (shadow: string): string => `drop-shadow(${shadow})`;

/**
 * Carries the shadow of an element that has one. The layer is cropped, so it cannot cast
 * it: a shape under the layer replays its keyframes and casts the shadow, from one end's
 * to the other's, fading where an end has none. Each end's is read from its
 * `box-shadow`; `ends` may give one, as `"0 20px 40px rgb(0 0 0 / 0.3)"` or as the
 * computed `box-shadow` of another element.
 */
export function shadow(): Part {
  return (stage) => {
    const { read } = stage;
    stage.read = (element) => {
      const end = read(element);
      const own = asDropShadow(getComputedStyle(element).boxShadow);
      if (own) end.shadow = own;
      return end;
    };
    stage.onPlay.push((layer, first, last, timing, finished) => {
      // As the site may have given them in `ends`: either way of writing a shadow.
      const start = first.shadow && asDropShadow(first.shadow);
      const stop = last.shadow && asDropShadow(last.shadow);
      const one = start ?? stop;
      if (!one) return;
      const caster = document.createElement("div");
      caster.setAttribute("aria-hidden", "true");
      caster.dataset.turnShadow = "";
      caster.style.cssText = `position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;filter:${dropShadow(one)}`;
      const shape = document.createElement("div");
      shape.style.cssText = `background:#000;width:${layer.style.width};height:${layer.style.height}`;
      for (const animation of layer.getAnimations()) {
        const { effect } = animation;
        if (effect instanceof KeyframeEffect) {
          shape.animate(effect.getKeyframes(), timing);
        }
      }
      caster.animate(
        start && stop
          ? { filter: [dropShadow(start), dropShadow(stop)] }
          : { opacity: start ? [1, 0] : [0, 1] },
        timing,
      );
      caster.append(shape);
      // Under the layer, which is in the top layer; above the page.
      layer.before(caster);
      finished.then(() => caster.remove());
    });
  };
}
