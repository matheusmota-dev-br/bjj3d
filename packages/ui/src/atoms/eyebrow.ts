// Atom: a small capitalized label over a section of the panel ("NOW", "NEXT").
import { el } from "../dom.ts";

export const eyebrow = (text: string): HTMLParagraphElement => el("p", { className: "eyebrow" }, text);
