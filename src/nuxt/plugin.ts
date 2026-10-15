/**
 * The client plugin pageturn/nuxt adds: pageturn/vue on Nuxt's router, the page swapped
 * at page:finish, once Nuxt's <Suspense> has resolved and the page is in the DOM.
 */
import { pageturn, type VueRouter } from "../vue/vue.ts";

/**
 * Longest a page may take to say it is shown. Past it, the page reached arrives anyway,
 * rather than stay faded under its leave: a page whose Suspense never says so.
 */
const SHOWN_MAX_MS = 4000;

interface NuxtApp {
  $router: VueRouter;
  hooks: { hookOnce(name: "page:finish", hook: () => void): () => void };
}

export default function pageturnPlugin(nuxtApp: NuxtApp): void {
  pageturn(nuxtApp.$router, {
    whenShown(swap) {
      let isDone = false;
      const once = (): void => {
        if (isDone) return;
        isDone = true;
        swap();
      };
      nuxtApp.hooks.hookOnce("page:finish", once);
      setTimeout(once, SHOWN_MAX_MS);
    },
  });
}
