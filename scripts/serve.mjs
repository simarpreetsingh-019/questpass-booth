// The demo, locally: serves demo/ and dist/, and the brand lookup at /api/brand.
// npm run build && npm run demo → http://localhost:8787
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { nodeAvatarHandler, nodeBrandHandler } from "../dist/server.js";

const root = join(fileURLToPath(import.meta.url), "../..");
const port = Number(process.env.PORT ?? 8787);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".map": "application/json", ".json": "application/json", ".woff2": "font/woff2", ".md": "text/plain; charset=utf-8", ".css": "text/css" };
const brand = nodeBrandHandler();
// X pictures come through an unofficial service: on here for testing (see server/avatar.ts)
const avatar = nodeAvatarHandler({ x: true });

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  if (path === "/api/brand") return brand(req, res);
  if (path === "/api/avatar") return avatar(req, res);
  const page = path.endsWith("/") ? `${path}index.html` : path;
  const rel = page.startsWith("/dist/") ? page.slice(1) : join("demo", page);
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store", "content-security-policy": "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`QuestPass Booth demo: http://localhost:${port}`));
