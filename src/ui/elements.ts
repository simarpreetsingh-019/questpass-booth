/** Defines <questpass-booth> and <questpass-booth-editor> (once; safe to load twice). */
// packs first, so a config can name their frames
import "../packs/pizza";
import { BoothElement } from "./booth";
import { EditorElement } from "./editor";

export { BoothElement, EditorElement };

export function defineElements() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("questpass-booth")) customElements.define("questpass-booth", BoothElement);
  if (!customElements.get("questpass-booth-editor")) customElements.define("questpass-booth-editor", EditorElement);
}

defineElements();
