/** The one piece of QuestPass's GIF encoder the engine uses. */
import type { Scene } from "./journey";

const W = 480;

export function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, f: number, size: number) {
  ctx.save();
  ctx.setTransform(size / W, 0, 0, size / W, 0, 0);
  ctx.imageSmoothingQuality = "high";
  scene.draw(ctx, f);
  ctx.restore();
}
