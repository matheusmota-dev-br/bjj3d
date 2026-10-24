// Lists transitions touching positions whose name matches a pattern.
//   node scripts/find.ts "arm lock"
import { readFileSync } from "node:fs";
import { buildGraph, parse } from "../src/grapplemap.ts";

const text = readFileSync(new URL("../../data/grapplemap/GrappleMap.txt", import.meta.url), "utf8");
const graph = buildGraph(parse(text));
const linked = graph.transitions.filter((t) => t.from !== null && t.to !== null).length;
console.log(`${graph.positions.length} positions, ${graph.transitions.length} transitions, ${linked} linked at both ends`);

const pattern = new RegExp(process.argv[2] ?? ".", "i");
const name = (i: number | null) => (i === null ? "?" : graph.positions[i].name);
for (const t of graph.transitions) {
  if (![t.block.name, name(t.from), name(t.to)].some((n) => pattern.test(n))) continue;
  console.log(`${t.block.line}\t${name(t.from)}  --[${t.block.name}]-->  ${name(t.to)}\t(${t.block.poses.length} frames; ${t.block.properties.join(" ")})`);
}
