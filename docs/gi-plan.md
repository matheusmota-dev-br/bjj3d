# Plan: the gi and the belt as part of the pose

GrappleMap is no-gi: a pose is two skeletons of 23 joints and nothing else. In gi
jiu-jitsu the cloth is part of the technique. A lapel is pulled out from under the belt
and fed around a leg, a collar is opened for a choke, a belt is held to control the back.
None of that can be read from the skeleton, so the gi has to be state, stored frame by
frame like the joints.

This plan adds that state without changing the skeleton: the gi is a second layer of
points per player, plus explicit relations (grips, wraps, pins) that say what the
positions alone cannot. `docs/gi-plan.html` shows it with drawings and a 3D preview over
real GrappleMap positions and one transition, with the fabric driven by the points.

Nothing here is built yet.

## Two things called "the gi"

| | What | Where it lives | Changes per frame |
|---|---|---|---|
| Appearance | gi colour, belt rank, degrees (stripes) | the fighter's options in the viewer | no |
| State | where the lapels, the belt's tails, the skirt and the cuffs are; who holds what | the block's frames | yes |

The same transition can be watched in a white gi with a purple belt or a blue gi with a
black belt; that is appearance. Whether the lapel is under the belt or around a leg is
state, and changing it changes the technique.

## Free points and anchored regions

The rule that keeps the extra degrees of freedom small: **a free point only where the
cloth can leave the body.** Where the cloth follows the body (the sleeve over the
forearm, the pants over the shin, the belt around the waist), there is no point to store:
a grip there names a place on a bone, an anchored region, and the place moves with the
skeleton.

### gi@1: the free points, per player

| Name | Points | From → to | Why it is free |
|---|---|---|---|
| `Nape` | 1 | back of the collar | collar grips from behind, the root of both lapels |
| `LeftLapel` | 7 | `0` neck side, `1` collarbone, `2` upper chest, `3` sternum, `4` lower chest, `5` at the belt, `6` skirt corner | collar and lapel grips, lapel feeds, worm and lapel guards |
| `RightLapel` | 7 | the same on the right | |
| `BackHem` | 3 | wearer's right side, back centre, left side | jacket pulled up or over the head |
| `LeftCuff`, `RightCuff` | 1 each | sleeve opening | sleeve pulled past the hand, sleeve grips that stretch it |
| `LeftPantsCuff`, `RightPantsCuff` | 1 each | pants opening | pants grips at the ankle |
| `BeltKnot` | 1 | knot, in front | |
| `LeftBeltTail`, `RightBeltTail` | 3 each | from the knot to the tip | the tails hang and can be held |

29 points per player, 87 numbers. The skeleton has 69, so a frame goes from 138 numbers
to 312.

The left lapel is the edge of the left panel. It starts at the left side of the neck and
crosses the chest to the wearer's right hip, over the right panel (left over right).

### Anchored regions

| Region | Parameter | Follows |
|---|---|---|
| `LeftSleeve`, `RightSleeve` | `t` from 0 (shoulder) to 1 (cuff) | `Shoulder → Elbow → Cuff` |
| `LeftPants`, `RightPants` | `t` from 0 (hip) to 1 (pants cuff) | `Hip → Knee → PantsCuff` |
| `Belt` | `θ` around the waist: 0 at the knot, 0.5 at the back | the waist, between `MidHip` and `Core` |
| `Jacket` | `u` around the torso (0 front, 0.5 back), `v` from 0 (belt) to 1 (shoulders) | the torso; lat and shoulder grips |

### One way to name a target

```
{ "player": 1, "chain": "LeftLapel", "at": 3.4 }     between points 3 and 4 of a chain
{ "player": 1, "point": "Nape" }                     a single point
{ "player": 0, "region": "LeftSleeve", "t": 0.9 }    a place on an anchored region
{ "player": 1, "region": "Belt", "θ": 0.5 }          the back of the belt
```

## Relations

Positions alone are ambiguous at this resolution. Seven points cannot tell whether a
lapel goes behind a leg or in front of it, so each relation is stored, over a range of
keyframes, and checked against the positions.

| Relation | Says | Fields | Checked by |
|---|---|---|---|
| `grip` | a hand holds a target | `by: {player, hand}`, `on: target`, `kind?` (`fingers-in`, `thumb-in`, `pistol`, `pocket`, `pinch`) | the hand within 6 cm of the target |
| `wrap` | a stretch of a chain goes around a bone | `chain: {player, chain, from, to}`, `around: {player, bone: [Joint, Joint]}`, `turns` (signed) | winding number of the stretch around the bone within ±0.25 of `turns` |
| `pin` | cloth trapped under a body part | `chain: {...}`, `under: {player, bone}` | every point of the stretch within 2 cm of that bone's capsule |

