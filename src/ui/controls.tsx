import type { LucideIcon } from 'lucide-react'
import { Minus, Plus } from 'lucide-react'
import { fmt, mm } from './format'
import type { ToastMsg } from './useToast'
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon
  variant?: 'secondary' | 'primary' | 'ghost'
  onBand?: boolean
}

export function Button({ icon: Icon, variant = 'secondary', onBand, className = '', children, ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'secondary' && variant, onBand && 'on-band', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} {...rest}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
}

type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
  onBand?: boolean
  size?: number
  pressed?: boolean
}

export function IconButton({ icon: Icon, label, onBand, size = 16, pressed, className = '', ...rest }: IconBtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={['icon-btn', onBand && 'on-band', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon size={size} />
    </button>
  )
}

export interface SegOption<T> {
  value: T
  label: ReactNode
  kbd?: string
  disabled?: boolean
  title?: string
}

export function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
  onBand,
  inWell,
  label,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  onBand?: boolean
  inWell?: boolean
  label?: string
}) {
  return (
    <div role="tablist" aria-label={label} className={['seg', onBand && 'on-band', inWell && 'in-well'].filter(Boolean).join(' ')}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.kbd && <kbd>{o.kbd}</kbd>}
        </button>
      ))}
    </div>
  )
}

/**
 * A flat choice on a floating surface (a pill or popover): no track, the chosen option has a muted fill, the rest are
 * muted text. The dock's quick picks and the stand chip use the same language. `tiles` stacks an icon over each label.
 */
