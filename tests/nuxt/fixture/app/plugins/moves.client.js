// The fixture's moves, and what the tests drive: a guard that can abort the next
// navigation, after the adapter's, and a flag once the app is mounted.
import { defineMove, whenLeft } from "pageturn/core";

export default defineNuxtPlugin((nuxtApp) => {
  defineMove("tint", {
    match: ({ link }) => link.id === "tint",
    leave: () => ({ data: { tone: "teal" } }),
    arrive: (arrival) => note("tint arrive", arrival),
  });
  defineMove("card", {
    match: ({ link }) => link.id === "card",
    leave: () => ({ returnAs: "card-back", remember: { y: 1 } }),
  });
  defineMove("to-d", { match: ({ to }) => to.pathname.endsWith("/d") });
  defineMove("card-back", {
    arrive: (arrival) => note("card-back arrive", arrival),
  });
  whenLeft(() => ({ shown: true }));

  nuxtApp.$router.beforeResolve(() => {
    if (window.cancelNext) {
      window.cancelNext = false;
      return false;
    }
  });
  nuxtApp.hook("app:mounted", () => {
    window.nuxtReady = true;
  });
});
