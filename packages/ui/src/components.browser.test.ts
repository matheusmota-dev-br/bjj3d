// The interface components' optional parts: what each one draws when a prop is left out.

import { expect, test, vi } from "vitest";
import { button } from "./atoms/button.ts";
import { el } from "./dom.ts";
import { slider } from "./molecules/slider.ts";
import { helpDialog } from "./organisms/help.ts";
import { nowCard } from "./organisms/now-card.ts";

test("an element with no properties", () => {
  const e = el("span");
  expect(e.tagName).toBe("SPAN");
  expect(e.attributes).toHaveLength(0);
});

test("a toggle button says whether it is pressed; a plain one does not", () => {
  expect(button({ label: "Free", pressed: true }).getAttribute("aria-pressed")).toBe("true");
  expect(button({ label: "Free", pressed: false }).getAttribute("aria-pressed")).toBe("false");
  expect(button({ label: "Done" }).hasAttribute("aria-pressed")).toBe(false);
});

test("a slider without onFocus still reports its value", () => {
  const onInput = vi.fn();
  const s = slider({ label: "Build", min: 0, max: 1, step: 0.1, value: 0.5, ends: ["slim", "sturdy"], onInput });
  const input = s.querySelector("input")!;
  expect(input.onfocus).toBeNull();
  input.value = "0.8";
  input.dispatchEvent(new Event("input"));
  expect(onInput).toHaveBeenCalledWith(0.8);
});

test("the help card is shown unless told otherwise", () => {
  const help = helpDialog({ title: "How to use", steps: ["Pick a move."], video: { label: "Demo", href: "https://youtu.be/yeQPuzHseZg" }, ok: "Got it", onOk: () => {} });
  expect(help.hidden).toBe(false);
});

test("the now card without notes has none", () => {
  const card = nowCard({ title: "Armbar", what: "Move" });
  expect(card.querySelectorAll(".note")).toHaveLength(0);
});
