// Focused visual regression for the reload message overlapping landscape settings.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', {recursive:true});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({viewport:{width:844,height:390}, hasTouch:true,isMobile:true});
  const page = await context.newPage(), errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL || 'https://degree-choice.com/?v=combat-6', {waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__combat?.snapshot().started);
  const cdp=await context.newCDPSession(page), receipts=[];
  for(const viewport of [{width:844,height:390},{width:390,height:844}]) {
    await page.setViewportSize(viewport); await page.locator('#reset').tap();
    await page.keyboard.down('Space');
    await page.waitForFunction(()=>window.__combat.snapshot().ammo<30); await page.keyboard.up('Space');
    const b=await page.locator('#reload').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:2,x:b.x+b.width/2,y:b.y+b.height/2}]});
    const f=await page.locator('#feedback').boundingBox(), o=await page.locator('.options').boundingBox();
    assert.equal(await page.locator('#feedback').textContent(),'RELOAD STARTED');
    assert.ok(f.y>=o.y+o.height,'reload feedback must be below settings');
    assert.equal(await page.locator('#fire-label').textContent(),'RELOAD');
    await page.screenshot({path:`artifacts/reload-${viewport.width}.png`});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    receipts.push({viewport,feedback:f,options:o});
  }
  assert.deepEqual(errors,[]); await writeFile('artifacts/reload-layout.json',JSON.stringify({pass:true,receipts,errors},null,2));
  console.log(JSON.stringify({pass:true,receipts}));
} finally {await browser.close();}
