/**
 * The static server the tests and the examples run against: the built files under
 * /dist/, each part of the tests' fixtures and the examples, under the path each is
 * reached at. No dependency, and no cache header unless a test asks for one.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 4173);
const folder = (path) => fileURLToPath(new URL(path, import.meta.url));
/** Each address prefix, and the folder it is served from. */
const SERVED = {
  "/dist/": folder("../../dist/"),
  "/plain/": folder("../kernel/fixture/"),
  "/astro/": folder("../astro/fixture/"),
  "/examples/": folder("../../examples/"),
  "/sveltekit/": folder("../sveltekit/fixture/"),
  "/turbo/": folder("../turbo/"),
  "/vue/": folder("../vue/"),
  "/nuxt/": folder("../nuxt/"),
  "/react-router/": folder("../react-router/"),
  "/next/": folder("../next/"),
};
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

/** The file a request names, or nothing when it would leave the served folders. */
function fileFor(pathname) {
  const prefix = Object.keys(SERVED).find((start) =>
    pathname.startsWith(start),
  );
  if (!prefix) return null;
  const root = SERVED[prefix];
  const file = join(root, normalize(pathname.slice(prefix.length)));
  return `${file}/`.startsWith(root) ? file : null;
}

const isFolder = (path) =>
  stat(path).then(
    (found) => found.isDirectory(),
    () => false,
  );

const server = createServer(async (request, response) => {
  const { pathname } = new URL(
    request.url ?? "/",
    `http://${request.headers.host}`,
  );
  const named = fileFor(decodeURIComponent(pathname));
  // A folder is its index.html, at its address with a slash.
  if (named && !pathname.endsWith("/") && (await isFolder(named))) {
    response.writeHead(301, { Location: `${pathname}/` }).end();
    return;
  }
  const file =
    named && pathname.endsWith("/") ? join(named, "index.html") : named;
  try {
    if (!file || !(await stat(file)).isFile()) throw new Error("not a file");
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`Fixtures on http://localhost:${PORT}`);
});
