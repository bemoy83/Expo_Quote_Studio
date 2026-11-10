// What a click or drag does now, after the stand chip (under it when the stage is narrow): a short line for the eye, the full help on hover (title).
import type { Brush, RollMode, Tool } from './tools'
import { productOf } from './env'

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

export function hint(tool: Tool, brush: Brush | null, roll: RollMode | false = false): Hint {
  if (tool === 'select')
    return h(
      'Klikk for å velge · Mer i pillen for å endre · dra for å flytte · Delete fjerner',
      'Klikk for å velge, klikk tomt gulv eller Esc for å slippe · Mer i pillen åpner skuffen for en vegg, dør, tekstilvegg eller engangsteppe · dra en innervegg, innvendig takdrager eller møbler for å flytte · Shift + dra en innvendig takdrager flytter den på tvers i 50 mm-steg · dra gulvet i et rom for å flytte rommet, en romvegg for å endre størrelsen · Delete fjerner valgt møbel, hylle, dør, takdrager eller rom',
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
        'Dra langs rutenettet for innvendig takdrager · en ende på en annen takdrager henger på krok, ellers stolpe med fotplate · tegn en tverrdrager mot en stolpe for å spare fotplaten · i Velg flytter Shift + dra den på tvers i 50 mm-steg',
      )
    case 'floor':
      if (roll === 'fill')
        return h(
          'Dra et område, eller klikk for hele standen',
          'Dra et område for engangsteppe, klikk for hele standen · banene legges slik det koster minst · Velg teppet for andre forslag til legging',
        )
      if (roll)
        return h(
          'Klikk for en bane · dra på tvers for flere · R snur',
          'Klikk for en hel bane på ledig gulv, kappet der bare en smalere stripe er ledig · dra på tvers for flere hele baner side om side · R snur rulleretningen · klikk en bane for å bytte farge · Velg banen for å snu eller endre lengden',
        )
      return h('Klikk og dra for å legge gulv', 'Klikk og dra for å tegne gulv · velg penselstørrelse over verktøyene')
    case 'opening':
      return h('Klikk en vegg eller en tom kant', 'Klikk en vegg eller en tom kant for å sette inn åpning med overstykke · klikk en åpning for å bytte fyll')
    case 'textile':
      return h(
        'Dra langs en vegg, eller fritt for frittstående',
        'Dra langs en systemvegg for tekstilvegg på veggen, eller dra fritt for frittstående på fotplater · klikk ved en vegg for å fylle den · én rute av gangen, velg rutestørrelse over verktøyene · start der en frittstående slutter for hjørne',
      )
    case 'motif':
      return h('Klikk en tekstilvegg eller et veggfelt', 'Klikk en tekstilvegg for trykk, eller et veggfelt for foliedekor')
    case 'object':
      return h(`Klikk i planen for å sette ut ${productOf(brush?.kind === 'object' ? brush.product : '')?.name.toLowerCase() ?? 'varen'}`)
    case 'shelf':
      return h(
        'Klikk et veggfelt for hylle · dra langs veggen for flere',
        'Klikk et veggfelt på siden hyllen skal stå, 1500 mm fra gulvet · dra langs veggen for en rad · ikke i dør, under tekstil eller ved hjørne- og T-stolper · velg hyllen for å endre høyden eller legge til flere over hverandre i skuffen',
      )
  }
}
