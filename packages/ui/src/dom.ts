// The one helper every component is built with: an element, its properties, its children.
// Attributes that are not properties (style, aria-*, data-*) are set as attributes; null
// children are skipped, so optional parts can be written inline.

export type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === "style" || k.startsWith("aria-") || k.startsWith("data-") || k === "role") e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  e.append(...kids.filter((x): x is Node | string => x !== null && x !== undefined && x !== false));
  return e;
}
