// After the suite: the real data must be byte for byte what it was.
import { readFileSync } from "node:fs";
import { fingerprint, FINGERPRINTS } from "./global-setup.ts";

export default function teardown() {
  const before: Record<string, string> = JSON.parse(readFileSync(FINGERPRINTS, "utf8"));
  const changed = Object.entries(before).filter(([path, hash]) => fingerprint(path) !== hash).map(([path]) => path);
  if (changed.length) throw new Error(`the end-to-end suite modified real data: ${changed.join(", ")}`);
}
