/**
 * Sample pictures (illustrations of a day out: a party, a beach, friends),
 * drawn in code, so the booth has something to show in each frame before
 * the first photo. Copied from QuestPass (src/features/reel/components/ReelSample.tsx).
 */
const W = 900;
const H = 1200;

/** Sky from top to bottom. */
function sky(ctx: CanvasRenderingContext2D, stops: string[], h = H) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);
}

function sea(ctx: CanvasRenderingContext2D, y: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, H - y);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const yy = y + 20 + i * ((H - y) / 14);
    ctx.beginPath();
    ctx.moveTo(((i * 137) % 300) + 40, yy);
    ctx.lineTo(((i * 137) % 300) + 220, yy);
    ctx.stroke();
  }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, c);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Scenes from a day out, drawn (no photos needed). */
const OPEN_SCENES: Array<(ctx: CanvasRenderingContext2D) => void> = [
  // sunset at the beach
  (ctx) => {
    sky(ctx, ["#24164a", "#b8456e", "#f6995a", "#ffd58c"], 800);
    glow(ctx, 450, 760, 300, "rgba(255,226,160,0.95)");
    ctx.fillStyle = "#ffe2a0";
    ctx.beginPath();
    ctx.arc(450, 770, 120, Math.PI, 0);
    ctx.fill();
    sea(ctx, 800, "#6a3f63", "#21163a");
    // two palms
    ctx.fillStyle = "#1a1024";
    for (const [x, k] of [
      [130, 1],
      [790, -1],
    ] as const) {
      ctx.fillRect(x - 10, 420, 20, 400);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(x + k * (40 + i * 10), 420 + i * 6, 120, 22, k * (0.2 + i * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  // party lights and balloons
  (ctx) => {
    sky(ctx, ["#120b26", "#2c1450"]);
    for (let i = 0; i < 14; i++) glow(ctx, (i * 131) % W, 80 + ((i * 59) % 260), 46, ["rgba(255,90,170,0.8)", "rgba(91,155,255,0.8)", "rgba(255,196,64,0.8)"][i % 3]!);
    for (const [x, y, c] of [
      [240, 520, "#ff5aa8"],
      [450, 440, "#ffc440"],
      [660, 540, "#5b9bff"],
    ] as const) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + 150);
      ctx.quadraticCurveTo(x - 30, y + 400, x + 10, H);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, y, 110, 140, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(x - 40, y - 50, 22, 36, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = ["#ff5aa8", "#ffc440", "#5b9bff", "#38ff9c"][i % 4]!;
      ctx.fillRect((i * 173) % W, (i * 97) % H, 12, 22);
    }
  },
  // city lights at night
  (ctx) => {
    sky(ctx, ["#050a1c", "#13285a"], 760);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect((i * 151) % W, (i * 67) % 380, 3, 3);
    }
    for (let i = 0; i < 9; i++) {
      const h = 220 + ((i * 73) % 300);
      ctx.fillStyle = "#0a1430";
      ctx.fillRect(i * 105, 760 - h, 92, h);
      ctx.fillStyle = "rgba(255,214,120,0.8)";
      for (let wy = 760 - h + 30; wy < 740; wy += 46) for (let wx = 0; wx < 3; wx++) if ((wy + wx * 7 + i) % 3) ctx.fillRect(i * 105 + 14 + wx * 26, wy, 12, 18);
    }
    ctx.fillStyle = "#04070f";
    ctx.fillRect(0, 760, W, H - 760);
  },
  // coffee with friends
  (ctx) => {
    sky(ctx, ["#5a3420", "#2a160c"]);
    glow(ctx, 450, 500, 420, "rgba(255,170,90,0.35)");
    for (const [x, y] of [
      [300, 640],
      [600, 700],
    ] as const) {
      ctx.fillStyle = "#f3e6d4";
      ctx.beginPath();
      ctx.moveTo(x - 110, y - 150);
      ctx.lineTo(x + 110, y - 150);
      ctx.lineTo(x + 80, y + 120);
      ctx.lineTo(x - 80, y + 120);
      ctx.fill();
      ctx.fillStyle = "#6b3e22";
      ctx.beginPath();
      ctx.ellipse(x, y - 150, 110, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x - 20, y - 200);
      ctx.bezierCurveTo(x - 60, y - 260, x + 30, y - 300, x - 10, y - 380);
      ctx.stroke();
    }
  },
  // the cake
  (ctx) => {
    sky(ctx, ["#2a1036", "#4a1d55"]);
    glow(ctx, 450, 420, 360, "rgba(255,200,120,0.35)");
    ctx.fillStyle = "#f7d9e6";
    ctx.fillRect(220, 620, 460, 260);
    ctx.fillStyle = "#ff7eb6";
    ctx.fillRect(220, 620, 460, 50);
    ctx.fillStyle = "#fff4f8";
    ctx.fillRect(280, 500, 340, 130);
    ctx.fillStyle = "#ff7eb6";
    ctx.fillRect(280, 500, 340, 36);
    ctx.fillStyle = "#e9e2d6";
    ctx.fillRect(170, 880, 560, 30);
    for (const x of [340, 410, 490, 560]) {
      ctx.fillStyle = "#7fd0ff";
      ctx.fillRect(x - 8, 420, 16, 84);
      glow(ctx, x, 400, 44, "rgba(255,210,120,0.95)");
      ctx.fillStyle = "#ffd27a";
      ctx.beginPath();
      ctx.ellipse(x, 400, 10, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // the dance floor
  (ctx) => {
    sky(ctx, ["#07070f", "#141432"]);
    for (const [x, c] of [
      [150, "rgba(91,155,255,0.35)"],
      [450, "rgba(255,196,64,0.35)"],
      [750, "rgba(255,90,170,0.35)"],
    ] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - 20, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + 200, 760);
      ctx.lineTo(x - 200, 760);
      ctx.fill();
    }
    glow(ctx, 450, 160, 90, "rgba(255,255,255,0.8)");
    ctx.fillStyle = "#05050b";
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % W;
      const y = 820 + ((i * 53) % 260);
      ctx.beginPath();
      ctx.arc(x, y, 46, 0, Math.PI * 2);
      ctx.arc(x, y + 110, 70, Math.PI, 0);
      ctx.fill();
    }
  },
];


export async function samplePhotos(): Promise<ImageBitmap[]> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const out: ImageBitmap[] = [];
  for (const draw of [OPEN_SCENES[0]!, OPEN_SCENES[1]!, OPEN_SCENES[3]!, OPEN_SCENES[4]!]) {
    ctx.save();
    draw(ctx);
    ctx.restore();
    out.push(await createImageBitmap(c));
  }
  return out;
}
