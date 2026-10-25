// Builds docs/character.html: one self-contained page with the site's mannequin in 3D and the five
// reference views its pieces were measured from.
//
//   tools/character/page.html      the page, with /*BUNDLE*/ and /*REFS*/ to fill
//   tools/character/app.js         the 3D view, bundled with the packages it imports (three stays
//                                  external, from the page's import map)
//   tools/character/reference/*.jpg  the reference views, embedded as data URLs
//
//   node tools/character.mjs   (npm run character)
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const VIEWS = [["front", "Front"], ["side", "Side"], ["top", "Top"], ["back", "Back"], ["three", "¾"]];

const out = await build({
  entryPoints: [new URL("tools/character/app.js", root).pathname],
  bundle: true,
  format: "esm",
  external: ["three", "three/addons/*"],
  legalComments: "none",
  write: false,
  logLevel: "warning",
});
const bundle = out.outputFiles[0].text;
if (bundle.includes("</script")) throw new Error("the bundle closes its own script tag");

const refs = VIEWS.map(([view, label]) => {
  const jpg = readFileSync(new URL(`tools/character/reference/${view}.jpg`, root)).toString("base64");
  return `<figure data-view="${view}"><img alt="Reference, ${label.toLowerCase()} view" src="data:image/jpeg;base64,${jpg}"><figcaption>${label}</figcaption></figure>`;
}).join("");

const page = readFileSync(new URL("tools/character/page.html", root), "utf8")
  .replace("/*REFS*/", refs)
  .replace("/*BUNDLE*/", `// Built by tools/character.mjs from tools/character/app.js; do not edit here.\n${bundle}`);
writeFileSync(new URL("docs/character.html", root), page);
console.log(`docs/character.html: ${(page.length / 1024).toFixed(0)} KB`);
