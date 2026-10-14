// One script for both pages. With a bundler: import { back, defineMorph, text } from "pageturn/morph".
const { back, defineMorph, text } = window.pageturn.morph;

defineMorph("contact", {
  // The element that travels: the button, when it is the link clicked.
  from: (link) => (link.matches(".cta .button") ? link : null),
  // What it becomes on the page reached.
  to: "h1.title",
  // Words, set again at every frame: the pill's box becomes the title's.
  as: text(),
  // And back into the button on the browser's Back.
  use: [back()],
});
