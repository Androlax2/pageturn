// The fixture app: three routes, the adapter, the moves, and a guard that can cancel.
import { defineMove, whenLeft } from "pageturn/core";
import { pageturn } from "pageturn/vue";
import { createApp, h } from "vue";
import {
  createRouter,
  createWebHistory,
  RouterLink,
  RouterView,
} from "vue-router";

const page = (name, extra = () => []) => ({
  render: () => h("div", [h("h1", name), ...extra()]),
});

const router = createRouter({
  history: createWebHistory("/vue/fixture/build/"),
  routes: [
    { path: "/", component: page("a") },
    { path: "/b", component: page("b") },
    {
      path: "/c",
      component: page("c", () => [
        h("button", { id: "go", onClick: () => router.push("/d") }, "go to d"),
      ]),
    },
    { path: "/d", component: page("d") },
  ],
});

pageturn(router);

// For the tests: the next navigation is aborted by a guard after the adapter's.
router.beforeEach(() => {
  if (window.cancelNext) {
    window.cancelNext = false;
    return false;
  }
});

defineMove("tint", {
  match: ({ link }) => link.id === "tint",
  leave: () => ({ data: { tone: "teal" } }),
  arrive: (arrival) => note("tint arrive", arrival),
});
defineMove("card", {
  match: ({ link }) => link.id === "card",
  leave: () => ({ returnAs: "card-back", remember: { y: 1 } }),
});
// Would match the push to /d if a navigation from code were taken for a link.
defineMove("to-d", { match: ({ to }) => to.pathname.endsWith("/d") });
defineMove("card-back", {
  arrive: (arrival) => note("card-back arrive", arrival),
});
whenLeft(() => ({ shown: true }));

const link = (id, to, attributes = {}) =>
  h(RouterLink, { id, to, ...attributes }, () => id);

createApp({
  render: () => [
    h("nav", [
      link("to-a", "/"),
      link("to-b", "/b"),
      link("to-c", "/c"),
      link("named", "/b", { "data-turn": "named" }),
      link("tint", "/c"),
      link("card", "/b"),
      link("hash", "/b#below"),
      h(
        "a",
        {
          id: "reload",
          href: "/vue/fixture/build/real.html",
          "data-turn": "reloaded",
        },
        "reload",
      ),
    ]),
    h("main", [h(RouterView)]),
  ],
})
  .use(router)
  .mount("#app");

router.isReady().then(() => {
  window.vueReady = true;
});
