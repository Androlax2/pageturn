/**
 * A client router as small as one can be, driving pageturn/router as an adapter would:
 * it catches same-origin links, fetches the page, waits for both the page and the leave,
 * swaps <main>, pushes the address, and says so in the same task. Back and Forward
 * swap too. It is the engine's reference adapter.
 *
 * window.go(to, move) navigates from code; window.routerFails makes the next one fail.
 * Notes, on the page first loaded: the marks just before and just after each swap.
 */
import type { PageSpec } from "../support/site.ts";

const ROUTER = `<script type="module">
  import { startNavigation } from "/dist/router.js";
  const root = document.documentElement;
  const marks = () => ({
    leaving: root.dataset.turnLeaving ?? null,
    arriving: root.dataset.turnArriving ?? null,
    entering: "turnEntering" in root.dataset,
    with: root.dataset.turnWith ?? null,
    tone: root.style.getPropertyValue("--turn-tone") || null,
  });
  let latest = 0;
  async function go(to, via, link = null, move) {
    const url = new URL(to, location.href);
    const navigation = startNavigation({ to: url, via, link, ...(move !== undefined ? { move } : {}) });
    const token = ++latest;
    const page = fetch(url).then((response) => response.text());
    const [html] = await Promise.all([page, navigation.left]);
    if (token !== latest) return;
    if (window.routerFails) {
      window.routerFails = false;
      navigation.cancelled();
      return;
    }
    const next = new DOMParser().parseFromString(html, "text/html");
    note("before swap", {
      ...marks(),
      running: document.getAnimations().filter((a) => a.playState === "running").length,
    });
    document.querySelector("main").replaceWith(document.importNode(next.querySelector("main"), true));
    document.title = next.title;
    if (via !== "history") history.pushState({}, "", url);
    navigation.swapped();
    note("after swap", { at: location.pathname, ...marks() });
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
    if (new URL(link.href).origin !== location.origin) return;
    event.preventDefault();
    go(link.href, "link", link);
  });
  addEventListener("popstate", () => go(location.href, "history"));
  window.go = (to, move) => go(to, "script", null, move);
  document.addEventListener("pageturn:arrived", (event) => note("arrived", event.detail));
  window.routerReady = true;
</script>`;

/** A page of a site whose client router plays pageturn's moves. */
export const routed = (spec: PageSpec = {}): PageSpec => ({
  kernel: "full",
  ...spec,
  head: `${ROUTER}${spec.head ?? ""}`,
});

/** A leave of 300 ms, on <main>. */
export const LEAVE_CSS = `
  @keyframes out { to { opacity: 0 } }
  html[data-turn-leaving] main { animation: out 300ms both }
`;
