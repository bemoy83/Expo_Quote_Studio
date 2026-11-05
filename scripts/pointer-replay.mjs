// Pointer proof for refactoring the plan (docs/kodekart.md). Not run in CI: run it by hand on a PR that touches the
// plan's pointer handling (plan/pointer/).
//
//   node scripts/pointer-replay.mjs run <dist> <out.json>   play the presses and drags on a built app
//   node scripts/pointer-replay.mjs compare <a.json> <b.json>
//
// Each scenario loads an example sketch from src/test/fixtures, picks tools in the dock and quick picks, and clicks
// and drags in the plan in model coordinates: walls, doors, inner beams, rooms, furniture, tiles, engangsteppe (Fyll
// and Bane), the textile brush, motifs, and drag and drop from Profilering. After each step it records a hash of the
// sketch stored in localStorage, the open drawer, the cursor and the toast. Compare checks sketch, drawer and cursor;
// the toast only depends on timing (it times out), so a toast difference is listed but does not fail.
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
  console.log('Bruk: node scripts/pointer-replay.mjs run <dist> <out.json> | compare <a.json> <b.json>')
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
  await page.getByRole('radio', { name: 'Plan' }).click()
  await page.locator('svg.plan-svg').first().waitFor()
  await page.waitForTimeout(1200)
  prev = await page.evaluate(() => localStorage.getItem('expo-quote-studio.sketch'))
}
const at = (x, y) => page.locator('svg.plan-svg').first().evaluate((svg, [x, y]) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; const s = p.matrixTransform(svg.getScreenCTM()); return { x: s.x, y: s.y } }, [x, y])
async function press(x, y) { const a = await at(x, y); await page.mouse.click(a.x, a.y); await page.waitForTimeout(250) }
async function drag(x0, y0, x1, y1, steps = 10) {
  const a = await at(x0, y0), b = await at(x1, y1)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  for (let k = 1; k <= steps; k++) await page.mouse.move(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps)
  await page.mouse.up(); await page.waitForTimeout(250)
}
const tool = async (n) => { await page.locator(`.dock-tools [aria-label="${n}"]`).click(); await page.waitForTimeout(150) }
async function record(step) {
  await page.waitForTimeout(500)
  const s = await page.evaluate(() => localStorage.getItem('expo-quote-studio.sketch'))
  const drawer = await page.evaluate(() => [...document.querySelectorAll('section.wall-drawer')].map((e) => e.getAttribute('aria-label') + ':' + (e.querySelector('.wd-head')?.textContent ?? '')).join('|'))
  const toast = await page.evaluate(() => document.querySelector('.toast')?.textContent ?? '')
  const cursor = await page.evaluate(() => document.querySelector('svg.plan-svg').style.cursor)
  out.push({ step: `${name} ${step}`, sketch: hash(s), changed: s !== prev, drawer, toast, cursor })
  prev = s
}
const close = () => page.close()

// Walls: draw, drag, click, erase (also the locked stand wall), door
await open('01-hjorne-arrangor')
await tool('Vegg'); await page.locator('.q-sw').first().click()
await drag(2, 1, 2, 3); await record('tegn vegg')
await drag(4, 1, 4, 3); await record('tegn vegg 2')
await tool('Velg'); await drag(2, 2, 3.2, 2); await record('dra vegg')
await press(3, 1.5); await record('klikk vegg')
await press(5, 3.5); await record('klikk tomt gulv')
await tool('Tøm'); await drag(4, 1, 4, 3); await record('visk vegg')
await drag(0, 1, 0, 3); await record('visk standvegg')
await tool('Vegg'); await page.locator('.q-btn[aria-label="Dør"]').click()
await press(3, 4); await record('dør på åpen side')
await press(0, 1.5); await record('dør i standvegg')
await tool('Velg'); await press(3, 4); await record('klikk dør')
await drag(3, 4, 4.2, 4); await record('dra dør')
await close()

// Inner beams: draw, drag, click, erase
await open('04-oy-takdrager')
await tool('Velg'); await drag(4, 3, 4, 4.1); await record('dra takdrager øy')
await tool('Vegg'); await page.locator('.q-btn[aria-label="Takdrager"]').click()
await drag(1, 1, 7, 1); await record('tegn takdrager')
await tool('Velg'); await press(3, 1); await record('klikk takdrager')
await drag(3, 1, 3, 2.1); await record('dra takdrager')
await tool('Tøm'); await drag(1, 2, 7, 2); await record('visk takdrager')
await close()

// Rooms: move by the floor, resize a side, click a side
await open('03-rom')
await tool('Velg'); await press(7, 1); await record('klikk rom')
await drag(7, 1, 6, 2.2); await record('flytt rom')
await press(1, 2); await record('klikk L-rom')
await drag(2, 2, 2.9, 2); await record('dra romside')
await drag(3, 0.5, 4.1, 0.5); await record('dra romside 2')
await close()
await open('02-hjorne-utstiller')
await tool('Velg'); await drag(4, 1, 3, 1); await record('dra romvegg')
await press(5, 2); await record('klikk romvegg')
await close()

// Furniture: drag, place, erase
await open('10-mobler-utstyr')
await tool('Velg'); await drag(1, 1, 2, 1.6); await record('dra møbel')
await press(2.5, 1.5); await record('klikk møbel')
await tool('Møbel'); await page.locator('.q-obj').first().click(); await press(3, 0.6); await record('sett møbel')
await press(0.2, 0.2); await record('sett møbel trangt')
await close()

