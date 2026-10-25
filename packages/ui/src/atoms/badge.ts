// Atom: the submission badge ("Elbow lock"). Red, because it names a load on a joint; it is
// the only red text in the interface besides the risk line.
import { el } from "../dom.ts";

export const kindBadge = (text: string): HTMLSpanElement => el("span", { className: "kind" }, text);
