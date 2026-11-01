// Colour tokens (styles/tokens/colors.css) as values for inline SVG fill and stroke.
export const INK = 'rgb(var(--ink))'
export const INK_MUTED = 'rgb(var(--ink-muted))'
export const INK_FAINT = 'rgb(var(--ink-faint))'
export const SURFACE = 'rgb(var(--surface))'
export const CANVAS = 'rgb(var(--canvas))'
export const SUNKEN = 'rgb(var(--sunken))'
export const BORDER = 'rgb(var(--border))'
export const BORDER_STRONG = 'rgb(var(--border-strong))'
export const BLOCK = 'var(--al-block)'

/** Build system hardware in 2D drawings (app.css). */
export const ALU = 'var(--alu)'
export const ALU_POST = 'var(--alu-post)'
export const FEET = 'var(--feet)'
export const FABRIC = 'var(--fabric)'

/** One colour per build layer, shared by the plan and the calc panel. */
export const LAYER_COLOR = {
  walls: 'var(--line-sky)',
  textile: 'var(--line-violet)',
  openings: 'var(--line-slate)',
} as const

const rgbOf = (hex: string): number[] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const mix = (rgb: number[], to: number, t: number) =>
  `#${rgb.map((c) => Math.round(c + (to - c) * t).toString(16).padStart(2, '0')).join('')}`

/** A colour moved part of the way (0–1) toward black. */
export const shade = (hex: string, t: number) => {
  const rgb = rgbOf(hex)
  return rgb ? mix(rgb, 0, t) : hex
}

/**
 * Joint between carpet tiles in plan and on paper: a strong shade of the tile's own colour, darker on a light tile and
 * lighter on a dark one, so the laid pattern reads on every colour. 3D keeps a finished look instead (scene3d/build).
 */
export function jointColor(hex: string | undefined): string {
  const rgb = hex ? rgbOf(hex) : null
  if (!rgb) return 'rgb(0 0 0 / .4)'
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  return lum > 0.4 ? mix(rgb, 0, 0.5) : mix(rgb, 255, 0.45)
}
