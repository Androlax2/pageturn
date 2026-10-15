---
"pageturn": minor
---

SvelteKit: `pageturn/sveltekit` plays pageturn's moves on SvelteKit's own navigations
(links, `goto()`, Back and Forward), and `pageturn/sveltekit/server` puts the head script
in every page. Every module of pageturn can now be imported on a server, where it does
nothing: a framework's layouts run there too.
