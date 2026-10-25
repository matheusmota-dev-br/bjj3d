// The site's interface, by atomic design. Plain DOM, no framework: every component takes
// its texts and callbacks and returns elements. Import tokens.css and ui.css for the looks.
export { el, type Child } from "./dom.ts";
// atoms
export * from "./atoms/badge.ts";
export * from "./atoms/button.ts";
export * from "./atoms/dot.ts";
export * from "./atoms/eyebrow.ts";
export * from "./atoms/swatch.ts";
// molecules
export * from "./molecules/option.ts";
export * from "./molecules/ref-row.ts";
export * from "./molecules/segmented.ts";
export * from "./molecules/slider.ts";
export * from "./molecules/swatch-choices.ts";
export * from "./molecules/tabs.ts";
export * from "./molecules/thumb.ts";
export * from "./molecules/title-card.ts";
// organisms
export * from "./organisms/attention.ts";
export * from "./organisms/customizer.ts";
export * from "./organisms/filmstrip.ts";
export * from "./organisms/help.ts";
export * from "./organisms/now-card.ts";
export * from "./organisms/oss.ts";
export * from "./organisms/panel.ts";
export * from "./organisms/settings.ts";
// templates
export * from "./templates/cinema.ts";
