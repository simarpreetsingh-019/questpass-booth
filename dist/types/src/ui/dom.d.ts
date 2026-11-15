/** A tiny DOM helper and the shared parts of both elements. No innerHTML anywhere: text is always set as text. */
import { type BoothConfig } from "../core/config";
type Child = Node | string | number | false | null | undefined;
type Props = Record<string, unknown> & {
    class?: string;
    style?: Partial<CSSStyleDeclaration> | string;
};
export declare function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K];
export declare function append(el: Node, children: Child[]): void;
export declare function clear(el: Node): void;
/** Fire an event the host page can listen for: bubbles out of the shadow DOM. */
export declare function emit<T>(el: HTMLElement, name: string, detail: T): void;
/**
 * The config from the element: the `.config` property, else the `config`
 * attribute (JSON), else `config-src` (a URL to a JSON file, fetched without
 * cookies). Always checked and completed by normalizeConfig.
 */
export declare function readConfig(el: HTMLElement, prop: unknown): Promise<BoothConfig>;
/** The booth's colours as CSS variables on its host. */
export declare function applyTheme(host: HTMLElement, c: BoothConfig): void;
/** Save a file the ordinary way (a download). */
export declare function download(blob: Blob, name: string): void;
/** Share a file with the phone's share sheet; false if this browser can't share files. */
export declare function shareFile(blob: Blob, name: string, text: string): Promise<boolean>;
export declare const slug: (s: string) => string;
export {};
