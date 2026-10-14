---
"pageturn": minor
---

`pageturn/router`: the engine that plays pageturn's moves on a client router's
navigations, for the adapters to drive (`startNavigation`, then `left`, `swapped` or
`cancelled`). `Visit` gains `via`, and `Stay.reason` can be `"cancelled"` or
`"superseded"`.