export function FlatChoice<T extends string | number | boolean>({
  options,
  value,
  onChange,
  label,
  tiles,
  className = '',
  disabled,
}: {
  /** `disabled`: this choice cannot be made here; `title` says why. */
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
  label: string
  tiles?: boolean
  className?: string
  /** Shown, but not to be changed (a side of a counter held to a plate, K16). */
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={['flat-choice', tiles && 'tiles', className].filter(Boolean).join(' ')}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title} disabled={disabled || o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** FlatChoice where each choice is on or off by itself (the shelves of a counter, K19). */
export function FlatToggles<T extends string | number>({
  options,
  value,
  onToggle,
  label,
  disabled,
}: {
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[]
  value: readonly T[]
  onToggle: (v: T, on: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flat-choice">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button key={String(o.value)} type="button" role="checkbox" aria-checked={on} title={o.title} disabled={disabled || o.disabled} onClick={() => onToggle(o.value, !on)}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A section of settings (Bjørn 8.11.2026), in the drawers and the stand chip alike: one title in the app's muted capitals,
 * with what it is set to when its content does not show it («HELE VEGGEN · HVIT 9010»), its icon buttons on the same
 * line, then the content straight on the surface. Sections are parted by air. Only four kinds of text: the surface's
 * title, section titles, muted body text and numbers.
 */
export function Section({ title, aside, tools, className, children }: { title: string; aside?: string; tools?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <section className={className ? `set-sec ${className}` : 'set-sec'}>
      <div className="set-sec-head">
        <h4>{aside ? `${title} · ${aside}` : title}</h4>
        {tools && <span className="set-tools">{tools}</span>}
      </div>
      {children}
    </section>
  )
}

/** Parse a typed length: comma or point, units and spaces ignored. Null when it is not a number. */
function parseLength(text: string): number | null {
  const n = Number(text.replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && text.trim() !== '' ? n : null
}

/**
 * A length in metres: a small field with its label above, typed with comma or point. With `step`, − and + beside it
 * step the length and a typed one snaps to the step; `min` and `max` refuse lengths outside. Used for the stand's
 * sides and for sizes in the drawers, where the handles in the drawing do the rest.
 */
export function Dim({
  label,
  value,
  onChange,
  decimals = 1,
  step,
  min = 0,
  max = Infinity,
  big,
  unit = 'm',
}: {
  label: string
  value: number
  onChange: (n: number) => void
  decimals?: number
  /** The value is in metres either way; 'mm' shows and takes it in millimetres (a shelf's height). */
  unit?: 'm' | 'mm'
  step?: number
  min?: number
  max?: number
  /** Large number with its unit, the field shown only on hover and focus (the stand's sides). */
  big?: boolean
}) {
  /** False, and nothing changes, unless `n` is a new length in range. */
  const set = (n: number | null) => {
    if (n === null) return false
    const x = step ? Math.round(n / step) * step : n
    if (x < min || x > max || x === value) return false
    onChange(x)
  }
  const inMm = unit === 'mm'
  const shown = inMm ? mm(value) : fmt(value, decimals)
  const parse = (text: string) => {
    if (!inMm) return parseLength(text)
    const n = Number(text.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) && text.trim() ? n / 1000 : null
  }
  const stepText = step ? (inMm ? `${mm(step)} mm` : `${fmt(step)} m`) : ''
  const field = (
    <CommitInput
      className="field num"
      size={big ? 1 : undefined}
      style={big ? { width: `${shown.length * 0.62 + 0.1}em` } : undefined}
      aria-label={`${label} i ${inMm ? 'millimeter' : 'meter'}`}
      inputMode="decimal"
      value={shown}
      selectOnFocus
      onCommit={(text) => set(parse(text))}
    />
  )
  // Only the field (with its unit when big) is a label: wrapping − and + in it too would light the − on hover
  const input = big ? (
    <label className="dim-value">
      {field}
      <span className="dim-unit">{unit}</span>
    </label>
  ) : (
    field
  )
  return (
    <div className={big ? 'dim big' : 'dim'}>
      <span className={big ? 'dim-label' : 'eyebrow'}>{label}</span>
      {step ? (
        <span className="dim-step">
          <IconButton icon={Minus} label={`${label}: ${stepText} mindre`} size={14} disabled={value - step < min} onClick={() => set(value - step)} />
          {input}
          <IconButton icon={Plus} label={`${label}: ${stepText} mer`} size={14} disabled={value + step > max} onClick={() => set(value + step)} />
        </span>
      ) : (
        input
      )}
    </div>
  )
}

export function Stepper({ value, min = 0, max = 99, onChange }: { value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)))
  return (
    <span className="stepper">
      <IconButton icon={Minus} label="Færre" size={14} disabled={value <= min} onClick={() => set(value - 1)} />
      <span className="val">{value}</span>
      <IconButton icon={Plus} label="Flere" size={14} disabled={value >= max} onClick={() => set(value + 1)} />
    </span>
  )
}

/** Counter that shows a single + until the item is in use. */
export function Counter({ value, onChange, label, max = 99 }: { value: number; onChange: (v: number) => void; label: string; max?: number }) {
  return value > 0 ? <Stepper value={value} max={max} onChange={onChange} /> : <IconButton icon={Plus} label={label} onClick={() => onChange(1)} />
}

type CommitInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onBlur' | 'onKeyDown' | 'onFocus'> & {
  value: string
  /** Called on blur (Enter blurs). Return false to put the stored value back in the field. */
  onCommit: (text: string) => boolean | void
  /** Select the text on focus, for numbers that are usually replaced. */
  selectOnFocus?: boolean
}

/** Text field that edits freely and saves on blur or Enter. A new stored value resets the field. */
export function CommitInput({ value, onCommit, selectOnFocus, ...rest }: CommitInputProps) {
  return (
    <input
      key={value}
      defaultValue={value}
      onFocus={selectOnFocus ? (e) => e.target.select() : undefined}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onBlur={(e) => {
        if (onCommit(e.target.value) === false) e.target.value = value
      }}
      {...rest}
    />
  )
}

export function Toast({ msg }: { msg: ToastMsg | null }) {
  if (!msg) return null
  return (
    <div className="toast" role="status">
      <span>{msg.text}</span>
      {msg.action && <button onClick={msg.onAction}>{msg.action}</button>}
    </div>
  )
}

/** A hidden picker for one image file, opened by a surrounding <label> or through `ref`. Picking the same file again works. */
export function ImageInput({ onFile, ref }: { onFile: (f: File) => void; ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) onFile(f)
        e.target.value = ''
      }}
    />
  )
}
