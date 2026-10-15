// The fixture app: a root route with pageturn's middleware and hook, its child routes,
// and the moves.
import { defineMove, whenLeft } from "pageturn/core";
import { pageturnMiddleware, usePageturn } from "pageturn/react-router";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  Link,
  Outlet,
  RouterProvider,
  useNavigate,
} from "react-router";

const page = (name) => () => h("h1", null, name);

function C() {
  const navigate = useNavigate();
  return h(
    "div",
    null,
    h("h1", null, "c"),
    h(
      "button",
      { id: "go", type: "button", onClick: () => navigate("/d") },
      "go to d",
    ),
  );
}

function Root() {
  usePageturn();
  const link = (id, to, attributes = {}) =>
    h(Link, { id, to, ...attributes }, id);
  return h(
    "div",
    null,
    h(
      "nav",
      null,
      link("to-a", "/"),
      link("to-b", "/b"),
      link("to-c", "/c"),
      link("named", "/b", { "data-turn": "named" }),
      link("tint", "/c"),
      link("card", "/b"),
      link("hash", "/b#below"),
      link("slow", "/slow"),
      h(
        "a",
        {
          id: "reload",
          href: "/react-router/fixture/build/real.html",
          "data-turn": "reloaded",
        },
        "reload",
      ),
    ),
    h("main", null, h(Outlet)),
  );
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: Root,
      middleware: [pageturnMiddleware],
      children: [
        { index: true, Component: page("a") },
        { path: "b", Component: page("b") },
        { path: "c", Component: C },
        { path: "d", Component: page("d") },
        {
          // Loads for a while: a navigation that another overtakes.
          path: "slow",
          loader: () =>
            new Promise((done) => setTimeout(() => done(null), 1500)),
          Component: page("slow"),
        },
      ],
    },
  ],
  { basename: "/react-router/fixture/build" },
);

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
  stay: (_turn, stay) => note("slow stay", stay.reason),
});
// Would match the navigate() to /d if a navigation from code were taken for a link.
defineMove("to-d", { match: ({ to }) => to.pathname.endsWith("/d") });
defineMove("card-back", {
  arrive: (arrival) => note("card-back arrive", arrival),
});
whenLeft(() => ({ shown: true }));

createRoot(document.getElementById("app")).render(
  h(RouterProvider, { router }),
);
requestAnimationFrame(() => {
  window.reactReady = true;
});
