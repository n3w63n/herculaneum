import { build } from "esbuild";
import { cp, readFile } from "node:fs/promises";

const common = {
  bundle: true,
  format: "iife",
  target: "chrome110",
  logLevel: "info",
  // sql.js's node-only branch references these; never executed in the browser.
  external: ["fs", "path"],
};

await build({ ...common, entryPoints: ["src/background.js"], outfile: "dist/background.js" });
await build({ ...common, entryPoints: ["src/content.js"], outfile: "dist/content.js" });
await cp("src/manifest.json", "dist/manifest.json");
await cp("src/icons", "dist/icons", { recursive: true });
// esbuild resolves sql.js's "browser" export → sql-wasm-browser.js, which
// requests sql-wasm-browser.wasm (node tests use sql-wasm.wasm instead).
await cp("node_modules/sql.js/dist/sql-wasm-browser.wasm", "dist/sql-wasm-browser.wasm");
// The bundled loader must ask for the file we just copied (esbuild resolves
// sql.js's browser export, which differs from the node test path).
const background = await readFile("dist/background.js", "utf8");
if (!background.includes('"sql-wasm-browser.wasm"')) {
  throw new Error("wasm filename mismatch: bundle does not reference sql-wasm-browser.wasm");
}
console.log("built dist/");
