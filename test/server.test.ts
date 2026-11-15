import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUrl, isPublicAddress } from "../server/net";
import { pngFromIco, readPage, siteUrl, sniffImage } from "../server/brand";

test("private, loopback, link-local and reserved addresses are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fc00::1", "fd12::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2002:a00:1::"]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"]) assert.equal(isPublicAddress(ip), true, ip);
  assert.equal(isPublicAddress("not-an-ip"), false);
});

test("URLs: http(s), standard ports, no credentials, no private literals or local names", () => {
  for (const u of ["file:///etc/passwd", "ftp://example.com", "http://user:pw@example.com", "http://example.com:8080", "http://127.0.0.1", "http://[::1]/", "http://localhost", "http://printer.local", "http://metadata.google.internal"]) {
    assert.throws(() => checkUrl(u), u);
  }
  assert.equal(checkUrl("https://example.com/x").hostname, "example.com");
  assert.equal(siteUrl("pizzadao.org").href, "https://pizzadao.org/");
});

test("the brand is read from the page's head", () => {
  const html = `<html><head><title>PizzaDAO | Pizza for all</title>
    <meta property="og:site_name" content="Pizza&amp;DAO">
    <meta name="theme-color" content="#f50">
    <link rel="icon" href="/favicon.ico" sizes="32x32">
    <link rel="apple-touch-icon" href="/apple.png">
    <link rel="icon" href="/icon.svg" type="image/svg+xml">
    <link rel="manifest" href="/site.webmanifest"></head><body><link rel="icon" href="/late.png"></body></html>`;
  const p = readPage(html, new URL("https://pizzadao.org/"));
  assert.equal(p.name, "Pizza&DAO");
  assert.equal(p.themeColor, "#FF5500");
  assert.equal(p.manifest, "https://pizzadao.org/site.webmanifest");
  assert.deepEqual(p.icons, ["https://pizzadao.org/apple.png", "https://pizzadao.org/favicon.ico"]);
});

test("pictures are told apart by their bytes, and a PNG is found inside an .ico", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300)]);
  assert.equal(sniffImage(png), "image/png");
  assert.equal(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
  const dir = Buffer.alloc(22);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(1, 4);
  dir[6] = 0;
  dir[7] = 0;
  dir.writeUInt32LE(png.length, 14);
  dir.writeUInt32LE(22, 18);
  const ico = Buffer.concat([dir, png]);
  assert.deepEqual(pngFromIco(ico), png);
  assert.equal(pngFromIco(Buffer.from("not an icon")), null);
});
