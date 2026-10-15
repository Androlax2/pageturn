/**
 * defineMorph: one element travels from a page to its place on the next, as a layer
 * that crosses the page change (place.ts), and is swapped for the real element. It plays
 * before the page changes when the page left can know the other end, after it otherwise.
 * Everything else is a part, imported by the site that wants it: the core has no option
 * for any of them.
 */

import { inBrowser, reducesMotion } from "../common/page.ts";
import { isDeclined, registry } from "../common/registry.ts";
import { writeSession } from "../common/session.ts";
import { defineMove, type Handover, type Json } from "../kernel/core.ts";
import { atTheirEnd, endOf, isEnding, looksSame, shifted } from "./end.ts";
import { markup, moveAt, standAt } from "./layer.ts";
import { picture, whenDrawn } from "./picture.ts";
import {
  clearLayer,
  type End,
  MORPH_KEY,
  onPage,
  type Placed,
  placeHandedLayer,
  showLayer,
  whenParsed,
} from "./place.ts";
import { over } from "./timing.ts";
import type { Morph, Stage } from "./types.ts";

const DURATION_MS = 500;

const EASING = "cubic-bezier(0.2, 0, 0, 1)";

/** A layer that travelled to an estimate is brought to the real place in this long. */
const CORRECTION_MS = 300;

/** The layer handed to this page: the head script's, or put back now without it. */
export function handedOver(): Placed | null {
  if (window.pageturnMorph === undefined)
    window.pageturnMorph = placeHandedLayer();
  return window.pageturnMorph;
}

let isHandingOver = false;

/** A morph of this page has handed its layer over: the page is being left by it. */
export const isLeaving = (): boolean => isHandingOver;

/** Hidden, not removed: it keeps its place, and the page does not move under the layer. */
function hide(element: Element): HTMLElement {
  const hidden = element as HTMLElement;
  hidden.style.visibility = "hidden";
  return hidden;
}

/** The names a defineMorph of this page has taken. */
const defined = new Set<string>();

/** @internal A morph of that name is defined on this page. */
export const isDefined = (name: string): boolean => defined.has(name);

/**
 * Defines a morph of that name: a move, whose `from` element travels to the `to` element
 * of the page reached. The rest of the page leaves and arrives by the move's CSS halves,
 * the site's to write. Returns a function that removes it.
 */
