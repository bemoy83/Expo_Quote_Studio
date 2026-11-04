// Sizes, colours and text styles of the plan, shared by PlanView and its layers (plan/layers/).
import type { Side } from '../../domain/types'
import { INK_FAINT, LAYER_COLOR } from '../colors'
import { linePx, type PlanScale } from './planScale'

/**
 * Line widths in the plan, m. Schematic, not to scale (3D is): a wall and a textile are both drawn 60 mm (both are 40),
 * and a textile on a wall face sits just outside the wall line so the two never overlap.
 */
export const PLAN_WALL = 0.06
export const PLAN_TEXTILE = PLAN_WALL
export const PLAN_TEXTILE_OFFSET = PLAN_WALL / 2 + PLAN_TEXTILE / 2 + 0.005

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

/** A post: a white square with an ink edge, a little wider than the wall. */
export const postSize = (s: PlanScale) => Math.max(WALL_MIN, wallWidth(s) + linePx(s, 1.5))

/** Margin around the stand for the aisle and the side labels, m. */
export const PLAN_MARGIN = 1.3

export const WALL = LAYER_COLOR.walls

export const TEXTILE = LAYER_COLOR.textile

/** Joints between carpet tiles, m: wide enough to read in the small plan on the quote and the work order. */
export const JOINT_WIDTH = 0.025

/** Metre grid: faint ink, a hairline of GRID_PX screen pixels (planScale.ts). */
export const GRID = 'rgb(var(--ink) / .1)'
export const GRID_PX = 0.5

/** Marker colours of the working drawing (docs/arbeidstegning.md): orange for textile, green for print and decals. */
export const TUSJ_TEXTILE = 'var(--tusj-tekstil)'
export const TUSJ_PRINT = 'var(--tusj-trykk)'

/** Reserved for a snekret (carpentry) wall, which is not in the model yet: diagonal hatch at 45°, no colour. */
export const SNEKRET_HATCH = { angle: 45, colour: null } as const

/** Half-metre lines while painting floor. */
export const GRID_FINE = 'rgb(0 0 0 / .1)'

/** Opacity of layers outside the hovered calc group. */
export const DIMMED = 0.25

export const MONO = { font: '500 0.24px var(--font-numeric)', fill: INK_FAINT }

/** Side names and stand dimensions around the stand: context, so quieter than the drawing itself. */
export const SIDE = { font: '500 0.17px var(--font-ui)', fill: INK_FAINT }

export const SIDE_DIM = { font: '500 0.15px var(--font-numeric)', fill: INK_FAINT }

export const SIDE_LABEL: Record<Side, string> = { back: 'Bak', front: 'Front', left: 'Venstre', right: 'Høyre' }
