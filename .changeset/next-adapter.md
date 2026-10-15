---
"pageturn": minor
---

Next.js: `pageturn/next` plays pageturn's moves on the App Router. Its `Link` (as
`next/link`) and `useTurnRouter()` (as `useRouter()`) play the leave before the router
navigates, and `<Pageturn />` in the root layout says when each page is in the DOM. On
any client router, the page reached is now recorded where the router shows it, base path
and trailing slash included, so a return by Back finds its `returnAs` there too.
