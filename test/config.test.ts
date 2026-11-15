import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanLogo, cleanUrl, defaultConfig, normalizeConfig } from "../src/core/config";

test("anything that isn't an object gives the defaults", () => {
  for (const v of [null, undefined, 42, "x", [1, 2]]) assert.deepEqual(normalizeConfig(v), defaultConfig());
});

test("unknown fields are dropped and lengths are capped", () => {
  const c = normalizeConfig({ title: "x".repeat(500), evil: "<script>", brand: { name: "Pizza‮DAO\u0000" } }) as unknown as Record<string, unknown>;
  assert.equal((c.title as string).length, 40);
  assert.equal(c.evil, undefined);
  assert.equal((c.brand as { name: string }).name, "Pizza DAO");
});

test("colours must be #RRGGBB", () => {
  const c = normalizeConfig({ brand: { colors: { accent: "red", base: "#ff00ff", text: "url(javascript:1)" } } });
  assert.equal(c.brand.colors.accent, defaultConfig().brand.colors.accent);
  assert.equal(c.brand.colors.base, "#FF00FF");
  assert.equal(c.brand.colors.text, defaultConfig().brand.colors.text);
});

test("links: http(s) only, no credentials; the booth link https only", () => {
  assert.equal(cleanUrl("javascript:alert(1)"), "");
  assert.equal(cleanUrl("https://user:pw@example.com"), "");
  assert.equal(cleanUrl("http://example.com/a"), "http://example.com/a");
  assert.equal(normalizeConfig({ share: { link: "http://example.com" } }).share.link, "");
  assert.equal(normalizeConfig({ share: { link: "https://example.com/b" } }).share.link, "https://example.com/b");
});

test("logos: raster data URLs or https only, never SVG", () => {
  assert.equal(cleanLogo("data:image/svg+xml;base64,PHN2Zz4="), "");
  assert.equal(cleanLogo("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(cleanLogo("data:image/png;base64,<script>"), "");
  assert.equal(cleanLogo("http://example.com/logo.png"), "");
  assert.equal(cleanLogo("https://example.com/logo.png"), "https://example.com/logo.png");
});

test("frames: unknown ids dropped, the default must be offered", () => {
  const c = normalizeConfig({ frames: { allow: ["neon", "nope", "polaroid"], default: "comic" } });
  assert.deepEqual(c.frames.allow, ["neon", "polaroid"]);
  assert.equal(c.frames.default, "polaroid");
});

test("numbers are clamped", () => {
  const c = normalizeConfig({ camera: { idleSeconds: 99999 }, maxPhotos: -3 });
  assert.equal(c.camera.idleSeconds, 120);
  assert.equal(c.maxPhotos, 1);
});

test("an unversioned config is migrated", () => {
  const c = normalizeConfig({ colors: { accent: "#123456" } });
  assert.equal(c.version, 1);
  assert.equal(c.brand.colors.accent, "#123456");
});

test("a normalized config stays the same when normalized again", () => {
  const once = normalizeConfig({ title: "Party", words: { "neon.sign": { mode: "fixed", text: "PIZZA" } } });
  assert.deepEqual(normalizeConfig(JSON.parse(JSON.stringify(once))), once);
});

test("packs, frame order and the person settings", async () => {
  await import("../src/packs/pizza");
  const plain = normalizeConfig({});
  assert.ok(!plain.frames.allow || plain.frames.allow === "all");
  const { offeredFrames } = await import("../src/core/config");
  assert.ok(!offeredFrames(plain).includes("pizza-box" as never), "pack frames only with the pack");
  const pizza = normalizeConfig({ packs: ["pizza", "BAD PACK"], frames: { first: ["pizza-mafia", "nope"], default: "pizza-box" }, person: { nameLabel: "Your mafia name", names: ["A", "A", "", 5], suggest: { first: ["Mozz"], last: ["DeNiro"] } } });
  assert.deepEqual(pizza.packs, ["pizza"]);
  assert.equal(pizza.frames.default, "pizza-box");
  assert.equal(offeredFrames(pizza)[0], "pizza-mafia");
  assert.deepEqual(pizza.person.names, ["A"]);
  assert.equal(pizza.person.nameLabel, "Your mafia name");
  assert.equal(pizza.person.wholeName, true);
});

test("usernames are cleaned from whatever is pasted", async () => {
  const { cleanHandle } = await import("../src/core/handle");
  assert.equal(cleanHandle("@durov"), "durov");
  assert.equal(cleanHandle("https://t.me/durov"), "durov");
  assert.equal(cleanHandle("telegram.me/durov?x=1"), "durov");
  assert.equal(cleanHandle("https://x.com/simarpreet_019?s=20"), "simarpreet_019");
  assert.equal(cleanHandle("instagram.com/pizza.dao/"), "pizza.dao");
  assert.equal(cleanHandle("<script>alert(1)</script>"), "scriptalert1script");
  assert.equal(cleanHandle(42), "");
  const c = normalizeConfig({ person: { handle: { ask: true, networks: ["telegram", "myspace"] }, picture: true } });
  assert.deepEqual(c.person.handle.networks, ["telegram"]);
  assert.equal(c.person.picture, true);
});
