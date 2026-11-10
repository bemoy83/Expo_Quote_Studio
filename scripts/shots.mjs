// Screenshot diff for refactoring (docs/kodekart.md). Not run in CI: run it by hand on each refactoring PR.
//
//   node scripts/shots.mjs shoot <dist> <out>       screenshots of a built app (npm run build → dist)
//   node scripts/shots.mjs compare <a> <b> [diff]   compare two shoots pixel by pixel, diff images in [diff]
//
// Typical run: build main into dist-main (git worktree), build the branch into dist, shoot both, compare.
// Each example sketch in src/test/fixtures is put in localStorage the way the app saves it, then the script takes the
// plan, the 3D view, the drawers listed below, Tilbud and Arbeidsordre for every variant.
// Transitions are turned off and the 3D view waits for its motifs, so two runs of the same build give the same pictures.
// Needs Chromium for Playwright: `npx playwright install chromium` once (or CHROMIUM=/path/to/chrome).
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const FIXTURES = resolve(import.meta.dirname, '../src/test/fixtures');
const VIEWPORT = { width: 1440, height: 900 };
const NO_MOTION = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
// The 3D view rasterises motifs once and shows them grey until then; give it time after the canvas appears
const SETTLE_3D = 1500;

/** Plan clicks (model metres) whose pill Mer opens a drawer in Velg, per fixture: [name, x, y]. */
const DRAWERS = {
  '01-hjorne-arrangor': [['vegg', 1.5, 0], ['innervegg', 3, 1.5], ['dor', 3, 2.5]],
  '02-hjorne-utstiller': [['romvegg', 4, 1.5]],
  '03-rom': [['l-rom', 2, 2], ['frihandsrom', 6, 1.5]],
  '04-oy-takdrager': [['bane', 1, 1]],
  '07-engangsteppe': [['bane', 1, 1]],
  '08-tekstil': [['inframe', 3, 0.08], ['frittstaende', 4.5, 3]],
  '09-dekor': [['print', 2.5, 0], ['dekal', 0, 2.5]],
  '11-hyller': [['hylle', 4.5, 0.2]],
  '12-hjornehyller': [['vegg', 1.5, 0], ['innervegg', 3, 1.5]],
};
const PAGES = ['Tilbud', 'Arbeidsordre'];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };

function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(dir, path);
    if (!file.startsWith(dir) || !existsSync(file) || path.endsWith('/')) file = join(dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function shoot(dist, out) {
  dist = resolve(dist);
  mkdirSync(out, { recursive: true });
  const server = await serve(dist);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  let n = 0;
  try {
    for (const file of readdirSync(FIXTURES).filter((f) => f.endsWith('.json')).sort()) {
      const name = file.replace(/\.json$/, '');
      const text = readFileSync(join(FIXTURES, file), 'utf8');
      const variants = JSON.parse(text).varianter.map((v) => v.name);
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      await page.addInitScript((sketch) => {
        // Only on the first load of this page: later reloads keep what the app saved
        if (!sessionStorage.getItem('shots')) {
          localStorage.clear();
          localStorage.setItem('expo-quote-studio.sketch', sketch);
          sessionStorage.setItem('shots', '1');
        }
      }, text);
      await page.goto(url);
      await page.addStyleTag({ content: NO_MOTION });
      const snap = async (label, fullPage = false) => {
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: join(out, `${name}--${label}.png`), fullPage });
        n++;
      };
      const nav = (label) => page.locator('button.navb', { hasText: label }).click();
      for (const [i, vName] of variants.entries()) {
        await nav('Standskisse');
        if (variants.length > 1) await page.getByRole('tab', { name: `Variant ${vName}` }).click();
        await page.getByRole('radio', { name: 'Plan' }).click();
        await page.locator('svg.plan-svg').first().waitFor();
        await page.waitForTimeout(300);
        await snap(`${vName}-plan`);
        for (const [drawer, x, y] of DRAWERS[name] ?? []) {
          if (i > 0) break;
          const at = await page.locator('svg.plan-svg').first().evaluate((svg, [x, y]) => {
            const p = svg.createSVGPoint();
            p.x = x;
            p.y = y;
            const s = p.matrixTransform(svg.getScreenCTM());
            return { x: s.x, y: s.y };
          }, [x, y]);
          await page.mouse.click(at.x, at.y);
          await page.waitForTimeout(150);
          await page.locator('.sel-pill [aria-label="Detaljer"]').click();
          await page.waitForTimeout(400);
          await snap(`${vName}-skuff-${drawer}`);
          await page.locator('.wd-head').getByRole('button', { name: 'Lukk' }).first().click();
          await page.waitForTimeout(200);
        }
        await page.getByRole('radio', { name: '3D' }).click();
        await page.locator('canvas').first().waitFor();
        await page.waitForTimeout(SETTLE_3D);
        await snap(`${vName}-3d`);
        for (const p of PAGES) {
          await nav(p);
          await page.waitForTimeout(300);
          await snap(`${vName}-${p.toLowerCase()}`, true);
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`${n} bilder i ${out}`);
}

function compare(a, b, diffDir) {
  const names = [...new Set([...readdirSync(a), ...readdirSync(b)])].filter((f) => f.endsWith('.png')).sort();
  let bad = 0;
  for (const f of names) {
    if (!existsSync(join(a, f)) || !existsSync(join(b, f))) {
      console.log(`MANGLER  ${f}`);
      bad++;
      continue;
    }
    const A = PNG.sync.read(readFileSync(join(a, f)));
    const B = PNG.sync.read(readFileSync(join(b, f)));
    if (A.width !== B.width || A.height !== B.height) {
      console.log(`STØRRELSE ${f}: ${A.width}×${A.height} mot ${B.width}×${B.height}`);
      bad++;
      continue;
    }
    const diff = new PNG({ width: A.width, height: A.height });
    const px = pixelmatch(A.data, B.data, diff.data, A.width, A.height, { threshold: 0 });
    if (px) {
      console.log(`AVVIK    ${f}: ${px} piksler`);
      bad++;
      if (diffDir) {
        mkdirSync(diffDir, { recursive: true });
        writeFileSync(join(diffDir, f), PNG.sync.write(diff));
      }
    }
  }
  console.log(bad ? `${bad} av ${names.length} bilder avviker` : `Alle ${names.length} bilder er like`);
  process.exitCode = bad ? 1 : 0;
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'shoot' && args.length === 2) await shoot(...args);
else if (cmd === 'compare' && args.length >= 2) compare(...args);
else {
  console.log('Bruk: node scripts/shots.mjs shoot <dist> <out> | compare <a> <b> [diff]');
  process.exitCode = 2;
}
