// The database, loaded once for every story (graph.json is served from apps/web/public).
import { Db, type Ref } from "@bjj3d/data";

let loading: Promise<Db> | null = null;
export const loadDb = () => (loading ??= Db.load("./graph.json"));

/** Knee on belly to armbar: the transition the site opens on, and the banner's frame. */
export const ARMBAR: Ref = { type: "t", i: 458, reversed: false };

/** The transitions with a submission kind that end in a finish ("tap", "finish"). */
export async function finishes(): Promise<Ref[]> {
  const db = await loadDb();
  return db.file.transitions.flatMap((t, i) => (t.kind && /tap|finish/i.test(t.name) ? [{ type: "t" as const, i, reversed: false }] : []));
}
