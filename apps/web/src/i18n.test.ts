import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import { currentLang, kindName, langName, LANGS, measureLabel, pick, risk, setLang, t } from "./i18n.ts";
import en from "./locales/en.json";
import pl from "./locales/pl.json";
import type { Kind } from "@bjj3d/metrics";

// setLang marks the page's language and direction; a bare stand-in for the document is enough.
const root = { lang: "", dir: "" };
beforeEach(() => {
  (globalThis as { document?: unknown }).document = { documentElement: root };
  setLang("pt-BR");
});

test("every language has every English key", () => {
  for (const l of LANGS) {
    setLang(l);
    for (const k of Object.keys(en) as (keyof typeof en)[]) assert.ok(t(k).length > 0, `${l}: ${k}`);
  }
});

test("pt-BR is the default, and an unknown language falls back to it", () => {
  assert.equal(currentLang(), "pt-BR");
  setLang("xx");
  assert.equal(currentLang(), "pt-BR");
  assert.deepEqual(root, { lang: "pt-BR", dir: "ltr" });
});

test("Arabic is written right to left", () => {
  setLang("ar");
  assert.deepEqual(root, { lang: "ar", dir: "rtl" });
  setLang("en");
  assert.equal(root.dir, "ltr");
});

test("each language names itself", () => {
  assert.equal(langName("pt-BR"), "Português (Brasil)");
  assert.equal(langName("ja"), "日本語");
});

test("placeholders are filled, and missing ones left empty", () => {
  setLang("en");
  assert.equal(t("moreMoves", { n: "3" }), "3 more");
  assert.equal(t("moreMoves"), " more");
});

test("a key missing from a language falls back to English", () => {
  // Every table is complete today; take a key out of one to see the fallback.
  const table = pl as Record<string, string>;
  const saved = table.moreMoves;
  delete table.moreMoves;
  try {
    setLang("pl");
    assert.equal(t("moreMoves", { n: "2" }), "2 more");
  } finally {
    table.moreMoves = saved;
  }
  assert.notEqual(t("moreMoves", { n: "2" }), "2 more");
});

test("technique texts pick the current language, else English", () => {
  setLang("pt-BR");
  assert.equal(pick({ en: "Mount", "pt-BR": "Montada" }), "Montada");
  assert.equal(pick({ en: "Mount" }), "Mount");
});

test("kinds have a name, a risk sentence and a measure label", () => {
  setLang("en");
  const kinds: Kind[] = ["elbow", "shoulder", "knee", "kneeTwist", "choke", "neckCrank"];
  for (const k of kinds) {
    assert.ok(kindName(k).length > 0 && risk(k).length > 0, k);
    assert.match(measureLabel(k, 12.4), /12/, k);
  }
  // Choke gaps are metres, shown in centimetres.
  assert.match(measureLabel("choke", 0.114), /11/);
  assert.doesNotMatch(measureLabel("choke", 0.114), /0\.1/);
});
