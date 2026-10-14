/** For head: "external". Serves the head script with its morph half as a file. */
import { morphedHeadScript } from "virtual:pageturn/head";

export const prerender = true;

export function GET() {
  return new Response(morphedHeadScript, {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
}
