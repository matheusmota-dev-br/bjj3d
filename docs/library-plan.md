# Plan: bjj3d as a set of libraries

The viewer that lived in `web/` becomes packages the community can use and extend, and the site
becomes one more consumer of them. The focus stays on jiu-jitsu: the extension points are
the ones jiu-jitsu itself needs (gi positions, more submissions, stripes on the belt), not a
generic "sport" layer.

`@bjj3d/` is the npm scope; nothing is published yet.

## Status

| phase | state |
|---|---|
| 1. Monorepo | done: `packages/*` and `apps/web`, npm workspaces, one Vitest run over everything |
| 2. Lifecycle | done: `viewer.dispose()`, `preserveDrawingBuffer` option |
| 3. Registries | metrics, places, looks and belts done; cameras and other attire (gi, rash guard) not yet |
| 4. Storybook | done in `apps/storybook`: atomic levels (3D and interface), the editor mode, engine, guides, an MDX page per component, Reading panel, lazy WebGL stages; stories are not yet run as tests |
| UI | done: `@bjj3d/ui` holds the site's interface as atoms, molecules, organisms and the cinema template, with `tokens.css` and `ui.css`; `apps/web` builds its page from them. The editor's own drawer is not split into components yet |
| 5. Data | JSON Schemas in `packages/data/schemas/`; not yet checked in CI |
| 6. Publish | not started: packages export their TypeScript sources and are `private` |

## Goals

- Packages with one-way dependencies, so someone can take the pose engine without three.js,
  or the viewer without the editor.
- Extension by registration: a package exports definitions, the user passes them in. No
  dynamic plugin loading, no global registries.
- Data formats documented and versioned as public API, so a position or a technique can be
  contributed without writing code.
- A Storybook, organized by atomic design, that is the catalog, the extension guide and part
  of the test suite.

## Not goals

- Other combat sports. Nothing stops someone from trying, but no abstraction is added for it.
- Changing the skeleton. The 23 GrappleMap joints and `Pose = [Player, Player]` stay fixed;
  every package depends on them.

## Packages

```
bjj3d/
├─ packages/
│  ├─ core/          @bjj3d/core        no dependencies
│  ├─ grapplemap/    @bjj3d/grapplemap  core
│  ├─ metrics/       @bjj3d/metrics     core
│  ├─ three/         @bjj3d/three       core, metrics; three as a peer
│  ├─ editor/        @bjj3d/editor      core, grapplemap, three; vite (plugin)
│  ├─ ui/            @bjj3d/ui          tokens first; components later (see below)
│  └─ data/          @bjj3d/data        core, grapplemap, metrics
├─ apps/
│  ├─ web/           the site
│  └─ storybook/     the catalog
├─ examples/         embedding the viewer, a new submission, a new place
├─ data/             sources, as today
├─ docs/
└─ tools/            brand assets, as today
```

```
core ← grapplemap ← data
core ← metrics ← three ← editor
                   ↑
       apps/web, apps/storybook (use everything; no package imports an app)
```

Where today's files go:

| Today | Goes to | Notes |
|---|---|---|
| `grapplemap.ts`: `JOINTS`, `Joint`, `Vec3`, `Player`, `Pose`, `mirror`, `reorient`, `isReoriented`, `basicallySame` | `core` | the skeleton and pose operations |
| `grapplemap.ts`: `parse`, `decodePose`, `encodePose`, `formatBlock`, `Block`, `buildGraph` | `grapplemap` | the file format |
| `contact.ts` | `core/contact` | pure math; the most original piece |
| `landmarks.ts` | `metrics` (phase 1), `core` (phase 2) | moves once it uses `Vec3` |
| `metrics.ts` | `metrics` | becomes a registry (phase 2) |
| `mannequin.ts`, `materials.ts`, `environment.ts`, `viewer.ts` | `three` | |
| `editor.ts`, `editor-server.ts` | `editor` | |
| `data.ts` (`Db`, file types) | `data` | |
| `scripts/build-data.ts`, `validate.ts`, `calibrate.ts`, `find.ts` | `data/scripts` | they produce and check the data |
| `i18n.ts`, `locales/`, `main.ts`, `style.css`, `index.html` | `apps/web` | |
| `data/body/capsules.json` | stays in `data/body/` | read by `core/contact` callers, not by core itself; its schema is in `@bjj3d/data` |

Each package has one `index.ts`; what it does not export is internal. Subpaths
(`@bjj3d/core/contact`) keep heavy pieces out of a plain import.

## Extension points

Today each of these is a closed type or a constant table. Each becomes a registry: an id
(a string) mapped to a definition, with today's entries shipped as the built-ins.

