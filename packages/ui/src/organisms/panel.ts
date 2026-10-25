// Organism: the panel that slides over the view from "Browse": the name and a search at the
// top, the lists in the middle (the page fills `body`), and language and theme at the foot.
import { button } from "../atoms/button.ts";
import { el } from "../dom.ts";

export interface PanelProps {
  /** The icon next to the name. */
  icon: string;
  name: string;
  searchPlaceholder: string;
  about: string;
  languages: { value: string; label: string }[];
  language: string;
  languageTitle: string;
  onSearch: (q: string) => void;
  onLanguage: (lang: string) => void;
  onTheme: () => void;
  onClose: () => void;
}

export interface Panel {
  element: HTMLElement;
  body: HTMLDivElement;
  search: HTMLInputElement;
  /** The theme button shows the current theme. */
  setTheme(symbol: string, title: string): void;
}

export function panel(p: PanelProps): Panel {
  const search = el("input", { id: "search", type: "search", autocomplete: "off", spellcheck: false, placeholder: p.searchPlaceholder });
  search.oninput = () => p.onSearch(search.value);
  const lang = el("select", { id: "lang", title: p.languageTitle }, ...p.languages.map((l) => el("option", { value: l.value, textContent: l.label })));
  lang.value = p.language;
  lang.onchange = () => p.onLanguage(lang.value);
  const theme = button({ label: "", id: "theme", round: true, onClick: p.onTheme });
  theme.removeAttribute("aria-label");
  const body = el("div", { id: "panel-body" });
  const element = el("aside", { id: "panel" },
    el("div", { className: "top" },
      el("div", { className: "top-row" },
        el("a", { className: "name", href: "#" }, el("img", { src: p.icon, alt: "", width: 26, height: 26 }), p.name),
        button({ label: "✕", id: "panel-close", round: true, onClick: p.onClose })),
      search),
    body,
    el("div", { className: "foot" }, el("p", { id: "about", className: "muted" }, p.about), el("div", { className: "prefs" }, lang, theme)));
  return { element, body, search, setTheme(symbol, title) { theme.textContent = symbol; theme.title = title; } };
}
