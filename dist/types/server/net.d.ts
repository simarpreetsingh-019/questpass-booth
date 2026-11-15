import { type LookupFunction } from "node:net";
export declare class BlockedAddressError extends Error {
    constructor(what: string);
}
/** True for an address on the public internet (not private, loopback, link-local, reserved…). */
export declare function isPublicAddress(ip: string): boolean;
/** A DNS lookup that refuses names resolving to any non-public address. */
export declare const guardedLookup: LookupFunction;
/** A URL we're willing to request: http(s), standard port, no credentials, not a private IP literal. */
export declare function checkUrl(raw: string | URL): URL;
export interface Fetched {
    url: URL;
    status: number;
    type: string;
    body: Buffer;
}
export interface GetOptions {
    maxBytes: number;
    timeoutMs: number;
    accept: string;
    userAgent: string;
}
/** GET a public URL within the limits above. */
export declare function safeGet(raw: string | URL, o: GetOptions, redirects?: number): Promise<Fetched>;
