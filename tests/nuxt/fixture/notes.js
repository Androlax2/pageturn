// What the tests read: the marks each time they change, and the events, in
// sessionStorage, which lasts across the visit.
window.note = (key, value) => {
  const notes = JSON.parse(sessionStorage.getItem("test-notes") || "[]");
  notes.push({ page: location.pathname, key, value });
  sessionStorage.setItem("test-notes", JSON.stringify(notes));
};
const root = document.documentElement;
note("loaded", window.pageturn ? window.pageturn.arrival : "no head script");
new MutationObserver(() =>
  note("marks", {
    leaving: root.dataset.turnLeaving ?? null,
    arriving: root.dataset.turnArriving ?? null,
    tone: root.style.getPropertyValue("--turn-tone") || null,
    preview: root.hasAttribute("data-turbo-preview"),
  }),
).observe(root, {
  attributeFilter: ["data-turn-leaving", "data-turn-arriving"],
});
new MutationObserver(() => {
  if (root.hasAttribute("data-turbo-preview"))
    note("preview", location.pathname);
}).observe(root, { attributeFilter: ["data-turbo-preview"] });
document.addEventListener("pageturn:stayed", (event) =>
  note("stay", {
    move: event.detail.turn.move,
    reason: event.detail.stay.reason,
  }),
);
document.addEventListener("pageturn:arrived", (event) =>
  note("arrived", event.detail),
);
