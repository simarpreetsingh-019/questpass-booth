export type AvatarNetwork = "telegram" | "x";
export interface AvatarOptions {
    /** look up X pictures through fxtwitter.com (unofficial; default off) */
    x?: boolean;
    timeoutMs?: number;
    userAgent?: string;
}
export declare class AvatarNotFoundError extends Error {
    constructor(msg: string);
}
/** The profile picture as a data URL. */
export declare function fetchAvatar(network: string, username: string, opts?: AvatarOptions): Promise<string>;