// Floor: tiles, then engangsteppe with Fyll and Bane
await open('01-hjorne-arrangor')
await tool('Gulv'); await page.locator('[aria-label="Gulvtype"] [role=tab]').nth(0).click(); await page.locator('.q-sw').nth(1).click()
await drag(0.5, 0.5, 3.5, 2.5); await record('fliser')
await tool('Tøm'); await drag(1, 1, 2, 1); await record('visk fliser')
await tool('Gulv'); await page.locator('[aria-label="Gulvtype"] [role=tab]').nth(1).click(); await page.locator('.q-sw').nth(0).click()
await page.locator('[aria-label="Legging"] [role=tab]').nth(0).click()
await drag(0.5, 0.5, 4.5, 2.5); await record('fyll område')
await press(5, 3.5); await record('fyll stand')
await page.locator('[aria-label="Legging"] [role=tab]').nth(1).click()
await press(1, 3.5); await record('bane klikk')
await drag(0.5, 1, 0.5, 3); await record('bane dra')
await tool('Velg'); await press(1, 1); await record('velg bane')
await close()
await open('07-engangsteppe')
await tool('Velg'); await press(1, 1); await record('velg fyll')
await close()

// Textile: fill a wall face, free stroke, move a free one, erase; motif click and drag from Profilering
await open('08-tekstil')
await tool('Profilering'); await page.locator('.q-btn', { hasText: 'Tekstil' }).first().click()
await press(1.5, 0.15); await record('tekstil på vegg')
await drag(1, 2, 1, 4); await record('tekstil fritt')
await press(4, 4); await record('tekstil klikk tomt')
await tool('Velg'); await drag(4, 3, 4.5, 3.5); await record('flytt frittstående')
await press(1, 3); await record('klikk frittstående')
await tool('Tøm'); await press(1, 3); await record('visk frittstående')
await close()
await open('09-dekor')
await tool('Profilering'); await page.locator('.q-motif').first().click()
await press(1.5, 0.1); await record('motiv på vegg')
await press(3, 2); await record('motiv tomt')
async function dropOn(src, x, y) {
  const svg = page.locator('svg.plan-svg').first()
  const q = await at(x, y)
  const pos = await svg.evaluate((el, p) => { const r = el.getBoundingClientRect(); return { x: p.x - r.left, y: p.y - r.top } }, q)
  await src.dragTo(svg, { targetPosition: pos }); await page.waitForTimeout(300)
}
await page.locator('nav [aria-label="Profilering"], button', { hasText: 'Profilering' }).first().click(); await page.waitForTimeout(300)
await dropOn(page.locator('.gfx-grid .gfx').nth(1), 3.5, 0.15); await record('dra motiv inn')
await dropOn(page.locator('.gfx-grid .gfx').nth(2), 4, 2); await record('dra motiv tomt')
await dropOn(page.locator('.pd-row', { hasText: 'Tekstilvegg' }).first(), 0.15, 1.5); await record('dra tekstil inn')
await tool('Tøm'); await press(1.5, 0.1); await record('visk motiv')
await close()

// Keyboard (useShortcuts): Delete on each kind of selection, Escape from a door, R on a lane, undo and redo, dock keys and P
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150) }
await open('10-mobler-utstyr')
await tool('Velg'); await press(2.5, 1.5); await key('Delete'); await record('tast slett møbel')
await key('Control+z'); await record('tast angre')
await key('Control+Shift+z'); await record('tast gjør om')
await key('m'); await press(3, 0.6); await record('tast M og sett møbel')
await key('Escape'); await press(1, 1); await record('tast Escape og klikk møbel')
await key('s'); await key('v'); await key('p'); await press(2, 2.6); await record('tast S V P og sett')
await key('e'); await press(1, 1); await record('tast E og visk')
await close()
await open('01-hjorne-arrangor')
await tool('Vegg'); await page.locator('.q-btn[aria-label="Dør"]').click(); await press(3, 4)
await tool('Velg'); await press(3, 4); await record('tast klikk dør')
await key('Escape'); await record('tast Escape fra dør')
await press(3, 4); await key('Backspace'); await record('tast slett dør')
await close()
await open('07-engangsteppe')
await tool('Velg'); await press(1, 1); await key('Delete'); await record('tast slett fyll')
await close()
await open('01-hjorne-arrangor')
await tool('Gulv'); await page.locator('[aria-label="Gulvtype"] [role=tab]').nth(1).click(); await page.locator('.q-sw').nth(0).click()
await page.locator('[aria-label="Legging"] [role=tab]').nth(1).click()
await press(1, 3.5); await key('r'); await press(5, 1); await record('tast R snur pensel')
await tool('Velg'); await press(1, 3.5); await key('r'); await record('tast R snur bane')
await key('Escape'); await record('tast Escape fra bane')
await press(1, 3.5); await key('Delete'); await record('tast slett bane')
await close()
await open('08-tekstil')
await tool('Velg'); await press(4.5, 3); await key('Delete'); await record('tast slett frittstående')
await press(3, 0.08); await key('Delete'); await record('tast slett tekstil på vegg')
await close()
await open('09-dekor')
await tool('Velg'); await press(0, 2.5); await key('Delete'); await record('tast slett dekal')
await close()
await open('03-rom')
await tool('Velg'); await press(7, 1); await key('Delete'); await record('tast slett rom')
await close()
await open('04-oy-takdrager')
await tool('Velg'); await press(2, 3); await key('Delete'); await record('tast slett takdrager')
await close()

writeFileSync(args[1], JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} steg skrevet til ${args[1]}`)
await browser.close(); server.close()