Plus one piece of per-frame state:

| State | Default | Says |
|---|---|---|
| `untucked: ["LeftLapel"]` | both tucked | the belt no longer holds that lapel; point `5` is free |

Feeding a lapel needs no new relation. "The lapel is pulled out, goes under the arm and
comes back to the other hand" is `untucked` + `wrap` + `grip`.

## A frame and a block on disk

Each frame keeps GrappleMap's encoding (2 base-62 digits per coordinate, millimetres):
276 characters of skeleton, then 174 per player of gi, 624 in all.

```
| skeleton, both players: 276 | gi, player 0: 174 | gi, player 1: 174 |
```

The gi points use GrappleMap's ranges (`x` and `z` from -2 to 1.84 m, `y` from 0 to
3.84 m) and are absolute, like the joints. So `mirror` swaps `Left…` and `Right…` chains
with the same rule as joints, and `reorient` moves them with the bodies.

A block is one JSON file per position or transition in `data/blocks/`, with a stable id:

```json
{
  "format": "bjj3d/block@1",
  "id": "cross-collar-choke-from-closed-guard",
  "name": "cross collar choke from closed guard",
  "tags": ["closed_guard", "cross_collar_choke"],
  "properties": ["bottom"],
  "refs": [],
  "attire": ["gi@1", "gi@1"],
  "frames": [
    { "pose": "zfazzGwOazEX…", "attire": ["Kd3aQ…", "Lm0bT…"] }
  ],
  "state": [{ "frames": [5, 7], "player": 0, "untucked": [] }],
  "relations": [
    { "type": "grip", "frames": [1, 7], "by": { "player": 1, "hand": "RightHand" },
      "on": { "player": 0, "chain": "RightLapel", "at": 0.5 }, "kind": "fingers-in" },
    { "type": "grip", "frames": [3, 7], "by": { "player": 1, "hand": "LeftHand" },
      "on": { "player": 0, "chain": "LeftLapel", "at": 0.5 }, "kind": "thumb-in" }
  ],
  "from": "distance-closed-guard"
}
```

- `attire` per player: one fighter in a gi and the other in a rash guard is allowed.
- A frame without `attire` gets the rest drape (below), so every GrappleMap block is a
  valid no-relations gi block.
- `from` and `to` name ids. They are still checked geometrically (`isReoriented`), so a
  wrong id fails the build.

### GrappleMap stays as it is

`GrappleMap.txt` is the imported source, read-only. `data/grapplemap/ids.json` gives each
of its blocks an id, keyed by its line and a hash of its poses, so an upstream change is
detected and not silently renumbered. Techniques (`data/techniques/*.json`) reference ids
instead of `grapplemap_line`. Our own additions move from `bjj3d.txt` (empty today) to
`data/blocks/`.

## Drape and interpolation

Physics is a tool here; the stored points are what counts. A cloth simulation as the
source of truth would make the data impossible to review and to reproduce.

- **Rest drape.** `drape(player, gi) → points`: the gi@1 points laid on the torso's frame
  (`Neck`, `MidHip`, the shoulder line), then a fixed number of position-based steps:
  gravity on the hanging points (skirt corners, hem, belt tails), maximum segment
  length, no point inside a capsule, none under the mat. It is deterministic, so the
  viewer can compute it at runtime for every frame without stored gi points, and
  `graph.json` only grows for authored gi blocks.
- **Editor.** The editor starts every new frame from the drape, and the author moves only
  what the technique needs.
- **In-between frames.** Densifying (`SUBSTEPS`) interpolates the gi points linearly,
  then projects the same constraints, with the relations of that frame range as hard
  constraints (a gripped point stays at the hand). This runs after the body's contact
  solve, in the same cached step of `build-data`.
- **The fabric follows the points.** What the viewer draws is a mesh built from the
  skeleton with the gi points as its handles: each jacket panel runs from the back seam
  around the side to its front edge, and that edge goes through the panel's lapel chain;
  the skirt's bottom goes through `BackHem`; each sleeve ends at its cuff; the belt goes
  around the jacket at the belt line and its tails follow their chains. Move a point and
  the cloth around it follows, as bones move a skin. An authored garment mesh can replace
  the procedural one later by binding its vertices to the same joints and points with
  weights. Wrinkles, if any, are a render-only pass and never go back into the data.
