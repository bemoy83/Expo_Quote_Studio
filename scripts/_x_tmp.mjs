import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright'
const [fixture, out, ...steps] = process.argv.slice(2)
const dist='/tmp/claude-0/dist-c'
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}
const server=createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://x').pathname);let f=join(dist,p);if(!existsSync(f)||p.endsWith('/'))f=join(dist,'index.html');res.writeHead(200,{'content-type':T[extname(f)]??'application/octet-stream'});res.end(readFileSync(f))})
await new Promise(ok=>server.listen(0,'127.0.0.1',ok))
const b=await chromium.launch(); const page=await b.newPage({viewport:{width:1200,height:800},deviceScaleFactor:2})
const text=readFileSync(`src/test/fixtures/${fixture}.json`,'utf8')
await page.addInitScript(s=>{if(!sessionStorage.getItem('r')){localStorage.clear();localStorage.setItem('expo-quote-studio.sketch',s);sessionStorage.setItem('r','1')}},text)
await page.goto(`http://127.0.0.1:${server.address().port}/`)
await page.getByRole('radio',{name:'Plan'}).click(); await page.locator('svg.plan-svg').first().waitFor(); await page.waitForTimeout(1200)
const at=(x,y)=>page.locator('svg.plan-svg').first().evaluate((svg,[x,y])=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const s=p.matrixTransform(svg.getScreenCTM());return{x:s.x,y:s.y}},[x,y])
let clip
for (const st of steps) {
  const [k, ...r] = st.split(':'); const n = r.join(':').split(',').map(Number)
  if (k==='tool') await page.locator(`.dock-tools [aria-label="${r.join(':')}"]`).click()
  if (k==='click') { const a=await at(n[0],n[1]); await page.mouse.click(a.x,a.y) }
  if (k==='hover') { const a=await at(n[0],n[1]); await page.mouse.move(a.x,a.y) }
  if (k==='drag') { const a=await at(n[0],n[1]), c=await at(n[2],n[3]); await page.mouse.move(a.x,a.y); await page.mouse.down(); for(let i=1;i<=10;i++) await page.mouse.move(a.x+(c.x-a.x)*i/10,a.y+(c.y-a.y)*i/10); await page.mouse.up() }
  if (k==='clip') { const a=await at(n[0],n[1]), c=await at(n[2],n[3]); clip={x:a.x,y:a.y,width:c.x-a.x,height:c.y-a.y} }
  if (k==='grips') console.log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('svg.plan-svg circle')].map(c=>[c.getAttribute('cx'),c.getAttribute('cy'),c.getAttribute('r')]).filter(c=>+c[2]>0.05&&+c[2]<0.3).slice(-30))))
  await page.waitForTimeout(400)
}
await page.screenshot({path:out,clip})
await b.close(); server.close()
