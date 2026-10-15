---
"pageturn": minor
---

Vue Router: `pageturn/vue` plays pageturn's moves on the router's navigations
(`<RouterLink>`, `router.push()`, Back and Forward). On any client router, a navigation
to a place in the same page plays no move, and one started from code plays the default
move rather than asking each move's `match`.
