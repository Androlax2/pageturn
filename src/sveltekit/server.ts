/**
 * pageturn/sveltekit/server: the head script first in every page SvelteKit renders, for
 * hooks.server.ts:
 *
 *   import { pageturnHandle } from "pageturn/sveltekit/server";
 *   export const handle = pageturnHandle();
 *
 * With other hooks, in sequence() from @sveltejs/kit/hooks. Under a Content-Security-Policy,
 * add headScriptHash (or coreHeadScriptHash) from pageturn/head to kit.csp's script-src.
 */
import {
  coreHeadScript,
  headScript,
  morphHeadScript,
} from "../head/head-string.js";

export interface PageturnHandleOptions {
  /**
   * The head script with its native half, for a site that loads pageturn.css. false:
   * without it, for no-native.css or a site's own CSS. Default true.
   */
  native?: boolean;
  /** The morph's head half too, for a site using pageturn/morph. Default false. */
  morph?: boolean;
}

/** As much of SvelteKit's Handle as this needs. */
type Handle = (input: {
  event: unknown;
  resolve: (
    event: unknown,
    options?: {
      transformPageChunk?: (input: { html: string }) => string | undefined;
    },
  ) => Response | Promise<Response>;
}) => Response | Promise<Response>;

/** A handle that puts the head script right after <head> and its charset. */
export function pageturnHandle({
  native = true,
  morph = false,
}: PageturnHandleOptions = {}): Handle {
  const script = `<script>${native ? headScript : coreHeadScript}</script>${
    morph ? `<script>${morphHeadScript}</script>` : ""
  }`;
  return ({ event, resolve }) =>
    resolve(event, {
      // The head is in the first chunk; the later ones have no <head> to match.
      transformPageChunk: ({ html }) =>
        html.replace(
          /<head(\s[^>]*)?>(\s*<meta\s+charset[^>]*>)?/i,
          (opening) => `${opening}${script}`,
        ),
    });
}
