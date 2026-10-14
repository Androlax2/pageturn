/** For head: "external". The files themselves are served by the head routes. */
import { hasMorph } from "virtual:pageturn/head";
import { headFirst } from "./middleware.js";

const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");

export const onRequest = headFirst(
  (pathname) =>
    `<script src="${base}_pageturn/${hasMorph(pathname) ? "head-morph" : "head"}.js"></script>`,
);
