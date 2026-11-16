/**
 * questpass-booth/config: the settings functions without the screens, for
 * Node scripts (e.g. making one booth per city from a spreadsheet).
 */
import "../packs/pizza";
export { VERSION } from "./version";
export { CONFIG_VERSION, defaultConfig, normalizeConfig, migrateConfig, offeredFrames, listWordSlots, shareTextOf, type BoothConfig } from "./config";
export { listFrames } from "./frames-meta";
export { PIZZA_PACK } from "../packs/pizza";
