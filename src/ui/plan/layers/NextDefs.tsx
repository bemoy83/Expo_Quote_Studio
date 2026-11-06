// The clip and mask of the next variant's preview (PlanView, nextArea.ts): per plan layer, a clip path around what
// changes, where the next variant is drawn dimmed, and a mask that hides what the sketch has there now.
import { AREA_LAYERS, type Areas, type Box } from '../nextArea'

/** Far enough out to cover any plan with its margins, m. */
const FAR = 1000

const rect = (b: Box, i: number, fill?: string) => <rect key={i} x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} fill={fill} />

export function NextDefs({ id, areas }: { id: string; areas: Areas }) {
  return (
    <defs>
      {AREA_LAYERS.filter((k) => areas[k].clip.length).map((k) => (
        <g key={k}>
          <clipPath id={`${id}-c-${k}`}>{areas[k].clip.map((b, i) => rect(b, i))}</clipPath>
          {areas[k].mask.length > 0 && (
            <mask id={`${id}-m-${k}`} maskUnits="userSpaceOnUse" x={-FAR} y={-FAR} width={2 * FAR} height={2 * FAR}>
              <rect x={-FAR} y={-FAR} width={2 * FAR} height={2 * FAR} fill="white" />
              {areas[k].mask.map((b, i) => rect(b, i, 'black'))}
            </mask>
          )}
        </g>
      ))}
    </defs>
  )
}
