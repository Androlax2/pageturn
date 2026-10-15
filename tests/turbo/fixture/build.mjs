/**
 * Builds the Turbo fixture: its pages, the same head on each (Turbo keeps it across
 * visits), and its module bundled into build/app.js.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
await mkdir(here("build"), { recursive: true });
await esbuild.build({
  entryPoints: [here("app.js")],
  bundle: true,
  format: "esm",
  outfile: here("build/app.js"),
  logLevel: "warning",
});

const NOTES = `<script>
  // What the tests read: the marks each time they change, and the events, in
  // sessionStorage, which lasts across the visit.
  window.note = (key, value) => {
    const notes = JSON.parse(sessionStorage.getItem("test-notes") || "[]");
    notes.push({ page: location.pathname, key, value });
    sessionStorage.setItem("test-notes", JSON.stringify(notes));
  };
  const root = document.documentElement;
  note("loaded", window.pageturn ? window.pageturn.arrival : "no head script");
  new MutationObserver(() =>
    note("marks", {
      leaving: root.dataset.turnLeaving ?? null,
      arriving: root.dataset.turnArriving ?? null,
      tone: root.style.getPropertyValue("--turn-tone") || null,
      preview: root.hasAttribute("data-turbo-preview"),
    }),
  ).observe(root, { attributeFilter: ["data-turn-leaving", "data-turn-arriving"] });
  // Read from the records: a browser may set and remove it in one task, before this runs.
  new MutationObserver((records) => {
    if (root.hasAttribute("data-turbo-preview") || records.some((r) => r.oldValue !== null)) {
      note("preview", location.pathname);
    }
  }).observe(root, { attributeFilter: ["data-turbo-preview"], attributeOldValue: true });
  document.addEventListener("pageturn:stayed", (event) =>
    note("stay", { move: event.detail.turn.move, reason: event.detail.stay.reason }));
  document.addEventListener("pageturn:arrived", (event) => note("arrived", event.detail));
</script>`;

const page = (name, body = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<script src="/dist/head-core.js"></script>
<title>${name}</title>
<link rel="stylesheet" href="/dist/no-native.css">
<style>@keyframes out { to { opacity: 0 } } html[data-turn-leaving] main { animation: out 300ms both }</style>
${NOTES}
<script type="module" src="/turbo/fixture/build/app.js"></script>
</head>
<body>
<nav>
<a id="to-a" href="/turbo/fixture/build/">a</a>
<a id="to-b" href="/turbo/fixture/build/b.html">b</a>
<a id="to-c" href="/turbo/fixture/build/c.html">c</a>
<a id="named" href="/turbo/fixture/build/b.html" data-turn="named">named</a>
<a id="tint" href="/turbo/fixture/build/c.html">tint</a>
<a id="card" href="/turbo/fixture/build/b.html">card</a>
<a id="reload" href="/turbo/fixture/build/c.html" data-turbo="false" data-turn="reloaded">reload</a>
</nav>
<main><h1>${name}</h1>${body}</main>
</body>
</html>
`;

await writeFile(here("build/index.html"), page("a"));
await writeFile(here("build/b.html"), page("b"));
await writeFile(
  here("build/c.html"),
  page(
    "c",
    `<button id="go" onclick="Turbo.visit('/turbo/fixture/build/b.html')">go to b</button>`,
  ),
);
