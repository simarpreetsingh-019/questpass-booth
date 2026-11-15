import type { FrameCtx } from "../engine/upstream/frames";
export type Network = "telegram" | "x" | "instagram";
export declare const NETWORKS: Record<Network, {
    label: string;
    color: string;
    mark: string;
    url: (u: string) => string;
}>;
export declare const isNetwork: (v: unknown) => v is Network;
/**
 * A username from whatever was typed or pasted: "@name", "t.me/name",
 * "https://x.com/name?s=20" → "name". Letters, digits, _ and . only, up to 32.
 */
export declare function cleanHandle(input: unknown): string;
/** The tag over the photo (drawn on every frame, after the frame itself). Nothing without a handle or a picture. */
export declare function drawTag(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
