/**
 * QuestPass Booth: the public interface. Everything exported here is
 * covered by semantic versioning (see docs/versioning.md): within a major
 * version, nothing is removed or renamed and new options are optional.
 *
 * Importing this module also defines the two custom elements,
 * <questpass-booth> and <questpass-booth-editor> (see src/ui).
 */
export { VERSION } from "./version";
export { CONFIG_VERSION, defaultConfig, normalizeConfig, migrateConfig, offeredFrames, listWordSlots, shareTextOf, type BoothConfig, type BoothColors, type WordMode, } from "./config";
export { listFrames, TOP_PICKS, type FrameMeta } from "./frames-meta";
export { drawPreview, createPreviewer, renderPhoto, makeVideo, listTracks, framePalettes, toBitmap, photosFor, RATIO_SIZES, type FrameOptions, type VideoOptions, type PhotoSource, type PaletteChoice, type FrameId, type Ratio } from "./render";
export { colorsFromImage, CREDIT_LINE } from "./brand";
export { setFontsBase } from "./fonts";
export { samplePhotos } from "./samples";
export { BoothElement, EditorElement, defineElements } from "../ui/elements";
