/** For head: "inline". */
import { headFor } from "virtual:pageturn/head";
import { headFirst } from "./middleware.js";

export const onRequest = headFirst(
  (pathname) => `<script>${headFor(pathname)}</script>`,
);
