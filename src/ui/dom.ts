/** A tiny DOM helper and the shared parts of both elements. No innerHTML anywhere: text is always set as text. */
import { normalizeConfig, type BoothConfig } from "../core/config";

type Child = Node | string | number | false | null | undefined;
type Props = Record<string, unknown> & { class?: string; style?: Partial<CSSStyleDeclaration> | string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k in el && k !== "list" && k !== "type" && typeof v !== "string") (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el: Node) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Fire an event the host page can listen for: bubbles out of the shadow DOM. */
export function emit<T>(el: HTMLElement, name: string, detail: T) {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

/**
 * The config from the element: the `.config` property, else the `config`
 * attribute (JSON), else `config-src` (a URL to a JSON file, fetched without
 * cookies). Always checked and completed by normalizeConfig.
 */
export async function readConfig(el: HTMLElement, prop: unknown): Promise<BoothConfig> {
  if (prop !== undefined) return normalizeConfig(prop);
  const attr = el.getAttribute("config");
  if (attr) {
    try {
      return normalizeConfig(JSON.parse(attr));
    } catch {
      return normalizeConfig(null);
    }
  }
  const src = el.getAttribute("config-src");
  if (src) {
    try {
      const r = await fetch(new URL(src, document.baseURI), { credentials: "omit" });
      if (r.ok) return normalizeConfig(await r.json());
    } catch {
      // fall through to the defaults
    }
  }
  return normalizeConfig(null);
}

/** The booth's colours as CSS variables on its host. */
export function applyTheme(host: HTMLElement, c: BoothConfig) {
  const k = c.brand.colors;
  host.style.setProperty("--qp-accent", k.accent);
  host.style.setProperty("--qp-highlight", k.highlight);
  host.style.setProperty("--qp-base", k.base);
  host.style.setProperty("--qp-text", k.text);
}

/** Save a file the ordinary way (a download). */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Share a file with the phone's share sheet; false if this browser can't share files. */
export async function shareFile(blob: Blob, name: string, text: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], text });
  } catch (e) {
    // closing the share sheet isn't an error
    if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
  }
  return true;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "booth";
