// Interface text. Each language is a JSON file in locales/ with the same keys as en.json;
// pt-BR is the default. English and Portuguese are reviewed; the other languages still need
// a native speaker's review. Technique texts (data/techniques) come in English and
// Portuguese only and fall back to English.

import type { Kind } from "./metrics.ts";
import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import ru from "./locales/ru.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import hi from "./locales/hi.json";
import ar from "./locales/ar.json";
import id from "./locales/id.json";
import tr from "./locales/tr.json";
import nl from "./locales/nl.json";
import pl from "./locales/pl.json";

export const LANGS = ["pt-BR", "en", "es", "fr", "de", "it", "ru", "zh", "ja", "ko", "hi", "ar", "id", "tr", "nl", "pl"] as const;
export type Lang = (typeof LANGS)[number];
type Key = keyof typeof en;
export type Text = { en: string } & Partial<Record<string, string>>;

const TABLES: Record<Lang, Record<string, string>> = {
  "pt-BR": ptBR,
  en: en,
  es: es,
  fr: fr,
  de: de,
  it: it,
  ru: ru,
  zh: zh,
  ja: ja,
  ko: ko,
  hi: hi,
  ar: ar,
  id: id,
  tr: tr,
  nl: nl,
  pl: pl,
};

/** Languages written right to left. */
const RTL = new Set<Lang>(["ar"]);

let current: Lang = "pt-BR";

export function setLang(l: string) {
  current = (LANGS as readonly string[]).includes(l) ? (l as Lang) : "pt-BR";
  document.documentElement.lang = current;
  document.documentElement.dir = RTL.has(current) ? "rtl" : "ltr";
}

export const currentLang = () => current;
/** A language's own name ("Português (Brasil)", "日本語"…). */
export const langName = (l: Lang) => TABLES[l].name;

export function t(key: Key, vars: Record<string, string> = {}): string {
  return (TABLES[current][key] ?? TABLES.en[key]).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export const pick = (text: Text) => text[current] ?? text.en;
export const kindName = (k: Kind) => t(`kind.${k}` as Key);
export const risk = (k: Kind) => t(`risk.${k}` as Key);

/** Label next to the joint: the measure behind the glow. */
export function measureLabel(kind: Kind, m: number): string {
  return t(`measure.${kind}` as Key, { n: String(Math.round(kind === "choke" ? m * 100 : m)) });
}
