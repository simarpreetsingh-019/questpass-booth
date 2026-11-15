// The demo page: switch tabs, give the editor's settings to the booth, and log the booth's events.
const booth = document.querySelector("questpass-booth");
const editor = document.querySelector("questpass-booth-editor");
// where to start: the Pizza DAO theme (default) or a blank booth (?start=blank)
const start = new URLSearchParams(location.search).get("start") === "blank" ? null : "pizzadao.json";
if (start) {
  fetch(start).then((r) => r.json()).then((c) => {
    editor.config = c;
    booth.config = c;
  });
} else {
  editor.config = {};
  booth.config = {};
}

// the lookups need the demo's own server (npm run demo); a static copy (GitHub Pages) has none
if (location.port === "8787") {
  booth.setAttribute("avatar-endpoint", "/api/avatar");
  editor.setAttribute("brand-endpoint", "/api/brand");
}
// the organisers' main action: save the settings file (booth-base.json) to put in the repo
const save = document.createElement("button");
save.textContent = "⬇ Save settings file";
save.style.cssText = "background:#eee;color:#111;font-weight:700";
save.onclick = () => {
  const blob = new Blob([JSON.stringify(editor.config, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "booth-base.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
document.querySelector("nav").appendChild(save);
const log = document.getElementById("log");
// the event log is for developers: shown only with ?debug in the address
log.hidden = !new URLSearchParams(location.search).has("debug");
const say = (s) => (log.textContent = `${new Date().toLocaleTimeString()}  ${s}\n${log.textContent}`.slice(0, 2000));

for (const b of document.querySelectorAll("nav button[data-tab]")) {
  b.addEventListener("click", () => {
    for (const x of document.querySelectorAll("nav button[data-tab]")) x.setAttribute("aria-pressed", String(x === b));
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
