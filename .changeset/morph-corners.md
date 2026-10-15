---
"pageturn": patch
---

pageturn/morph reads each corner as it is seen: a parent that clips the picture (a card
with `overflow: hidden` and round corners) rounds the layer's corners too, so the travel
no longer starts square and ends with the corners popping in. An end's `radius` may now
be four corners, from the top-left clockwise; a site's `ends` that does arithmetic on
it should read it through `typeof radius === "number"`.
