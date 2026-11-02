import type { LucideIcon } from 'lucide-react'
import { Minus, Plus } from 'lucide-react'
import { fmt } from './format'
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'

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
}: {
  options: { value: T; label: ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  label: string
  tiles?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={['flat-choice', tiles && 'tiles', className].filter(Boolean).join(' ')}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
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
}: {
  label: string
  value: number
  onChange: (n: number) => void
  decimals?: number
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
  const field = (
    <CommitInput
      className="field num"
      size={big ? 2 : undefined}
      aria-label={`${label} i meter`}
      inputMode="decimal"
      value={fmt(value, decimals)}
      selectOnFocus
      onCommit={(text) => set(parseLength(text))}
    />
  )
  return (
    <label className={big ? 'dim big' : 'dim'}>
      <span className={big ? 'dim-label' : 'eyebrow'}>{label}</span>
      {step ? (
        <span className="dim-step">
          <IconButton icon={Minus} label={`${label}: ${fmt(step)} m mindre`} size={14} disabled={value - step < min} onClick={() => set(value - step)} />
          {field}
          {big && <span className="dim-unit">m</span>}
          <IconButton icon={Plus} label={`${label}: ${fmt(step)} m mer`} size={14} disabled={value + step > max} onClick={() => set(value + step)} />
        </span>
      ) : (
        field
      )}
    </label>
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

/** On/off switch. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}>
      <span className="knob" />
    </button>
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

export interface ToastMsg {
  text: string
  action?: string
  onAction?: () => void
}

/** One toast at a time; a new one replaces the old. */
export function useToast(): [ToastMsg | null, (m: ToastMsg | string) => void] {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  const t = useRef(0)
  const show = useCallback((m: ToastMsg | string) => {
    window.clearTimeout(t.current)
    setMsg(typeof m === 'string' ? { text: m } : m)
    t.current = window.setTimeout(() => setMsg(null), 3500)
  }, [])
  useEffect(() => () => window.clearTimeout(t.current), [])
  return [msg, show]
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