| What | Jiu-jitsu examples | Package | Today |
|---|---|---|---|
| Submission metric | wrist lock, calf slicer, Ezekiel, biceps slicer | `metrics` | `Kind`, `KIND_BY_TAG`, `SIDED`, `read()` in `metrics.ts` |
| Attire | gi, rash guard, belt with stripes | `three` | `BELTS`, `BELT_COLORS` in `mannequin.ts` |
| Look | outline, cel shading | `three` | `Look`, `paint()` in `materials.ts` |
| Place | IBJJF competition area, garage gym | `three` | `Place`, `buildEnvironment()` in `environment.ts` |
| Camera | referee's view, defender's view | `three` | `CameraMode` in `viewer.ts` |
| Positions and transitions | gi positions, berimbolo variations | `data` | additions in `data/grapplemap/bjj3d.txt` |
| Technique texts | reviewed steps and notes, more languages | `data` | `data/techniques/` |
| Interface language | native review of a locale | `apps/web` | `web/src/locales/` |

Sketch of the contracts (names are not final):

```ts
// @bjj3d/metrics
export interface SubmissionMetric {
  id: string;                        // "elbow", "wristlock"
  tags: string[];                    // GrappleMap tags that select it
  sided: boolean;
  danger: { value: number; unit: "deg" | "cm"; when: "below" | "above" };
  read(target: Landmarks, opponent: Landmarks, side: Side): Reading;
  glowPoint(target: Landmarks, side: Side): Vec3;
}
export function createMetrics(defs: SubmissionMetric[]): MetricRegistry;
export const builtinMetrics: SubmissionMetric[];

// @bjj3d/three
export interface PlaceDef { id: string; build(theme: Theme): Environment }
export interface LookDef { id: string; paint(color: ColorRepresentation, u: SharedUniforms, onLight: boolean): Paint }
export interface AttireDef { id: string; dress(m: Mannequin, paint: Paint): void }

const viewer = new Viewer(canvas, {
  metrics: createMetrics([...builtinMetrics, wristlock]),
  places: [...builtinPlaces, ibjjfArea],
});
```

Rules:

- Registries are passed in, never global. Two viewers on one page may use different ones.
  The same goes for language: `i18n.ts` keeps the current language in module state, which
  stays in the app and does not move into a package.
- The danger threshold is part of the definition, and `validate` reads it from the registry,
  so a new submission is checked against the database the same way the built-ins are.

## Data formats are the public API

A contributor who adds a position should not need TypeScript. Each format gets a versioned
JSON Schema in `@bjj3d/data`, checked in CI:

- `graph.json` (what the viewer loads),
- `data/techniques/*.json` (names, steps, risk, notes; `reviewed` flag),
- `data/body/capsules.json` (body measures for the solver).

The GrappleMap text format stays the input for poses; additions keep using it, as the local
editor already does.

## Viewer lifecycle

A library viewer must be mountable and unmountable. Today it cannot be torn down:

- `viewer.ts:89` creates the `WebGLRenderer`; nothing releases it.
- `viewer.ts:120` starts `setAnimationLoop`; nothing stops it.
- `viewer.ts:118` adds a `resize` listener on `window`; nothing removes it.
- `viewer.ts:92` creates `OrbitControls`; `dispose()` is never called.

`setEnvironment` (`viewer.ts:144`) already releases a place's geometry and materials; the same
pattern extends to a public `viewer.dispose()` that stops the loop, removes listeners,
disposes controls, geometries, materials, textures and render targets, then calls
`renderer.dispose()` and `renderer.forceContextLoss()`. A test mounts and disposes a viewer
many times and checks that no context or listener is left behind.

`preserveDrawingBuffer: true` (`viewer.ts:89`) becomes an option. It keeps an extra copy of
every frame; only callers that read pixels back (the filmstrip) need it.

## Storybook

`apps/storybook`, with the `html-vite` framework (no React), imports the packages exactly as
a third party would. If a story needs something that is not exported, the public API is
missing it.

### Organization: atomic design

| Level | 3D | Interface |
|---|---|---|
| Tokens | fighter colours, belt colours, tension colour, capsule radii | colours, spacing, type, radii, shadows, light and dark |
| Atoms | a look, a belt | button, chip, icon, slider, "draft" badge |
| Molecules | a mannequin (one fighter), the ring and glow on the attacked joint | camera chip group, filmstrip cell, metric reading |
| Organisms | the scene (two fighters, place, lights), the directed camera | filmstrip, "Browse" panel, ⚙ sheet, "Oss!" |
| Templates | the full `Viewer` with sample data | the cinema screen: canvas, filmstrip, panel |
| Pages | | first visit, a fight in progress, fighter customization, editor |

