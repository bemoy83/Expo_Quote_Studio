// What a click or drag does now, after the stand chip (under it when the stage is narrow): a short line for the eye, the full help on hover (title).
import type { Brush, Tool } from './tools'
import { stockByArtnr } from '../domain/podiumStock'
import { artnrName, productOf } from './env'

export interface Hint {
  /** One short line, shown after the stand chip. */
  text: string
  /** The whole help, on hover. */
  more: string
}

const h = (text: string, more = text): Hint => ({ text, more })

export const HINT_3D = h(
  'Dra for å rotere · rull for å zoome',
  'Dra for å rotere · rull for å zoome · klikk en dør for å endre den · dra møbler, en innervegg eller grafikk for å flytte · dra et rom i veggen eller taket, toppkanten av en romvegg endrer størrelsen · dra grafikk eller tekstilvegg fra Profilering til en vegg',
)

/** `carpet`: the floor pen lays engangsteppe (the carpet brush). */
export function hint(tool: Tool, brush: Brush | null, carpet = false): Hint {
  if (tool === 'select')
    return h(
      'Klikk for å velge · Detaljer i pillen for å endre · dra for å flytte · Delete fjerner',
      'Klikk for å velge, klikk tomt gulv eller Esc for å slippe · Detaljer i pillen åpner skuffen for en vegg, dør, tekstilvegg eller engangsteppe · dra en innervegg, innvendig takdrager eller møbler for å flytte · Shift + dra en innvendig takdrager (eller Fin i pillen) flytter den på tvers i 50 mm-steg · dra gulvet i et rom for å flytte rommet, en romvegg for å endre størrelsen · Delete fjerner valgt møbel, hylle, dør, takdrager eller rom',
    )
  if (tool === 'erase')
    return h(
      'Klikk det du vil fjerne · dra for flere',
      'Klikk det som ligger øverst under pekeren for å fjerne det: grafikk før veggen den sitter på, dør før veggen, møbel før gulvet · klikk i et rom fjerner hele rommet · dra langs en vegg eller takdrager for å fjerne et strekk, ellers fjerner et drag mer av samme slag · standvegger kan ikke fjernes',
    )
  switch (brush?.kind ?? 'wall') {
    case 'wall':
      return h(
        'Klikk en vegg for å farge den · dra for flere plater · klikk en tom kant for ny vegg',
        'Klikk en vegg for å farge platen · dra langs veggen for flere plater · klikk en tom kant eller dra langs rutenettet for å tegne vegg i hele meter · Esc avbryter',
      )
    case 'beam':
      return h(
        'Dra langs rutenettet for takdrager',
        'Dra langs rutenettet for innvendig takdrager · en ende på en annen takdrager henger på krok, ellers stolpe med fotplate · tegn en tverrdrager mot en stolpe for å spare fotplaten · i Velg flytter Shift + dra (eller Fin i pillen) den på tvers i 50 mm-steg',
      )
    case 'floor':
      if (carpet)
        return h(
          'Dra et område · klikk ledig gulv for å fylle det · klikk en bane for å bytte farge',
          'Dra et område for engangsteppe, banene legges slik det koster minst · klikk ledig gulv for å fylle alt ledig gulv, klikk en bane for å gi den denne fargen · spannet fyller hele standen · Velg teppet for andre forslag til legging, eller en bane for å snu eller endre lengden',
        )
      return h('Klikk og dra for å legge gulv', 'Klikk og dra for å tegne gulv · velg penselstørrelse over verktøyene')
    case 'opening':
      return h('Klikk en vegg eller en tom kant', 'Klikk en vegg eller en tom kant for å sette inn åpning med overstykke · klikk en åpning for å bytte fyll')
    case 'textile':
      return h(
        'Dra langs en vegg, eller fritt for frittstående',
        'Dra langs en systemvegg for tekstilvegg på veggen, eller dra fritt for frittstående på fotplater · klikk ved en vegg for å fylle den · én rute av gangen, velg rutestørrelse over verktøyene · start der en frittstående slutter for hjørne · motivet i pillen trykkes på tekstilen, og et klikk på en tekstilvegg gir den motivet',
      )
    case 'motif':
      return brush?.kind === 'motif' && brush.pen === 'print'
        ? h('Klikk et veggfelt for print', 'Klikk et veggfelt for å printe hele feltet med motivet · samme motiv igjen gjør ingenting · tekstilvegger trykkes med Tekstil')
        : h('Klikk et veggfelt for dekal', 'Klikk et veggfelt for en dekal med motivet · velg dekalen for å flytte eller endre størrelse · tekstilvegger trykkes med Tekstil')
    case 'podium':
      // K22: a click places the item behind the function in hand, named, never by art.nr (Bjørn 14.11.2026)
      if (brush?.kind === 'podium' && brush.stock) {
        const s = stockByArtnr(brush.stock)
        const name = artnrName(s?.artnr ?? brush.stock)
        const disk = s?.func === 'disker'
        // A drag draws the function's product built on site, named from the product list (K13)
        const built = artnrName(brush.product).toLowerCase()
        return h(
          disk ? `Klikk setter ${name} med fronten mot gangen · dra for å tegne ${built}` : `Klikk setter ${name} · høyden velger varen · dra for å tegne ${built}`,
          `${disk ? `Klikk setter ${name} med fronten mot gangen` : `Klikk setter ${name}, høyden i pillen velger varen`} · trykk og dra for å tegne ${built} i fri fasong · «…» har de andre i katalogen · velg Fri over verktøyene for å tegne fasongen selv · fyll gir alle diskene og podiene fargen · velg en disk for å bytte farge eller rotere den`,
        )
      }
      return h(
        'Klikk for en seksjon, dra for å tegne disk eller podie',
        'Klikk for en seksjon på 500 × 500 (eller velg Disk eller Podie over verktøyene), eller trykk og dra for å gjøre den større i 500-steg i hver retning · seksjonen du trykket i står fast · Shift (eller Fin) gir 250-steg: hold Shift for å låse forhåndsvisningen, og dra i en kant for å flytte den · alle sider er tette · fyll gir alle diskene og podiene fargen · velg en disk for å bytte farge eller rotere den',
      )
    case 'object':
      return h(`Klikk i planen for å sette ut ${productOf(brush?.kind === 'object' ? brush.product : '')?.name.toLowerCase() ?? 'varen'}`)
    case 'shelf':
      return h(
        'Klikk et veggfelt for hylle · dra langs veggen for flere',
        'Klikk et veggfelt på siden hyllen skal stå, 1500 mm fra gulvet · dra langs veggen for en rad · ikke i dør, under tekstil eller ved hjørne- og T-stolper · velg hyllen for å endre høyden eller legge til flere over hverandre i skuffen',
      )
  }
}
