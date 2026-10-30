import type { LucideIcon } from 'lucide-react'
import { Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

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
