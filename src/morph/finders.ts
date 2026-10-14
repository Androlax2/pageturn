/**
 * The core's finders: how the page left learns the other end before the page changes.
 * `peek()`, which looks at the destination, is its own part (peek.ts).
 */
import { readSession, writeSession } from "../common/session.ts";
import { shifted } from "./end.ts";
import { type End, MORPH_KEY, onPage } from "./place.ts";
import type { Finder } from "./types.ts";

const SEEN_KEY = `${MORPH_KEY}:seen:`;

/** This page's own element matching `to`, the page at its top: for a shared template. */
export function here(): Finder {
  return (_to, selector, measure) => {
    const element = onPage(selector);
    return element && shifted(measure(element), scrollX, scrollY);
  };
}

/** One record per window size: where an element is drawn depends on it. */
const seenKey = (selector: string): string =>
  `${SEEN_KEY}${selector}:${innerWidth}x${innerHeight}`;

/** The pages that showed it, each with where: the last shown last. */
type Seen = Record<string, End>;

/** How many pages are remembered: a template's few, not a whole visit. */
const SEEN_PAGES = 20;

/**
 * Where a page last showed it in this tab, at this window's size: the page the link leads
 * to if it did, or else the last other page, of the same template as like as not. Never
 * the page being left, which shows the name too when the element that travels has it.
 */
export function seen(): Finder {
  const finder: Finder = (to, selector) => {
    const pages = readSession<Seen>(seenKey(selector)) ?? {};
    const others = Object.keys(pages).filter(
      (path) => path !== location.pathname,
    );
    return pages[to.pathname] ?? pages[others[others.length - 1] ?? ""] ?? null;
  };
  // Says where this page shows the element, once the page has come to rest.
  finder.start = ({ morph, atRest }) => {
    const say = () => {
      const element = onPage(morph.to);
      if (!element) return;
      const end = atRest(element);
      if (end.box.width > 0) {
        const key = seenKey(morph.to);
        const { [location.pathname]: _, ...pages } =
          readSession<Seen>(key) ?? {};
        const kept = Object.entries(pages).slice(1 - SEEN_PAGES);
        writeSession(key, {
          ...Object.fromEntries(kept),
          [location.pathname]: shifted(end, scrollX, scrollY),
        });
      }
    };
    if (document.readyState === "complete") say();
    else addEventListener("load", say, { once: true });
  };
  return finder;
}
