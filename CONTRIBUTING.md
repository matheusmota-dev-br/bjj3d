# Contributing

Thanks for helping. Everything here is about jiu-jitsu: positions, transitions, techniques,
submissions and how they are shown.

## Getting started

```
npm install
npm run dev          # the site, with the local editor
npm run storybook    # the catalog and the guides
npm test             # unit tests (coverage must stay at 100%)
```

## What you can add

| what | where | code? |
|---|---|---|
| a position or transition | `data/grapplemap/bjj3d.txt`, written by the local editor | no |
| a technique text (names, steps, notes) | `data/techniques/*.json`, see `packages/data/schemas/technique.schema.json` | no |
| a translation of the interface | `apps/web/src/locales/<lang>.json`, with the keys of `en.json` | no |
| a submission metric | a `SubmissionMetric` in `packages/metrics` | yes |
| a place, a look, a belt | a `PlaceDef`, a `LookDef`, a colour, in `packages/three` | yes |

Each one has a guide in the catalog (`npm run storybook` → Guides).

## A new submission, step by step

1. Write the `SubmissionMetric` (tags, side, danger threshold, `read`, `glowPoint`).
2. Add it to `builtinMetrics` in `packages/metrics/src/metrics.ts`, or pass it to
   `createMetrics` in your own code.
3. Watch it in Storybook (**Templates/Viewer**, **Reading** panel) on a transition with its tags.
4. `npm run validate`: it measures every kind in the registry over the whole database and
   rewrites `docs/validation.md`. Commit the new report with the metric.

## Rules of the code

- Dependencies go one way: `core` ← `grapplemap` ← `data`, `core` ← `metrics` ← `three` ←
  `editor`; no package imports an app. `core` and `ui` have no dependencies at all.
- Interface components go in `packages/ui` at their atomic level, take texts and callbacks
  (no i18n, no data inside), and get a story and an MDX page in `apps/storybook`.
- A package is used by its name (`@bjj3d/core`), never by a path into another package.
- Registries are passed in, never global.
- Anything that holds a viewer calls `viewer.dispose()` when it goes away.
- Unit tests next to the code (`*.test.ts` in Node, `*.browser.test.ts` in Chromium), 100%
  coverage.
