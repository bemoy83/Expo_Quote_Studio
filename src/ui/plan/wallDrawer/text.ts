// The wall drawer's words: the title, the line under it and the help line across the bottom, for what is chosen.
import type { ProductionPiece } from '../../../calc/textile/production'
import { textilePos } from '../../../calc/textile/free'
import { wallModules } from '../../../domain/grid'
import { roomName, roomSize } from '../../../domain/rooms'
import { foilBlocked } from '../../../domain/decor'
import type { FaceSide } from '../../../domain/faces'
import { printsOn } from '../../../domain/print'
import { highWarning, offRow, shelfBlocked, tooHigh } from '../../../domain/shelves/model'
import type { Foil, Opening, Shelf, TextileWall, Variant, Wall } from '../../../domain/types'
import type { Rules } from '../../../rules/rules'
import { hintLine, REUSE_NOTE } from '../drawerText'
import { isStandWall, wallLabel } from '../../../domain/walls'
import { RECIPES } from '../../../foga/recipes'
import { count, fmt, mm } from '../../format'
import type { RoomRun } from './face'
import type { PaintTool } from '../paintTools'

/** The drawer's title: the frame or decal chosen, else the wall (a room's wall, an inner wall or a stand wall). */
export function wallTitle(v: Variant, w: Wall, T?: TextileWall, F?: Foil, S?: Shelf): string {
  // One name for every textile wall, with its position (X16)
  if (T) return `Tekstilvegg ${textilePos(v, T.id)}`
  if (S) return 'Hylle'
  if (F) return F.full ? (F.upper ? 'Print på øvre felt' : 'Print på hel plate') : 'Foliedekal'
  const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
  if (room) return `${roomName(room)} ${roomSize(room)} · vegg`
  const label = wallLabel(w)
  return label === 'Innervegg' ? label : `Standvegg · ${label.toLowerCase()}`
}

