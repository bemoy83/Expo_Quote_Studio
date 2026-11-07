// The wall drawer's words: the title, the line under it and the help line across the bottom, for what is chosen.
import { wallLabel, type ProductionPiece } from '../../../calc/production'
import { wallModules } from '../../../domain/grid'
import { roomName, roomSize } from '../../../domain/rooms'
import type { Foil, Opening, TextileWall, Variant, Wall } from '../../../domain/types'
import { isStandWall } from '../../../domain/walls'
import { count, fmt, mm } from '../../format'
import type { RoomRun } from './face'
import type { PaintTool } from './paint'

/** The drawer's title: the frame or decal chosen, else the wall (a room's wall, an inner wall or a stand wall). */
export function wallTitle(v: Variant, w: Wall, T?: TextileWall, F?: Foil): string {
  if (T) return 'Tekstilvegg'
  if (F) return F.full ? 'Print på hel plate' : 'Foliedekal'
  const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
  if (room) return `${roomName(room)} ${roomSize(room)} · vegg`
  const label = wallLabel(w)
  return label === 'Innervegg' ? label : `Standvegg · ${label.toLowerCase()}`
}

/** The line under the title: the frame's size and cloth, the decal's plate and size, or what the wall holds. */
export function wallMeta(
  v: Variant,
  w: Wall,
  x: { L: number; T?: TextileWall; F?: Foil; piece?: ProductionPiece; openings: Opening[]; odd: number; tex: TextileWall[]; rooms: RoomRun[] },
): string {
  const { L, T, F, piece, openings, odd, tex, rooms } = x
  if (T && piece) return `ramme ${mm(piece.W / 1000)} × ${mm(piece.H / 1000)} mm · ${fmt(piece.area)} m² ${piece.fill === 'reuse' ? 'kundens duk' : piece.fill === 'white' ? 'hvit duk' : 'trykk'}`
  if (F) return `Felt ${F.module + 1} · ${mm(F.width)} × ${mm(F.height)} mm${F.run ? ` · del av print over ${v.foils.filter((y) => y.run === F.run).length} plater` : ''}`
  return [
    `${L} m`,
    count(wallModules(w).length - openings.length, 'plate', 'plater') + (odd ? ` (${odd} i egen farge)` : ''),
    openings.length && count(openings.length, 'åpning', 'åpninger'),
    tex.length && count(tex.length, 'tekstilvegg', 'tekstilvegger'),
    ...rooms.map((r) => `${r.b - r.a} m inn mot ${roomName(r.room).toLowerCase()}`),
  ]
    .filter(Boolean)
    .join(' · ')
}

const TAIL = 'dra tekstilvegg eller motiv til veggen, klikk det for å endre'

/** The help line: what a click or drag in the drawing does now. */
export function wallHint(x: { O?: Opening; door: boolean; painting: boolean; tool: PaintTool; printing: boolean; T?: TextileWall; F?: Foil; w: Wall }): string {
  const { O, door, painting, tool, printing, T, F, w } = x
  if (O) return `Klikk en rute i miniplanen for å flytte ${door ? 'døren' : 'forhenget'} · «Farge og grafikk» eller Esc gir paletten · Delete gjør om til vegg`
  if (painting && tool === 'wall')
    return printing
      ? 'Klikk veggen: motivet strekkes over platene på denne siden, ikke inne i bakrom · klikk én gang til: printen fjernes fra hele siden'
      : 'Klikk veggen for å farge alle platene · print på denne siden går bort, dekaler blir'
  if (painting)
    return printing
      ? 'Klikk eller dra over platene: hele motivet på hver plate · klikk en plate som har motivet: printen fjernes fra den platen'
      : 'Klikk eller dra over platene for å farge dem · klikk en farget plate igjen for veggens farge'
  if (T) return 'Dra rammen for å flytte · håndtakene endrer størrelsen · klikk et motiv for trykk · Delete fjerner'
  if (F)
    return F.full
      ? 'Dra for å flytte til en annen plate · klikk et motiv for å bytte · Delete fjerner'
      : 'Dra for å flytte innenfor platen · hjørnene endrer størrelsen · klikk et motiv for å bytte · Delete fjerner'
  if (isStandWall(w)) return `Standveggen står fast · ${TAIL}`
  return w.room ? `Dra veggen i planen for å endre rommet · ${TAIL}` : `Dra veggen i planen for å flytte den · ${TAIL}`
}
