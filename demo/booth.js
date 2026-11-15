// The public booth page: the picture lookup when the demo's own server is running, and the event log with ?debug.
const booth = document.querySelector("questpass-booth");
if (location.port === "8787") booth.setAttribute("avatar-endpoint", "/api/avatar");
const log = document.getElementById("log");
log.hidden = !new URLSearchParams(location.search).has("debug");
for (const ev of ["questpass:ready", "questpass:photo", "questpass:video", "questpass:share", "questpass:camera", "questpass:error"]) {
  booth.addEventListener(ev, (e) => {
    const d = { ...e.detail };
    if (d.blob) d.blob = `${d.blob.type}, ${Math.round(d.blob.size / 1024)} KB`;
    log.textContent = `${new Date().toLocaleTimeString()}  ${ev} ${JSON.stringify(d)}\n${log.textContent}`.slice(0, 2000);
  });
}