Two rules keep the taxonomy honest:

- Stories follow the public API. The mannequin's limb, joint ball and head look like atoms,
  but they are internal to `mannequin.ts`; giving them stories would invite imports and turn
  them into API by accident.
- What is not visual stays outside the levels. Pose operations, the contact solver and the
  metrics as computation are not atoms of anything; they get an "Engine" section with
  visualizations.

Sidebar:

```
Introduction       what it is, the 23 joints, Pose, installing
Guides (MDX)       a new submission (contract → story → npm run validate)
                   a new place, look, attire
                   contributing positions and techniques (data only)
Foundations        tokens
Atoms
Molecules
Organisms
Templates
Pages
Engine             skeleton, mirror/reorient, contact solver before/after,
                   each metric over a transition, the gallery of all finishes
```

The finishes gallery is the visual twin of `docs/validation.md`: every finishing transition at
its peak, with its reading and the danger threshold.

### Customization

- Theme (`storybook/theming`): fighter amber and blue, the project icon from `tools/`,
  dark background, the site's type.
- Global toolbar: light/dark, language, place, look; a decorator applies them to every 3D
  story.
- A frame control on every 3D story, like the filmstrip.
- A small addon panel with the metric at the current frame: value, confidence, in danger or
  not. It is what someone calibrating a new submission needs to watch.

### WebGL contexts

Browsers keep about 16 WebGL contexts alive per page. A docs page or the gallery shows many
3D stories at once, so releasing memory has two parts:

1. Every 3D story calls `viewer.dispose()` in its cleanup (see "Viewer lifecycle").
2. A decorator mounts the viewer when the story enters the screen and disposes it when it
   leaves (`IntersectionObserver`), so only the visible ones (three or four) are alive.

### Stories as tests

Storybook runs stories as Vitest browser tests. The project already tests in headless
Chromium with screenshots, so part of today's `*.browser.test.ts` can become stories with
`play` functions, and each story is also a visual regression test.

### Publishing

The Pages workflow builds both: the site at `/` and the Storybook at `/storybook/`.

## Interface pieces (`@bjj3d/ui`)

Today the interface (panel, chips, filmstrip, "Oss!") is built inside `main.ts` with
`style.css`. Two steps:

1. Tokens: colours, spacing, radii and type as CSS custom properties in
   `@bjj3d/ui/tokens.css`. Cheap, and it lets anyone who embeds the viewer match the look.
2. Components, only if someone outside the site will use them: Web Components or plain DOM
   functions, no framework, so extending does not impose one. Until then, the interface
   levels of the Storybook show the site's own pieces from `apps/web`.

## Tooling

- npm workspaces (the project already uses npm).
- Build per package with Vite library mode; `exports` with subpaths; types emitted with
  `tsc --declaration`.
- Changesets for versions and changelogs; everything stays `0.x` until the registry APIs
  settle.
- CI keeps today's bar per package: 100% coverage, `npm run build`, end-to-end tests, and
  `validate` failing when `docs/validation.md` is stale. Storybook stories run in the same
  job.
- `CONTRIBUTING.md` with the "new submission" walkthrough as the main example.

## Phases

Each phase leaves the site working and CI green.

1. **Monorepo.** Move files into `packages/` and `apps/web` as in the table above; no API
   change. Done when the site builds from the packages and every test passes in its package.
2. **Lifecycle.** `viewer.dispose()` and the `preserveDrawingBuffer` option. Done when the
   mount/dispose test passes.
3. **Registries.** Metrics first (drop three from `metrics` by using `Vec3`; move `landmarks`
   to `core`), then places, looks, attire, cameras. Done when the built-ins are registered
   like any third-party definition and `validate` reads thresholds from the registry.
4. **Storybook.** Engine and metrics stories, then the "new submission" guide, then the 3D
   levels, tokens, and the site's interface pieces. Done when it publishes on Pages and runs
   in CI.
5. **Data.** JSON Schemas and the `@bjj3d/data` package with its scripts.
6. **Publish.** `core` and `metrics` first; `three` when the `Viewer` constructor stops
   changing; `editor` and `ui` last.

## Open decisions

- The npm scope (`@bjj3d/` is a placeholder).
- Licence per package: code under MIT/Apache as today; the data package carries GrappleMap's
  public-domain notice.
- Whether `@bjj3d/ui` ships components or only tokens.
- Whether the built-in registries live in their packages or in a `@bjj3d/preset-bjj` that
  bundles them.
