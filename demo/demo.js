// The demo page: switch tabs, give the editor's settings to the booth, and log the booth's events.
const booth = document.querySelector("questpass-booth");
const editor = document.querySelector("questpass-booth-editor");
const log = document.getElementById("log");
// the event log is for developers: shown only with ?debug in the address
log.hidden = !new URLSearchParams(location.search).has("debug");
const say = (s) => (log.textContent = `${new Date().toLocaleTimeString()}  ${s}\n${log.textContent}`.slice(0, 2000));

for (const b of document.querySelectorAll("nav button")) {
  b.addEventListener("click", () => {
    for (const x of document.querySelectorAll("nav button")) x.setAttribute("aria-pressed", String(x === b));
    for (const s of document.querySelectorAll("main section")) s.hidden = s.id !== b.dataset.tab;
  });
}
editor.addEventListener("change", (e) => {
  booth.config = e.detail.config;
  say("editor: settings changed (the booth now uses them)");
});
for (const ev of ["questpass:ready", "questpass:photo", "questpass:video", "questpass:share", "questpass:camera", "questpass:error"]) {
  booth.addEventListener(ev, (e) => {
    const d = { ...e.detail };
    if (d.blob) d.blob = `${d.blob.type}, ${Math.round(d.blob.size / 1024)} KB`;
    say(`${ev} ${JSON.stringify(d)}`);
  });
}
