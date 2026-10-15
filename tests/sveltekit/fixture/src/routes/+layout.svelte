<script>
import "pageturn/no-native.css";
import { defineMove, whenLeft } from "pageturn/core";
import { pageturn } from "pageturn/sveltekit";
import { onMount } from "svelte";
import { beforeNavigate, onNavigate } from "$app/navigation";
import { resolve } from "$app/paths";

let { children } = $props();

pageturn({ beforeNavigate, onNavigate });
// Hydrated: SvelteKit handles the links from now on.
onMount(() => {
  window.kitReady = true;
});

// For the tests: the next navigation is cancelled by another beforeNavigate.
beforeNavigate((navigation) => {
  if (window.cancelNext) {
    window.cancelNext = false;
    navigation.cancel();
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
defineMove("card-back", {
  arrive: (arrival) => note("card-back arrive", arrival),
});
whenLeft(() => ({ shown: true }));
</script>

<nav>
  <a id="to-a" href={resolve("/")}>a</a>
  <a id="to-b" href={resolve("/b/")}>b</a>
  <a id="to-c" href={resolve("/c/")}>c</a>
  <a id="named" href={resolve("/b/")} data-turn="named">named</a>
  <a id="tint" href={resolve("/c/")}>tint</a>
  <a id="card" href={resolve("/b/")}>card</a>
  <a id="reload" href={resolve("/c/")} data-sveltekit-reload data-turn="reloaded">reload</a>
</nav>
<main>{@render children()}</main>

<style>
  @keyframes -global-out { to { opacity: 0; } }
  :global(html[data-turn-leaving] main) { animation: out 300ms both; }
</style>