- **What the fabric respects.** The jacket is laid on the spine (`MidHip → Core → Neck`,
  the torso capsules' axis), so it bends with the back instead of being pushed into a
  hump. The belt cinches it: cloth near the belt line is pulled inside the belt's ring, so
  the belt is on top all the way round. No cloth vertex stays inside a capsule: of its own
  body (a knee or an elbow never pokes through, a sleeve keeps out of both arms) or of the
  other fighter (a hand or a knee presses the cloth instead of passing through it). The
  lapel chain itself is data and is not moved by this pass. Poses go through the contact
  solver with capsules thickened by the gi first, so the bodies keep the cloth's thickness
  between them.
- **Cloth never moves the body.** In gi@1, pulling a lapel does not drag the opponent.
  Tension is a reading (see metrics), not a force.

Cloth can bunch but not stretch, so segment lengths are a maximum and not a target: a
segment may be shorter than at rest, never more than 5% longer.

## Validation (`pnpm validate`)

| Rule | Tolerance |
|---|---|
| Segment length | at most 105% of rest (rest scales with the torso's length) |
| `Nape` and lapel point `0` on the collar line | 3 cm |
| A tucked lapel's point `5` at the belt band | 4 cm |
| `grip`: the hand at the target | 6 cm |
| `wrap`: winding number around the bone | `turns` ± 0.25 |
| `pin`: the stretch at the bone's capsule | 2 cm |
| No gi point inside a capsule | 1 cm, as the contact solver's `OVERLAP` |
| Relations name existing chains, points and frames | exact |

The winding number: project the stretch onto the plane across the bone, sum the signed
angles each segment sweeps around the bone's axis, divide by 2π.

## Metrics

The gi chokes become metrics in the `metrics` registry, calibrated like the others in
`docs/validation.md`:

- **Collar chokes** (cross collar, bow and arrow, clock, baseball bat, loop): two grips on
  the collar, or one grip and the `Nape`, form a loop around the neck. The reading is how
  much shorter the loop is than at rest.
- **Ezekiel**: a grip on the player's own sleeve (`by` and `on` are the same player) and
  the forearm across the neck.

## Appearance

| Option | Values |
|---|---|
| Gi colour | white, blue, black (a registry like `BELT_COLORS`) |
| Belt | the existing `BELTS`, plus kids' ranks in the registry |
| Degrees | 0 to 4 white stripes on the black bar of a coloured belt; 0 to 6 on the red bar of a black belt |

Today every mannequin wears a belt. With attire, the belt belongs to the gi; no-gi
fighters have none.

## Packages

```
core ← attire ← three ← editor
          ↑  ↖
        data  metrics
```

- **`@bjj3d/attire`** (new): the attire registry, `gi@1` (its points, chains, regions,
  rest lengths, `drape`), the constraint projection, target resolution, winding number.
  Pure math on `Vec3`, no three.js, so `data` and `metrics` can use it.
- **`@bjj3d/three`**: the gi mesh, driven by the points (procedural first, an authored
  garment bound to the same points later); the belt with degrees on its tail; capsules a
  little thicker in a gi, so bodies do not sink into the cloth.
- **`@bjj3d/data`**: `block.schema.json`, `ids.json`, the build merging blocks and
  GrappleMap.
- **`@bjj3d/editor`**: moving chain points, untucking, adding and ending relations.
- **`@bjj3d/metrics`**: the collar-choke and Ezekiel readings.

## Phases

Each phase leaves the site working and CI green.

1. **Blocks and ids.** `bjj3d/block@1` without attire, `ids.json` for GrappleMap,
   techniques reference ids. Nothing visible changes.
2. **gi@1 visible.** `@bjj3d/attire` with the rest drape, `three` draws it, belt degrees,
   gi as a fighter option. Every GrappleMap transition can be watched in a gi.
3. **Editor.** Move gi points, untuck, add grips; the grip and length rules in
   `validate`.
4. **Wraps and pins.** The relations, the winding number, the cloth solve between
   keyframes.
5. **First gi techniques.** Cross collar from closed guard, Ezekiel from mount, bow and
   arrow from the back, a lapel feed.
6. **Metrics.** Collar chokes and Ezekiel, calibrated, in `docs/validation.md`.

## Open decisions

- How many points per lapel. Seven is enough for collar, lapel and skirt grips; a worm
  guard wrap may want more around the leg. Since gi@1 is versioned, gi@2 can add points.
- Lapel overlap under `mirror`. A mirrored gi is right over left. Either accept it (the
  mirror of a technique is a mirror) or store the overlap as state and keep it when
  mirroring.
- Body size. Rest lengths scale with the torso; whether GrappleMap's figures are close
  enough to one size for a single gi@1 needs measuring.
- Feet on cloth: a foot on the biceps in spider guard, a foot pushing the sleeve. Is a
  foot `grip` (a hook) enough, or does it need a `push` relation?
- Licence of new data. GrappleMap is public domain. Contributing gi blocks under CC0
  keeps the whole database under one notice.
- Whether `@bjj3d/attire` is its own package or `@bjj3d/core/attire`.
