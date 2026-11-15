/**
 * <questpass-booth>: the photo booth and video maker, on the phone.
 *
 *   <questpass-booth config-src="/booth.json"></questpass-booth>
 *
 * Photos never leave the device: the camera feed and the shots stay in
 * memory, and are gone when the page closes. The host page hears about
 * finished photos and videos through events (questpass:photo,
 * questpass:video) and decides what, if anything, to do with them.
 *
 * Camera privacy: it stops as soon as a shot is taken, when the page is
 * hidden or left, when the element is removed, and `camera.idleSeconds`
 * after it's opened, whatever is going on; "Turn off" stops it any time.
 */
import { type BoothConfig } from "../core/config";
export declare class BoothElement extends HTMLElement {
    static get observedAttributes(): string[];
    private root;
    private cfg;
    private configProp;
    private shots;
    private samples;
    private frame;
    private ratio;
    private palette;
    private caption;
    private name;
    private typed;
    private hd;
    private stream;
    private facing;
    private cameraTurn;
    private idleTimer;
    private raf;
    private busy;
    private view;
    private feed;
    private grab;
    private countEl;
    private flashEl;
    private controls;
    private panel;
    private statusEl;
    private videoUrl;
    private previewer;
    private renderSeq;
    constructor();
    /** The booth's settings (any JSON; checked and completed). Setting it redraws the booth. */
    get config(): BoothConfig | undefined;
    set config(v: unknown);
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(_name: string, old: string | null, now: string | null): void;
    private onHidden;
    private loaded;
    private load;
    private status;
    private build;
    private live;
    private renderControls;
    private fileButton;
    private renderPanel;
    private text;
    private frameChip;
    private actions;
    private needed;
    /** What a frame shows: the shots (newest first), else the samples repeated to fill it. */
    private shown;
    private set;
    private redraw;
    private options;
    private fileName;
    private save;
    private addShot;
    private removeShot;
    private addFiles;
    private startCamera;
    /** Really off: every track stopped (the camera light goes out) and the video let go. */
    stopCamera: () => void;
    private flip;
    /** The camera's picture now (mirrored for the front camera, like a mirror). */
    private frameOfVideo;
    private loop;
    private shoot;
    private videoCard;
}
