"use client";
// The fixture's links, its moves, and the flag the tests wait for.
import { defineMove, whenLeft } from "pageturn/core";
import { Link } from "pageturn/next";
import { useEffect } from "react";

defineMove("tint", {
  match: ({ link }) => link.id === "tint",
  leave: () => ({ data: { tone: "teal" } }),
  arrive: (arrival) => note("tint arrive", arrival),
});
defineMove("card", {
  match: ({ link }) => link.id === "card",
  leave: () => ({ returnAs: "card-back", remember: { y: 1 } }),
});
defineMove("slow", {
  match: ({ link }) => link.id === "slow",
  leave: () => new Promise((done) => setTimeout(done, 800)),
  stay: (_turn, stay) => note("slow stay", stay.reason),
});
// Would match the push to /d if a navigation from code were taken for a link.
defineMove("to-d", { match: ({ to }) => to.pathname.includes("/d") });
defineMove("card-back", {
  arrive: (arrival) => note("card-back arrive", arrival),
});
whenLeft(() => ({ shown: true }));

export default function Nav() {
  useEffect(() => {
    window.nextReady = true;
  }, []);
  return (
    <nav>
      <Link id="to-a" href="/">
        a
      </Link>
      <Link id="to-b" href="/b">
        b
      </Link>
      <Link id="to-c" href="/c">
        c
      </Link>
      <Link id="named" href="/b" data-turn="named">
        named
      </Link>
      <Link id="tint" href="/c">
        tint
      </Link>
      <Link id="card" href="/b">
        card
      </Link>
      <Link id="slow" href="/d">
        slow
      </Link>
      <Link id="hash" href="/b#below">
        hash
      </Link>
      <Link
        id="stopped"
        href="/b"
        onNavigate={(event) => event.preventDefault()}
      >
        stopped
      </Link>
      <a id="reload" href="/next/fixture/out/real.html" data-turn="reloaded">
        reload
      </a>
    </nav>
  );
}
