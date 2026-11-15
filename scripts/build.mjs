// Builds dist/: the browser bundle (one ES module), the server module, the
// fonts (with their licences) and the type declarations.
import { build, transform } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "fonts"), { recursive: true });

// the version in the code always matches package.json
writeFileSync(join(root, "src/core/version.ts"), `export const VERSION = "${pkg.version}";\n`);

const banner = { js: `/*! QuestPass Booth ${pkg.version} | Apache-2.0 | (c) Simarpreet Singh | https://github.com/simarpreetsingh-019/questpass-booth */` };
await build({ entryPoints: [join(root, "src/core/index.ts")], outfile: join(dist, "questpass-booth.js"), bundle: true, format: "esm", target: "es2020", platform: "browser", minify: true, sourcemap: true, legalComments: "eof", banner, tsconfig: join(root, "tsconfig.json") });
await build({ entryPoints: [join(root, "server/index.ts")], outfile: join(dist, "server.js"), bundle: true, format: "esm", target: "node18", platform: "node", sourcemap: true, banner, tsconfig: join(root, "tsconfig.json") });

// fonts: only the files the frames use, and each family's licence
const fontsJs = (await transform(readFileSync(join(root, "src/core/fonts.ts"), "utf8"), { loader: "ts", format: "esm" })).code;
const { FONT_FILES } = await import("data:text/javascript," + encodeURIComponent(fontsJs));
const licences = [];
for (const [family, file] of FONT_FILES) {
  const pkgName = file.replace(/-latin-.*$/, "");
  cpSync(join(root, "node_modules/@fontsource", pkgName, "files", file), join(dist, "fonts", file));
  if (!licences.some((l) => l.pkg === pkgName)) licences.push({ pkg: pkgName, family, text: readFileSync(join(root, "node_modules/@fontsource", pkgName, "LICENSE"), "utf8") });
}
writeFileSync(join(dist, "fonts/LICENSES.md"), "# Font licences\n\nThe fonts in this folder come from Fontsource (Google Fonts) and are under the SIL Open Font License 1.1.\n\n" + licences.map((l) => `## ${l.family}\n\n${l.text}`).join("\n\n"));

// types: emitted by tsc, then QuestPass's import aliases rewritten to relative paths
execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", root, "--declaration", "--emitDeclarationOnly", "--noEmit", "false", "--outDir", join(dist, "types")], { stdio: "inherit" });
const alias = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf8")).compilerOptions.paths;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
for (const f of walk(join(dist, "types")).filter((f) => f.endsWith(".d.ts"))) {
  let s = readFileSync(f, "utf8");
  for (const [from, [to]] of Object.entries(alias)) {
    let rel = relative(dirname(f), join(dist, "types", to.replace(/\.ts$/, ""))).replace(/\\/g, "/");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    s = s.replaceAll(`"${from}"`, `"${rel}"`);
  }
  writeFileSync(f, s);
}
const size = (f) => (statSync(join(dist, f)).size / 1024).toFixed(0) + " KB";
console.log(`built ${pkg.version}: questpass-booth.js ${size("questpass-booth.js")}, server.js ${size("server.js")}, ${FONT_FILES.length} fonts`);
