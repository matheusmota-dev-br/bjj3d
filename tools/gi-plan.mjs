// Puts the site's mannequin into docs/gi-plan.html, between its `// <mannequin>` and
// `// </mannequin>` lines: tools/gi-plan/mannequin.js bundled with the packages it imports, in a
// scope of its own, with three taken from the page's import. The rest of the page is edited by hand.
//
//   node tools/gi-plan.mjs   (npm run gi-plan)
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const page = new URL("docs/gi-plan.html", root);

const out = await build({
  entryPoints: [new URL("tools/gi-plan/mannequin.js", root).pathname],
  bundle: true,
  format: "esm",
  external: ["three"],
  legalComments: "none",
  write: false,
  logLevel: "warning",
});
let code = out.outputFiles[0].text;
if (code.includes("</script")) throw new Error("the bundle closes its own script tag");

// The page imports three as THREE; the bundle's own names for it become aliases.
const aliases = [];
code = code.replace(/^import \* as (\w+) from "three";\n/gm, (_, name) => (name === "THREE" ? "" : (aliases.push(name), "")));
const exported = code.match(/^export \{([^}]*)\};\n?/m);
if (!exported) throw new Error("the bundle exports nothing");
code = code.replace(exported[0], "");
// [local, exported] for each name.
const names = exported[1].split(",").map((s) => s.trim()).filter(Boolean).map((n) => { const [local, as = local] = n.split(" as "); return [local, as]; });
const block = [
  "// <mannequin> Built by tools/gi-plan.mjs from packages/three; do not edit here.",
  `const { ${names.map(([, as]) => as).join(", ")} } = (() => {`,
  ...aliases.map((a) => `const ${a} = THREE;`),
  code.trimEnd(),
  `return { ${names.map(([local, as]) => (local === as ? as : `${as}: ${local}`)).join(", ")} };`,
  "})();",
  "// </mannequin>",
].join("\n");

const html = readFileSync(page, "utf8");
const at = html.indexOf("// <mannequin>"), end = html.indexOf("// </mannequin>");
if (at < 0 || end < at) throw new Error("docs/gi-plan.html has no // <mannequin> … // </mannequin> block");
writeFileSync(page, html.slice(0, at) + block + html.slice(end + "// </mannequin>".length));
console.log(`docs/gi-plan.html: mannequin ${(block.length / 1024).toFixed(0)} KB`);
