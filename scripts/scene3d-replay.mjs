// Pointer proof for refactoring the 3D view (docs/kodekart.md). Not run in CI: run it by hand on a PR that touches the
// 3D pointer handling (scene3d/pointer/, Scene3D.tsx, drop.ts).
//
//   node scripts/scene3d-replay.mjs run <dist> <out.json>   hover, drag and click across the 3D picture of a built app
//   node scripts/scene3d-replay.mjs compare <a.json> <b.json>
//
// Each example sketch is opened in 3D, and a grid of points across the picture is hovered, dragged from and clicked;
// then motifs are dropped from Profilering. After each step it records a hash of the stored sketch, the open drawer,
// the cursor and the toast, as scripts/pointer-replay.mjs does for the plan.
import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'compare') {
  const [a, b] = args.map((f) => JSON.parse(readFileSync(f, 'utf8')))
  let bad = 0
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? {}, y = b[i] ?? {}
    const off = ['step', 'sketch', 'changed', 'drawer', 'cursor'].filter((k) => x[k] !== y[k])
    if (off.length) { bad++; console.log(`AVVIK ${x.step ?? y.step}: ${off.map((k) => `${k} ${x[k]} ≠ ${y[k]}`).join(', ')}`) }
    else if (x.toast !== y.toast) console.log(`(toast ulik i tid) ${x.step}`)
  }
  console.log(bad ? `${bad} av ${a.length} steg avviker` : `Alle ${a.length} steg er like`)
  process.exit(bad ? 1 : 0)
}
if (cmd !== 'run' || args.length < 2) {
  console.log('Bruk: node scripts/scene3d-replay.mjs run <dist> <out.json> | compare <a.json> <b.json>')
  process.exit(1)
}
const dist = resolve(args[0])
const repo = resolve(new URL('..', import.meta.url).pathname)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = join(dist, path)
  if (!existsSync(file) || path.endsWith('/')) file = join(dist, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const url = `http://127.0.0.1:${server.address().port}/`
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const hash = (s) => createHash('sha1').update(s ?? '').digest('hex').slice(0, 10)
const out = []
let page, name, prev
async function open(fixture) {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  name = fixture
  const text = readFileSync(join(repo, 'src/test/fixtures', fixture + '.json'), 'utf8')
  await page.addInitScript((s) => { if (!sessionStorage.getItem('r')) { localStorage.clear(); localStorage.setItem('expo-quote-studio.sketch', s); sessionStorage.setItem('r', '1') } }, text)
  await page.goto(url)
  await page.getByRole('radio', { name: '3D' }).click()
  await page.locator('.scene3d-canvas canvas').first().waitFor()
  // Motifs are rasterised once and shown grey until then
  await page.waitForTimeout(1500)
  prev = await page.evaluate(() => localStorage.getItem('expo-quote-studio.sketch'))
}
const canvas = () => page.locator('.scene3d .scene3d-canvas canvas').first()
/** A point on the 3D picture, as fractions of its box (the box shrinks when a drawer opens). */
async function at(fx, fy) { const b = await canvas().boundingBox(); return { x: b.x + b.width * fx, y: b.y + b.height * fy } }
async function record(step) {
  await page.waitForTimeout(300)
  const s = await page.evaluate(() => localStorage.getItem('expo-quote-studio.sketch'))
  const drawer = await page.evaluate(() => [...document.querySelectorAll('section.wall-drawer')].map((e) => e.getAttribute('aria-label') + ':' + (e.querySelector('.wd-head')?.textContent ?? '')).join('|'))
  const toast = await page.evaluate(() => document.querySelector('.toast')?.textContent ?? '')
  const cursor = await canvas().evaluate((c) => c.style.cursor)
  out.push({ step: `${name} ${step}`, sketch: hash(s), changed: s !== prev, drawer, toast, cursor })
  prev = s
}
const close = () => page.close()
const GRID = [0.2, 0.35, 0.5, 0.65, 0.8].flatMap((fx) => [0.3, 0.45, 0.6, 0.75].map((fy) => [fx, fy]))

for (const f of ['01-hjorne-arrangor', '03-rom', '08-tekstil', '09-dekor', '10-mobler-utstyr']) {
  await open(f)
  // Hover: the cursor says what a press would do, and the top of a room side lights up
  for (const [fx, fy] of GRID) { const a = await at(fx, fy); await page.mouse.move(a.x, a.y); await record(`pek ${fx},${fy}`) }
  // Drags: furniture, walls, rooms, decor or orbit, whatever lies there
  for (const [fx, fy] of GRID) {
    const a = await at(fx, fy)
    await page.mouse.move(a.x, a.y); await page.mouse.down()
    for (let k = 1; k <= 8; k++) await page.mouse.move(a.x + 5 * k, a.y + 3 * k)
    await page.mouse.up(); await record(`dra ${fx},${fy}`)
  }
  // Clicks: select what lies there (opens its drawer)
  for (const [fx, fy] of GRID) { const a = await at(fx, fy); await page.mouse.click(a.x, a.y); await record(`klikk ${fx},${fy}`) }
  await close()
}

// Drag and drop from Profilering onto the 3D walls
await open('09-dekor')
await page.locator('button', { hasText: 'Profilering' }).first().click(); await page.waitForTimeout(300)
for (const [i, fx, fy] of [[1, 0.35, 0.4], [2, 0.6, 0.35], [3, 0.5, 0.8]]) {
  const b = await canvas().boundingBox()
  await page.locator('.gfx-grid .gfx').nth(i).dragTo(canvas(), { targetPosition: { x: b.width * fx, y: b.height * fy } })
  await record(`slipp motiv ${fx},${fy}`)
}
await close()

writeFileSync(args[1], JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} steg skrevet til ${args[1]}`)
await browser.close(); server.close()
