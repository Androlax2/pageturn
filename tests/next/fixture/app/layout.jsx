import { coreHeadScript } from "pageturn/head";
import { Pageturn } from "pageturn/next";
import "pageturn/no-native.css";
import Nav from "./nav.jsx";
import notes from "./notes.js";

export default function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        {/*
          An inline script, run as the head is parsed: it marks the page before its first
          frame. Not next/script's beforeInteractive, which Next runs later, from its own code.
        */}
        <script dangerouslySetInnerHTML={{ __html: coreHeadScript }} />
        <script dangerouslySetInnerHTML={{ __html: notes }} />
        <style>
          {
            "@keyframes out { to { opacity: 0 } } html[data-turn-leaving] main { animation: out 300ms both }"
          }
        </style>
      </head>
      <body>
        <Pageturn />
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
