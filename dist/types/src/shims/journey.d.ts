/**
 * Stands in for QuestPass's Journey engine. A booth has no boarding pass or
 * route map, so the route scene is empty (the engine only shows it for
 * event passes, never in a booth).
 */
import type { SponsorTheme } from "./sponsors";
export type RecapAvatar = {
    kind: "image";
    image: CanvasImageSource & {
        width: number;
        height: number;
    };
} | {
    kind: "emoji";
    emoji: string;
} | {
    kind: "initials";
    text: string;
} | {
    kind: "blockie";
    seed: string;
};
export interface JourneyInput {
    theme?: SponsorTheme | null;
    layout?: "collectible";
    name: string;
    handle?: string;
    avatar: RecapAvatar;
    role: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
    code: string;
    km: number;
    mode: "by bike" | "by car" | "by train" | "by air";
    landing: string;
    eventDates: string;
    ticket: string;
    traveller: number;
    early?: number;
    seat: string;
    siteHost: string;
}
export interface Scene {
    label: string;
    frames: number;
    draw(ctx: CanvasRenderingContext2D, f: number): void;
    delay?(f: number): number;
}
export declare function routeScene(_input: JourneyInput, _overlay?: boolean): Scene;
