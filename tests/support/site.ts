/**
 * Pages described in the test itself, served under /t/ by a route, with the real built
 * files from /dist/. Each page notes what it sees in sessionStorage, so a test can read
 * what happened on a page it has already left.
 */
import type { BrowserContext, Page, Route } from "@playwright/test";

/**
 * How the page loads pageturn:
 * - "classic" (default): pageturn.js, the head script and full kernel in one;
 * - "full": the head script with its native half, and the full ESM entry;
 * - "core": the head script without it, and pageturn/core;
 * - "no-head": pageturn/core alone, with no head script;
 * - "dev", "dev-no-head": the same as "core" and "no-head", from the development build
 *   (dist/dev/), which warns.
 */
export type Kernel =
  | "classic"
  | "full"
  | "core"
  | "no-head"
  | "dev"
  | "dev-no-head";

const KERNELS: Record<Kernel, string> = {
  classic: `<script src="/dist/pageturn.js"></script>`,
  full: `<script src="/dist/head.js"></script><script type="module" src="/dist/index.js"></script>`,
  core: `<script src="/dist/head-core.js"></script><script type="module" src="/dist/core.js"></script>`,
  "no-head": `<script type="module" src="/dist/core.js"></script>`,
  dev: `<script src="/dist/head-core.js"></script><script type="module" src="/dist/dev/core.js"></script>`,
  "dev-no-head": `<script type="module" src="/dist/dev/core.js"></script>`,
};

export interface PageSpec {
  /** "no-native" (default), "pageturn", or "none". */
  sheet?: "no-native" | "pageturn" | "none";
  kernel?: Kernel;
  /** Extra CSS, in a <style> in the head. */
  css?: string;
  /** Extra HTML in the head, after pageturn.js. */
  head?: string;
  /** HTML in <main>, after the links to every other page. */
  body?: string;
  /** A classic script at the end of the body: the page's moves and choosers. */
  script?: string;
  /** Response headers. */
  headers?: Record<string, string>;
  /** Replaces the whole document. */
  html?: string;
  /** Answers 204 No Content: the browser stays on the page left, as when it is stuck. */
  stays?: boolean;
}

export interface Site {
  /** When each page was last requested (Date.now() in the test process). */
  requestedAt: Map<string, number>;
  /** How many times each page was requested. */
  requests: Map<string, number>;
}

const NOTES = `<script>
  window.note = (key, value) => {
    const notes = JSON.parse(sessionStorage.getItem("test-notes") || "[]");
    notes.push({ page: location.pathname, key, value });
    sessionStorage.setItem("test-notes", JSON.stringify(notes));
  };
  note("arrival", window.pageturn ? window.pageturn.arrival : "no head script");
  note("arriving", document.documentElement.dataset.turnArriving ?? null);
  new MutationObserver(() => {
    const name = document.documentElement.dataset.turnLeaving;
    if (name) note("leaving", name);
  }).observe(document.documentElement, { attributeFilter: ["data-turn-leaving"] });
  document.addEventListener("pageturn:stayed", (event) =>
    note("stay", { move: event.detail.turn.move, reason: event.detail.stay.reason }));
</script>`;

function render(name: string, spec: PageSpec, names: string[]): string {
  if (spec.html) return spec.html;
  const sheet = spec.sheet ?? "no-native";
  const links = names
    .map((other) => `<a id="to-${other}" href="/t/${other}">${other}</a>`)
    .join(" ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${name}</title>
${sheet === "none" ? "" : `<link rel="stylesheet" href="/dist/${sheet}.css">`}
<style>body { margin: 0; font: 16px system-ui } main { display: block; min-height: 200px } ${spec.css ?? ""}</style>
${KERNELS[spec.kernel ?? "classic"]}
${NOTES}
${spec.head ?? ""}
</head>
<body>
<nav>${links}</nav>
<main><h1>${name}</h1>${spec.body ?? ""}</main>
<script>${spec.script ?? ""}</script>
</body>
</html>`;
}

export async function serve(
  context: BrowserContext,
  pages: Record<string, PageSpec>,
): Promise<Site> {
  const site: Site = { requestedAt: new Map(), requests: new Map() };
  const names = Object.keys(pages);
  // A query is the same page: a test may link to it with another query.
  await context.route(/\/t\/[^/?#]+(\?[^#]*)?$/, async (route: Route) => {
    const name = new URL(route.request().url()).pathname.slice(3);
    site.requestedAt.set(name, Date.now());
    site.requests.set(name, (site.requests.get(name) ?? 0) + 1);
    const spec = pages[name];
    if (!spec) return route.fulfill({ status: 404, body: "Not found" });
    if (spec.stays) return route.fulfill({ status: 204 });
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...spec.headers },
      body: render(name, spec, names),
    });
  });
  return site;
}

declare global {
  /** Defined on every test page, for code the tests run in it. */
  function note(key: string, value: unknown): void;
}

export interface Note {
  page: string;
  key: string;
  value: unknown;
}

export const notes = (page: Page): Promise<Note[]> =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("test-notes") || "[]"));

/** The last value noted under key, on the page at path. */
export async function noted(
  page: Page,
  path: string,
  key: string,
): Promise<unknown> {
  const all = (await notes(page)).filter(
    (note) => note.page === path && note.key === key,
  );
  return all.at(-1)?.value;
}

export interface ClickInit {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** Dispatches a click from script and tells whether the kernel took it. */
export const isHandled = (
  page: Page,
  selector: string,
  init: ClickInit = {},
): Promise<boolean> =>
  page.evaluate(
    ([selector, init]) => {
      const target = document.querySelector(selector);
      if (!target) throw new Error(`no ${selector}`);
      // Stops the navigation the click would start, after the kernel has had its say.
      addEventListener(
        "click",
        () =>
          addEventListener(
            "click",
            (event) => Event.prototype.preventDefault.call(event),
            { once: true },
          ),
        { capture: true, once: true },
      );
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
        ...init,
      });
      let handledByKernel = false;
      const realPrevent = event.preventDefault.bind(event);
      event.preventDefault = () => {
        handledByKernel = true;
        realPrevent();
      };
      target.dispatchEvent(event);
      return (
        handledByKernel || "turnLeaving" in document.documentElement.dataset
      );
    },
    [selector, init] as const,
  );