export function defineMorph<D = Json>(
  name: string,
  morph: Morph<D>,
): () => void {
  // In a frame (a copy peek() or behind() loads) or under reduced motion, nothing plays:
  // nothing is set up, nothing is loaded ahead.
  if (!inBrowser || window.top !== window || reducesMotion()) {
    return () => {};
  }
  defined.add(name);
  const kind = morph.as ?? picture;
  const finders = [morph.find ?? []].flat();

  /** Measures with the animations that move the element at their end. */
  const atRest = (element: Element): End =>
    // An element of another document (a page peek() loaded) has none of this one's.
    element.ownerDocument !== document
      ? stage.read(element)
      : atTheirEnd(
          document.getAnimations().filter((animation) => {
            const { effect } = animation;
            return (
              effect instanceof KeyframeEffect &&
              effect.target?.contains(element)
            );
          }),
          () => stage.read(element),
        );

  const stage: Stage = {
    name,
    morph: morph as Morph,
    live: null,
    endOf,
    onLeave: [],
    onStay: [],
    onPlay: [],
    onRemove: [],
    siteAnimations: [],
    atRest,
    read(element) {
      const end = stage.endOf(element);
      kind.read?.(element, end, element.matches(morph.to));
      return end;
    },
    timing: (leg) =>
      over(
        over(
          { duration: DURATION_MS, delay: 0, easing: EASING, fill: "both" },
          morph,
        ),
        leg,
      ),
    about: (link, back) => ({
      back,
      link,
      decline: () => registry.declined,
      measure(element, at) {
        const end = stage.read(element);
        if (!at) return end;
        const place = stage.read(at);
        const own = end.text?.box ?? end.box;
        const other = place.text?.box ?? place.box;
        const across = other.left - own.left;
        const down = other.top - own.top;
        const there = shifted(end, across, down);
        if (there.text) {
          there.text = {
            ...there.text,
            box: {
              ...there.text.box,
              left: there.text.box.left + across,
              top: there.text.box.top + down,
            },
          };
        }
        return there;
      },
      scroll: { x: scrollX, y: scrollY },
    }),
    layer(element, at, to) {
      const layer = kind.build(element, at, to);
      standAt(layer, kind, at);
      return layer;
    },
    async put(element, at, to) {
      const layer = stage.layer(element, at, to);
      stage.live = { layer, hidden: hide(element) };
      showLayer(layer);
      return layer;
    },
    async travel(start, stop, about, timing, plays = true, behind = null) {
      const layer = stage.live?.layer;
      if (!layer) return;
      const pose = kind.pose(layer);
      const first = pose(start);
      const last = pose(stop);
      layer.animate([moveAt(first, start), moveAt(last, stop)], timing);
      first.on.animate([first.look, last.look], timing);
      // Only when it changes: the site may animate the same thing its own way.
      if (
        first.inner &&
        last.inner &&
        JSON.stringify(first.inner.look) !== JSON.stringify(last.inner.look)
      ) {
        first.inner.on.animate([first.inner.look, last.inner.look], timing);
      }
      let end = () => {};
      const finished = new Promise<void>((resolve) => {
        end = resolve;
      });
      try {
        kind.play?.(layer, start, stop, timing, about.back);
        for (const play of stage.onPlay) {
          play(layer, start, stop, timing, finished);
        }
        if (plays) {
          morph.during?.({
            ...about,
            layer,
            content: layer.firstElementChild as HTMLElement,
            box: layer.querySelector("[data-turn-box]"),
            words: layer.querySelector("[data-turn-words]"),
            animate(element, keyframes, options) {
              const animation = element.animate(keyframes, {
                ...timing,
                ...options,
              });
              stage.siteAnimations.push(animation);
              return animation;
            },
            start,
            stop,
            timing,
            behind,
            finished,
            atEnd: (read) =>
              atTheirEnd(layer.getAnimations({ subtree: true }), read),
          });
        }
      } catch (error) {
        reportError(error);
      }
      // Brought in over the travel, unless the site's keyframes already bring it in.
      if (behind && behind.getAnimations().length === 0) {
        behind.animate({ opacity: [0, 1] }, over(timing, stage.appear));
      }
      const playing = () =>
        [
          ...layer.getAnimations({ subtree: true }),
          ...(behind?.getAnimations() ?? []),
        ].filter(isEnding);
      await Promise.all(
        [...playing(), ...stage.siteAnimations.filter(isEnding)].map(
          (animation) => animation.finished,
        ),
      ).catch(() => {});
      // Written down as plain styles, and let go: held by an animation, a layer is drawn
      // on whole pixels, half a pixel off the page's own.
      for (const animation of playing()) {
        try {
          animation.commitStyles();
        } catch {}
        animation.cancel();
      }
      end();
    },
    hand(flight) {
      isHandingOver = true;
      writeSession(MORPH_KEY, flight);
    },
    async land(placed, target, told, scroll = { x: scrollX, y: scrollY }, leg) {
      const about = { ...told, scroll };
      placed.taken = true;
      const { flight, layer } = placed;
      try {
        // Defined from the head, before the body: the element it lands on is not parsed yet.
        if (document.readyState === "loading") {
          await new Promise<void>((parsed) => whenParsed(parsed));
        }
        const element = target();
        if (!element) return;
        stage.live = { layer, hidden: hide(element) };
        // Where it will be once the browser has put the page where it goes.
        const there = shifted(
          atRest(element),
          scrollX - scroll.x,
          scrollY - scroll.y,
        );
        if (flight.t) {
          // It travelled on the page left, to an end known there: only what that end got
          // wrong is corrected. The site's `ends` has its say here too: the layer stopped at the end as the
          // hook left it, and is compared with the same.
          const ends: { from: End; to: End | null } = about.back
            ? { from: there, to: flight.f ?? null }
            : { from: flight.f ?? there, to: there };
          if (flight.f) morph.ends?.(ends, about);
          const stop = (about.back ? ends.from : ends.to) ?? there;
          if (!looksSame(flight.e, stop)) {
            await stage.travel(
              flight.e,
              stop,
              about,
              { ...stage.timing(leg), delay: 0, duration: CORRECTION_MS },
              false,
            );
          }
        } else {
          // It held still on the page left: the travel plays here, now the end is known.
          const ends: { from: End; to: End | null } = about.back
            ? { from: there, to: flight.e }
            : { from: flight.e, to: there };
          if (!isDeclined(morph.ends?.(ends, about))) {
            const start = (about.back ? ends.to : ends.from) ?? flight.e;
            const stop = (about.back ? ends.from : ends.to) ?? there;
            kind.fit?.(layer, stop);
            await stage.travel(start, stop, about, stage.timing(leg));
          }
        }
        // The real picture drawn before the swap, or the swap shows an empty frame.
        await whenDrawn(element);
      } catch (error) {
        reportError(error);
      } finally {
        stage.drop();
        clearLayer(placed);
      }
    },
    drop() {
      for (const animation of stage.siteAnimations.splice(0))
        animation.cancel();
      stage.live?.layer.remove();
      stage.live?.hidden.style.removeProperty("visibility");
      stage.live = null;
    },
  };

  const remove = defineMove(name, {
    match: (visit) =>
      morph.match ? morph.match(visit) : Boolean(morph.from?.(visit.link)),
    async leave(turn) {
      const element = morph.from?.(turn.link);
      // No storage, the layer cannot cross; a layer already out, one travel at a time.
      if (!element || !turn.canHandOver || stage.live) return turn.decline();
      const about = stage.about(turn.link, false);
      const ends: { from: End; to: End | null } = {
        from: stage.read(element),
        to: null,
      };
      for (const finder of finders) {
        try {
          ends.to ??= await finder(turn.to, morph.to, atRest);
        } catch (error) {
          reportError(error);
        }
      }
      if (isDeclined(morph.ends?.(ends, about))) return turn.decline();
      const { from, to } = ends;
      // Nothing to start from: an element that is not laid out, and no end given for it.
      if (from.box.width === 0 || from.box.height === 0) return turn.decline();
      const layer = await stage.put(element, from, to);
      // The page leaves while the layer travels.
      const leaving = turn.leaving();
      if (to) await stage.travel(from, to, about, stage.timing());
      await leaving;
      stage.hand({
        n: morph.arriveAs ?? name,
        m: name,
        h: markup(layer),
        e: to ?? from,
        ...(to ? { f: from } : {}),
        t: Boolean(to),
        s: morph.to,
      });
      let handover: Handover = {
        arriveAs: morph.arriveAs ?? name,
        data: (morph.data?.(turn) ?? null) as Json,
      };
      for (const add of stage.onLeave) {
        handover = {
          ...handover,
          ...add(turn, element, from, handover.data as Json),
        };
      }
      return handover;
    },
    stay(turn, stay) {
      isHandingOver = false;
      stage.drop();
      for (const tell of stage.onStay) tell(stay);
      morph.stay?.(turn, stay);
    },
  });

  for (const begin of [
    ...finders.map((finder) => finder.start),
    ...(morph.use ?? []),
  ]) {
    begin?.(stage);
  }
  const placed = handedOver();
  if (placed && !placed.taken && placed.flight.m === name) {
    stage.land(placed, () => onPage(morph.to), stage.about(null, false));
  }

  return () => {
    remove();
    defined.delete(name);
    for (const stop of stage.onRemove) stop();
  };
}