/** The line under the title: the frame's size and cloth, the decal's plate and size, or what the wall holds. */
export function wallMeta(
  v: Variant,
  w: Wall,
  x: { L: number; T?: TextileWall; F?: Foil; S?: Shelf; piece?: ProductionPiece; openings: Opening[]; /** Plates as built, a split module's parts each one (V10); else one per module. */ plates?: number; odd: number; tex: TextileWall[]; rooms: RoomRun[]; shelves?: Shelf[]; /** How the wall is held, as the calc built it (S2, S9): its foot plates and ceiling wires, and a lift for work over the height limit. */ held?: { feet: number; wires: number; lift: boolean } },
): string {
  const { L, T, F, S, piece, openings, plates, odd, tex, rooms, shelves = [], held } = x
  if (S) {
    const { w: width, d: depth } = RECIPES.shelf.board
    const n = shelves.filter((f) => f.module === S.module).length
    return [`Felt ${S.module + 1}`, `${mm(width / 1000)} × ${mm(depth / 1000)} mm`, n > 1 ? `${n} hyller i feltet` : ''].filter(Boolean).join(' · ')
  }
  if (T && piece) {
    // The frame as built (Bjørn 8.11.2026): its size, the print file, the braces and the rail splice
    const k = (n: number) => mm(n / 1000)
    return [
      `ramme ${k(piece.W)} × ${k(piece.H)} mm`,
      piece.fill === 'print' ? `fil ${k(piece.pw)} × ${k(piece.ph)}` : '',
      `${fmt(piece.area)} m² ${piece.fill === 'reuse' ? 'kundens duk' : piece.fill === 'white' ? 'hvit duk' : 'trykk'}`,
      piece.braceAt.length ? count(piece.braceAt.length, 'stag', 'stag') : '',
      piece.railCuts.length > 1 ? `skjøt ${RECIPES.textileFrame.splice.thread}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }
  if (F) return `${F.upper ? 'Øvre felt' : 'Felt'} ${F.module + 1} · ${mm(F.width)} × ${mm(F.height)} mm${F.run ? ` · del av print over ${v.foils.filter((y) => y.run === F.run).length} plater` : ''}`
  return [
    `${fmt(L, 2)} m`,
    count(plates ?? wallModules(w).length - openings.length, 'plate', 'plater') + (odd ? ` (${odd} i egen farge)` : ''),
    openings.length && count(openings.length, 'åpning', 'åpninger'),
    tex.length && count(tex.length, 'tekstilvegg', 'tekstilvegger'),
    shelves.length && count(shelves.length, 'hylle', 'hyller'),
    held?.feet && count(held.feet, 'fotplate', 'fotplater'),
    held?.wires && count(held.wires, 'vaier', 'vaiere'),
    held?.lift && 'lift',
    ...rooms.map((r) => `${r.b - r.a} m inn mot ${roomName(r.room).toLowerCase()}`),
  ]
    .filter(Boolean)
    .join(' · ')
}

const TAIL = 'dra tekstilvegg eller motiv til veggen, klikk det for å endre'

/** The help line: what a click or drag in the drawing does now. */
/** The hint line while the shelf brush is out (Bjørn 9.11.2026). */
export const BRUSH_HINT =
  'Klikk der hyllen skal stå · dra sideveis for rad, opp og ned for høyde · Shift: klikk gir en hylle til i feltet, dra opp for flere, sideveis for samme fordeling i flere felt · Esc legger bort pensla'

export function wallHint(x: { O?: Opening; door: boolean; surface?: 'header' | 'leaf'; painting: boolean; tool: PaintTool; printing: boolean; T?: TextileWall; F?: Foil; S?: Shelf; felt?: 'decor' | 'extras'; upper?: boolean; extras?: boolean; w: Wall }): string {
  const { O, door, painting, tool, printing, T, F, S, felt, extras, w } = x
  if (O && x.surface) return `Farge og print gjelder ${x.surface === 'leaf' ? 'dørbladet' : 'overstykket'} · ‹ › bytter flate · klikk den igjen for veggen · malerspannet legger ett bilde over begge`
  if (O) return `Klikk en rute i miniplanen for å flytte ${door ? 'døren' : 'forhenget'} · «Farge og profilering» eller Esc gir paletten · Delete gjør om til vegg`
  if (painting && tool === 'bucket')
    return printing
      ? 'Klikk veggen: motivet strekkes over platene på denne siden, ikke inne i bakrom · en farge eller søppelbøtta tar printen av'
      : 'Klikk veggen for å farge alle platene · felt med print står som før · kosten tar printen av ett felt'
  if (painting)
    return printing
      ? 'Klikk eller dra over platene: hele motivet på hver plate · en farge med kosten tar printen av igjen'
      : 'Klikk eller dra over platene for å farge dem · printen på platen går av, dekaler blir · klikk en farget plate igjen for veggens farge'
  if (felt === 'extras') return 'Hylle til i feltet: først på 1300 eller nabohyllens høyde, så over og under · trykk en hylle for å endre den · ← → bytter felt · «Farge og profilering» tilbake · klikk feltet igjen for hele veggen'
  if (extras) return 'Hylle: felt for felt, rad for rad fra midten · Hyllerad: én hylle i alle felt i neste ledige høyde · trykk en hylle for å endre den · «Farge og profilering» tilbake'
  if (felt && x.upper) return 'Fargen gjelder det øvre feltet over mellomskinnen · uten egen farge har det veggens · ← → bytter øvre felt · klikk feltet igjen for hele veggen'
  if (felt) return 'Fargen eller et motiv i Profilering dekker dette feltet · «+ Dekal» legger en dekal på · ← → bytter felt · «Hyller og heng» for tilbehør · klikk feltet igjen for hele veggen'
  if (S) return 'Dra hyllen opp eller ned i steg på 50 mm, eller til et annet felt · en rad flyttes samlet, «Bare denne» tar én hylle ut · Alt + dra kopierer · minst 100 mm lysmål mellom hyller · Delete fjerner'
  if (T) return 'Dra rammen for å flytte · håndtakene endrer størrelsen · klikk et motiv for trykk · Delete fjerner'
  if (F)
    return F.full
      ? 'Dra for å flytte til en annen plate · klikk et motiv for å bytte · Delete fjerner'
      : 'Dra for å flytte innenfor platen · hjørnene endrer størrelsen · klikk et motiv for å bytte · Delete fjerner'
  if (isStandWall(w)) return `Standveggen står fast · ${TAIL}`
  return w.room ? `Dra veggen i planen for å endre rommet · ${TAIL}` : `Dra veggen i planen for å flytte den · ${TAIL}`
}

/**
 * Why the panel cannot do what it shows, or what a choice there means, for the front of the hint line: never a line in
 * the settings column, so the column stands still (Bjørn 17.11.2026, as in the counter drawer). `felt`: the chosen felt
 * and its page; `shelves`: how many shelves are chosen with S.
 */
export function wallWhy(
  v: Variant,
  rules: Rules,
  w: Wall,
  s: FaceSide,
  x: { felt?: { m: number; page: 'decor' | 'extras'; upper?: boolean }; twoFaces: boolean; T?: TextileWall; F?: Foil; S?: Shelf; shelves: number },
): string | null {
  const { felt, T, F, S } = x
  if (felt) {
    if (felt.page === 'extras') return shelfBlocked(v, w.id, felt.m, s)
    const printed = printsOn(v, w.id, s).some((f) => f.module === felt.m && !!f.upper === !!felt.upper)
    return foilBlocked(v, rules, w.id, felt.m, s, true, felt.upper) ?? (x.twoFaces && !printed ? 'Fargen gjelder platen på begge sider' : null)
  }
  if (F?.full) return F.upper ? `Dekker det øvre feltet, ${Math.round(F.width * 1000)} × ${Math.round(F.height * 1000)} mm lysmål` : `Dekker hele platen, ${rules.wall.plate.width} × ${rules.wall.plate.height} mm`
  if (T?.fill === 'reuse') return REUSE_NOTE
  if (S) return hintLine(tooHigh(rules, S.y) && highWarning(rules), x.shelves === 1 && offRow(v, S.id) && 'Avviker fra raden') || null
  return null
}
