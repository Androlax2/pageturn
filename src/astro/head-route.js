/** For head: "external". Serves the head script as a file. */
import { headScript } from "virtual:pageturn/head";

export const prerender = true;

export function GET() {
  return new Response(headScript, {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
}
