/**
 * <questpass-booth-editor>: set up a booth (title, brand, logo, colours,
 * frames, text spaces, video and sharing) with a live preview, and get the
 * config as JSON. It never saves anything itself: the host page listens for
 * `change` (detail.config) and stores it wherever it keeps its own data.
 *
 *   <questpass-booth-editor brand-endpoint="/api/brand"></questpass-booth-editor>
 *
 * brand-endpoint (optional): your server's brand lookup (questpass-booth/server),
 * for "Fill in from website". Without it, the logo is uploaded by hand.
 * A logo picked here is redrawn as a PNG on the device (at most 512 px),
 * which also drops any hidden data in the file.
 */
import { type BoothConfig } from "../core/config";
export declare class EditorElement extends HTMLElement {
    static get observedAttributes(): string[];
    private root;
    private cfg;
    private configProp;
    private samples;
    private previewFrame;
    private previewRatio;
    private view;
    private json;
    private statusEl;
    private changeTimer;
    private site;
    private seq;
    constructor();
    get config(): BoothConfig;
    set config(v: unknown);
    connectedCallback(): void;
    attributeChangedCallback(_name: string, old: string | null, now: string | null): void;
    private loaded;
    private load;
    /** Change the config, redraw the preview, and tell the host (debounced). */
    private update;
    private status;
    private preview;
    private input;
    private urlValue;
    private check;
    private color;
    private build;
    private basics;
    private brand;
    private frames;
    private words;
    private videoAndSharing;
    private output;
    private previewControls;
}
