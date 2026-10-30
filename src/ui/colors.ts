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
