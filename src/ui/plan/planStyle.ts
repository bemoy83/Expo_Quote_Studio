// Sizes, colours and text styles of the plan, shared by PlanView and its layers (plan/layers/).
import type { Side } from '../../domain/types'
import { INK_FAINT } from '../colors'
import { linePx, sizePx, type PlanScale } from './planScale'

/** Nominal wall width in model metres, for gaps around labels (the line itself is drawn in screen pixels). */
export const PLAN_WALL = 0.06

/** Narrowest a wall is drawn, m: the post profile. */
const WALL_MIN = 0.04

/**
 * A system wall in the working drawing: an ink line of 5 screen pixels with a 3 px core in the plate's RAL, so a thin
 * ink edge shows on each side. Never thinner than the post profile.
 */
export const wallWidth = (s: PlanScale) => Math.max(WALL_MIN, linePx(s, 5))
export const wallCore = (s: PlanScale) => wallWidth(s) - linePx(s, 2)

/** The header panel over a door or curtain: a thin RAL line with ink edges. */
export const headerWidth = (s: PlanScale) => linePx(s, 3)
export const headerCore = (s: PlanScale) => linePx(s, 2)

/**
 * A textile wall (InFrame and free-standing): an ink frame of 5 px, the orange fill of 3,2 px on top and, in full
 * detail, ink cross dashes like fabric stretched in a frame. An InFrame frame sits just outside the wall line.
 */
export const textileWidth = (s: PlanScale) => Math.max(WALL_MIN, linePx(s, 5))
export const textileFill = (s: PlanScale) => linePx(s, 3.2)
export const textileOffset = (s: PlanScale) => wallWidth(s) / 2 + textileWidth(s) / 2 + sizePx(s, 1)

/** Print and decals: a band of 2,4 px just outside the wall line, on the printed face only. */
export const printBand = (s: PlanScale) => linePx(s, 2.4)
export const printOffset = (s: PlanScale) => wallWidth(s) / 2 + printBand(s) / 2

/** A takdrager in full detail: a body at least 3,6 px wide with two dashed edges. */
export const beamBody = (s: PlanScale, thickness: number) => Math.max(thickness, linePx(s, 3.6))
/** Grey fill of a takdrager body (Bjørn 5.11.2026: 20 % ink, was 9 %). */
export const BEAM_FILL = 0.2
/** Dashes of takdragere, as on hall maps: 6 px line, 3 px gap. */
export const beamDash = (s: PlanScale) => `${sizePx(s, 6)} ${sizePx(s, 3)}`

/** Foot plates under free walls and textile walls: a thin dashed outline. */
export const footStroke = (s: PlanScale) => linePx(s, 0.75)
export const footDash = (s: PlanScale) => `${sizePx(s, 2.5)} ${sizePx(s, 1.5)}`

/** Chosen in the plan: a soft halo in the stand sketch band's green, a colour no line type has (Bjørn 12.11.2026). */
export const HALO = 'var(--plan-chosen)'
export const HALO_OPACITY = 0.5
/** A selected line: the halo 5 px wider than the line. */
export const haloWidth = (s: PlanScale, w: number) => w + linePx(s, 5)
/** The same halo round a shape (shelf, furniture, counter): its outline stroked this wide, half of it outside. The
 *  thing itself keeps its thin edge; chosen is the halo alone, everywhere in the plan (Bjørn 12.11.2026). */
export const outlineHalo = (s: PlanScale) => linePx(s, 5)

/** A post: a white square with an ink edge, a little wider than the wall. */
export const postSize = (s: PlanScale) => Math.max(WALL_MIN, wallWidth(s) + linePx(s, 1.5))

/**
 * Previews while drawing (docs/forhandsvisning.md): what a click or release would store, drawn by the plan's own
 * layers at this strength, already while hovering (plan/next.ts); invalid is grey and hatched. Sizes in screen pixels.
 */
export const PHANTOM = {
  /** Walls and areas: inner wall, textile, free-standing textile, carpet tiles, roll carpet. */
  area: 0.4,
  /** Thin lines: takdrager, door, decal, furniture. */
  line: 0.6,
} as const

/** The ring at the ends of Tøm's stroke: surface fill with an ink edge. */
export const RING = { r: 3.2, edge: 1.1 } as const

/** The dashed ink outline around the chosen engangsteppe lanes, and the light edge under it on a dark floor. */
export const AIM = { width: 0.8, dash: 3, gap: 2.5, halo: 2.4, haloOpacity: 0.8 } as const
export const aimDash = (s: PlanScale) => `${sizePx(s, AIM.dash)} ${sizePx(s, AIM.gap)}`

/** Snap dots: faint ink, larger on whole metres. */
export const SNAP_DOT = { metre: 1.2, other: 0.8, fill: 'rgb(var(--ink) / .3)' } as const

/** The one 45° hatch of the plan for what will not be there: an invalid target, and what Tøm is about to take. */
export const HATCH = { line: 'rgb(var(--ink) / .55)', lineWidth: 0.8, spacing: 3.2 } as const

/** Invalid: grey ink in the symbol's width with the hatch over it. */
export const INVALID = { fill: 'rgb(var(--ink) / .3)' } as const

/** The dark measure pill while dragging out a length, set this far outside the stroke. */
export const PILL = { height: 18, radius: 5, font: 10.5, pad: 7, gap: 6 } as const

/** Margin around the stand for the aisle and the side labels, m. */
export const PLAN_MARGIN = 1.3

/**
 * Floor in full colour (docs/arbeidstegning.md, Gulv): a joint is a hairline of 1 px in a strong shade of the floor's
 * own colour (`jointColor`), only where two tiles or lanes meet, so the floor's edge is drawn by the walls and the stand
 * outline alone. Thinner than every ink line on the floor, so the construction stays on top.
 */
export const JOINT_PX = 1
export const jointWidth = (s: PlanScale) => linePx(s, JOINT_PX)

/** Lane number and roll arrow on rolled floor, px: number in the numeric font, arrow as long as the lane allows. */
export const LANE_MARK = { font: 12, arrow: 40, stroke: 1.2, head: 4, gap: 4 } as const

/** Metre grid: faint ink, a hairline of GRID_PX screen pixels (planScale.ts). */
export const GRID = 'rgb(var(--ink) / .1)'
export const GRID_PX = 0.5

/** Marker colours of the working drawing (docs/arbeidstegning.md): orange for textile, green for print and decals. */
export const TUSJ_TEXTILE = 'var(--tusj-tekstil)'
export const TUSJ_PRINT = 'var(--tusj-trykk)'

/** Half-metre lines while painting floor: a dotted ink hairline like the metre grid, in screen pixels. */
export const GRID_FINE = { stroke: 'rgb(var(--ink) / .14)', width: 0.5, dash: 2, gap: 3 } as const

/** Opacity of layers outside the hovered calc group. */
export const DIMMED = 0.25

/** Side names and stand dimensions around the stand: context, so quieter than the drawing itself. */
export const SIDE = { font: '500 0.17px var(--font-ui)', fill: INK_FAINT }


export const SIDE_LABEL: Record<Side, string> = { back: 'Bak', front: 'Front', left: 'Venstre', right: 'Høyre' }
