// Draws every frame the settings offer, at one size, with sample photos.
import { drawPreview, listFrames, normalizeConfig, offeredFrames, samplePhotos } from "./dist/questpass-booth.js";

const params = new URLSearchParams(location.search);
const ratio = params.get("ratio") || "";
const only = params.get("pack");
const config = normalizeConfig(await (await fetch(params.get("config") || "pizzadao.json")).json());
const photos = await samplePhotos();
const meta = new Map(listFrames().map((f) => [f.id, f]));
const nav = document.getElementById("sizes");
for (const [r, label] of [["", "Usual size"], ["9:16", "Story"], ["4:5", "Post"], ["1:1", "Square"], ["16:9", "Wide"]]) {
  const b = document.createElement("button");
  b.textContent = label;
  b.setAttribute("aria-pressed", String(r === ratio));
  b.onclick = () => { params.set("ratio", r); location.search = params.toString(); };
  nav.appendChild(b);
}
const grid = document.getElementById("grid");
for (const id of offeredFrames(config)) {
  const m = meta.get(id);
  if (only && m.pack !== only) continue;
  const fig = document.createElement("figure");
  const c = document.createElement("canvas");
  const cap = document.createElement("figcaption");
  cap.textContent = `${m.label} · ${m.best}`;
  fig.append(c, cap);
  grid.appendChild(fig);
  await drawPreview(c, 540, { config, photos, frame: id, ratio: ratio || undefined, name: "Chorizo Corleone", caption: "Extra cheese, no regrets" });
}
