/**
 * The elements' styles, inside their shadow roots (so they never clash with
 * the host page). Colours come from the booth's config as CSS variables;
 * a host can still override them on the element: questpass-booth { --qp-accent: … }.
 * Phone first: one column, big tap targets (44 px+), no hover-only controls.
 */
export const CSS = `
:host {
  --qp-accent: #38FF9C;
  --qp-highlight: #FFC440;
  --qp-base: #0E0E0E;
  --qp-text: #F5F5F0;
  --qp-radius: 14px;
  display: block;
  color: var(--qp-text);
  background: var(--qp-base);
  font: 15px/1.45 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  border-radius: var(--qp-radius);
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
* { box-sizing: border-box; }
.wrap { max-width: 560px; margin: 0 auto; padding: 16px; display: grid; gap: 14px; }
.head { display: flex; align-items: center; gap: 10px; min-height: 40px; }
.head img { height: 32px; max-width: 120px; object-fit: contain; }
.head h2 { margin: 0; font: 800 20px/1.1 var(--qp-heading, Inter, system-ui, sans-serif); letter-spacing: -.01em; }
.card h3, details.card > summary { font-family: var(--qp-heading, Inter, system-ui, sans-serif); }
.head .sub { font-size: 12px; opacity: .7; }
.stage { position: relative; display: grid; place-items: center; background: color-mix(in srgb, var(--qp-text) 6%, var(--qp-base)); border-radius: var(--qp-radius); padding: 10px; }
.stage canvas { display: block; width: 100%; height: auto; max-height: 68vh; object-fit: contain; border-radius: 6px; }
.stage video.feed { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.count { position: absolute; inset: 0; display: grid; place-items: center; font-size: 96px; font-weight: 900; color: #fff; text-shadow: 0 4px 24px rgba(0,0,0,.6); pointer-events: none; }
.flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; transition: opacity .18s; }
.flash.on { opacity: .85; transition: none; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.row.scroll { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
.row.center { justify-content: center; }
button, .btn { font: inherit; min-height: 44px; padding: 10px 16px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--qp-text) 22%, transparent); background: transparent; color: var(--qp-text); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; }
button:disabled { opacity: .45; cursor: default; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, .chip:focus-visible { outline: 2px solid var(--qp-accent); outline-offset: 2px; }
.primary { background: var(--qp-accent); color: var(--qp-on-accent, #111); border-color: transparent; font-weight: 800; font-family: var(--qp-heading, inherit); letter-spacing: .01em; }
.big { min-height: 52px; font-size: 16px; padding: 12px 22px; }
.wide { width: 100%; }
.shutter { width: 76px; height: 76px; border-radius: 50%; padding: 0; background: #fff; border: 6px solid var(--qp-accent); box-shadow: 0 0 0 2px rgba(0,0,0,.3); }
.small { min-height: 36px; padding: 6px 12px; font-size: 13px; }
.chip { flex: 0 0 auto; display: grid; gap: 4px; justify-items: center; padding: 6px; border-radius: 12px; border: 2px solid transparent; background: color-mix(in srgb, var(--qp-text) 6%, transparent); color: inherit; font: 600 12px/1.2 Inter, system-ui, sans-serif; cursor: pointer; min-height: 44px; }
.chip[aria-pressed="true"] { border-color: var(--qp-accent); }
.chip canvas { width: 72px; height: auto; border-radius: 4px; background: #222; }
.swatch { width: 44px; height: 44px; border-radius: 50%; border: 3px solid transparent; padding: 0; }
.swatch[aria-pressed="true"] { border-color: var(--qp-text); }
label.field { display: grid; gap: 4px; font-size: 13px; font-weight: 600; }
label.field .hint { font-weight: 400; opacity: .65; font-size: 12px; }
input[type=text], input[type=url], input[type=number], select, textarea { font: inherit; font-size: 16px; width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--qp-text) 20%, transparent); background: color-mix(in srgb, var(--qp-text) 5%, var(--qp-base)); color: var(--qp-text); }
textarea { min-height: 120px; font: 12px/1.4 ui-monospace, "IBM Plex Mono", monospace; }
input[type=color] { width: 52px; height: 44px; border: 0; padding: 0; background: none; }
input[type=checkbox] { width: 22px; height: 22px; accent-color: var(--qp-accent); }
.check { display: flex; gap: 10px; align-items: center; min-height: 44px; font-size: 14px; }
.card { border: 1px solid color-mix(in srgb, var(--qp-text) 14%, transparent); border-radius: var(--qp-radius); padding: 14px; display: grid; gap: 12px; }
.card h3 { margin: 0; font-size: 15px; }
details.card > summary { cursor: pointer; font-weight: 800; min-height: 28px; list-style: none; }
details.card > summary::after { content: " ▾"; opacity: .6; }
details.card[open] > summary::after { content: " ▴"; }
.note { font-size: 12px; opacity: .7; margin: 0; }
.status { font-size: 13px; min-height: 18px; }
.status.err { color: #FF8A8A; }
.thumbs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.thumb { position: relative; flex: 0 0 auto; }
.thumb img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; display: block; }
.thumb .n { position: absolute; left: 4px; top: 4px; min-width: 22px; height: 22px; border-radius: 11px; background: rgba(0,0,0,.7); color: #fff; font: 700 12px/22px Inter, sans-serif; text-align: center; }
.thumb .x { position: absolute; right: -6px; top: -6px; min-height: 0; width: 28px; height: 28px; padding: 0; background: rgba(0,0,0,.8); color: #fff; border: 0; font-size: 14px; }
.order { display: grid; gap: 8px; }
.order .item { display: grid; grid-template-columns: 56px 1fr auto; gap: 10px; align-items: center; }
.order .item img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; }
.order .item .moves { display: flex; gap: 4px; }
.order .item .moves button { min-height: 40px; width: 40px; padding: 0; }
progress { width: 100%; height: 10px; accent-color: var(--qp-accent); }
video.result { width: 100%; max-height: 60vh; border-radius: 8px; background: #000; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.frames-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px 12px; }
.slot { display: grid; grid-template-columns: 1fr; gap: 6px; padding: 10px 0; border-top: 1px solid color-mix(in srgb, var(--qp-text) 10%, transparent); }
.slot .modes { display: flex; gap: 6px; flex-wrap: wrap; }
.credit { text-align: center; font-size: 11px; opacity: .55; }
.credit a { color: inherit; }
/* phones: the preview stays in view at the top while you edit */
.editor .side { position: sticky; top: 0; z-index: 2; background: var(--qp-base); padding-bottom: 8px; }
.editor .side .stage canvas { max-height: 34vh; }
@media (min-width: 900px) {
  .editor { max-width: 1100px; grid-template-columns: minmax(0, 1fr) 380px; align-items: start; }
  .editor .side { grid-column: 2; grid-row: 1; top: 16px; }
  .editor .side .stage canvas { max-height: 70vh; }
}
@media (prefers-reduced-motion: reduce) { .flash { transition: none; } }
`;

let sheet: CSSStyleSheet | null = null;

/** Put the styles into a shadow root (a shared constructed sheet where supported; CSP-friendly, no inline style attribute). */
export function adoptStyles(root: ShadowRoot) {
  try {
    sheet ??= new CSSStyleSheet();
    if (!sheet.cssRules.length) sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const s = document.createElement("style");
    s.textContent = CSS;
    root.appendChild(s);
  }
}
