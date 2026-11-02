// What a click or drag does now, under the stand chip: a short line for the eye, the full help on hover (title).
import type { Brush, RollMode, Tool } from './tools'
import { productOf } from './env'

export interface Hint {
  /** One short line, shown under the stand chip. */
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
      'Klikk for å endre · dra for å flytte · Delete fjerner',
      'Klikk en vegg eller dør for å endre den · klikk engangsteppe for legging, snu og lengde · dra en innervegg, innvendig takdrager eller møbler for å flytte · dra gulvet i et rom for å flytte rommet, en romvegg for å endre størrelsen · Delete fjerner valgt møbel, dør, takdrager eller rom',
    )
  const erase = tool === 'erase'
  switch (brush?.kind ?? 'wall') {
    case 'wall':
      return erase
        ? h('Klikk eller dra for å fjerne vegg', 'Klikk en veggmodul eller dra langs rutenettet for å fjerne vegg · standvegger kan ikke fjernes')
        : h('Klikk en kant eller dra langs rutenettet', 'Klikk en kant eller dra langs rutenettet for å tegne vegg i hele meter')
    case 'beam':
      return erase
        ? h('Klikk en takdrager for å fjerne den', 'Klikk eller dra langs en innvendig takdrager for å fjerne den')
        : h(
            'Dra langs rutenettet for takdrager',
            'Dra langs rutenettet for innvendig takdrager · en ende på en annen takdrager henger på krok, ellers stolpe med fotplate · tegn en tverrdrager mot en stolpe for å spare fotplaten',
          )
    case 'floor':
      if (roll && erase) return h('Klikk en bane for å fjerne den')
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
      return erase
        ? h('Klikk og dra for å fjerne gulv')
        : h('Klikk og dra for å legge gulv', 'Klikk og dra for å tegne gulv · velg penselstørrelse over verktøyene')
    case 'opening':
      return erase
        ? h('Klikk en åpning for å gjøre den til vegg')
        : h('Klikk en vegg eller en tom kant', 'Klikk en vegg eller en tom kant for å sette inn åpning med overstykke · klikk en åpning for å bytte fyll')
    case 'textile':
      return erase
        ? h('Klikk en tekstilvegg for å fjerne den')
        : h(
            'Dra langs en vegg, eller fritt for frittstående',
            'Dra langs en systemvegg for tekstilvegg på veggen, eller dra fritt for frittstående på fotplater · klikk ved en vegg for å fylle den · én rute av gangen, velg rutestørrelse over verktøyene · start der en frittstående slutter for hjørne',
          )
    case 'motif':
      return erase
        ? h('Klikk dekor for å fjerne den', 'Klikk en foliedekor for å fjerne den, eller en tekstilvegg for å ta bort motivet')
        : h('Klikk en tekstilvegg eller et veggfelt', 'Klikk en tekstilvegg for trykk, eller et veggfelt for foliedekor')
    case 'object':
      return erase
        ? h('Klikk et møbel for å fjerne det')
        : h(`Klikk i planen for å sette ut ${productOf(brush?.kind === 'object' ? brush.product : '')?.name.toLowerCase() ?? 'varen'}`)
  }
}
