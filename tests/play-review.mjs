// Recorded, exploratory playthrough. Real browser touch events only; no game-state writes.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const closeOnly = process.env.REVIEW_ONLY === 'close';
const out = closeOnly ? 'artifacts/play-review-close' : 'artifacts/play-review';
await mkdir(out + '/video', { recursive: true });
const url = process.env.TEST_URL || 'https://degree-choice.com/?v=combat-5';
const releaseMeta = await (await fetch(new URL('/release.json', url))).json();
const integrity = [];
for (const [name, expected] of Object.entries(releaseMeta.files_sha256)) {
  const response = await fetch(new URL('/' + name + '?review=1', url));
  const sha = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  assert.equal(response.status, 200); assert.equal(sha, expected, name + ' release integrity');
  integrity.push({ name, sha });
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, recordVideo: { dir: out + '/video', size: { width: 844, height: 390 } } });
const page = await context.newPage(), errors = [], observations = [], samples = [], inputLog = [], phases = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
const video = page.video(); const wallStart = performance.now();
let cdp, fingers = new Map(), phase = 'Boot', checkpointIndex = 0;
const snapshot = () => page.evaluate(() => window.__combat.snapshot());
const sample = async label => { const value = { label, phase, wallSeconds: (performance.now() - wallStart) / 1000, ...await snapshot() }; samples.push(value); return value; };
const advance = async seconds => { const until = (await snapshot()).simTime + seconds; await page.waitForFunction(t => window.__combat.snapshot().simTime >= t, until, { timeout: 20000, polling: 'raf' }); return sample('advance'); };
const heading = s => Math.atan2(s.aimX, s.aimZ);
const angleBetween = (a, b) => Math.abs(Math.atan2(Math.sin(heading(b) - heading(a)), Math.cos(heading(b) - heading(a)))) * 180 / Math.PI;
function pixelsFor(s, x, z) { const units = 16 / 390, yaw = s.cameraYaw; return { x: (x * Math.cos(yaw) - z * Math.sin(yaw)) / units, y: (x * Math.sin(yaw) + z * Math.cos(yaw)) * s.verticalScale / units }; }
function projectedReticle(s) { const p = pixelsFor(s, s.aimOffset.x, s.aimOffset.z); return { x: s.playerScreenX + p.x, y: s.playerScreenY + p.y - 0.25 * Math.sqrt(1 - s.verticalScale ** 2) / (16 / 390) }; }
async function send(type, points) {
  inputLog.push({ phase, type, points, wallSeconds: (performance.now() - wallStart) / 1000 });
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 6, radiusY: 6, force: 1 })) });
}
async function down(id, x, y) { fingers.set(id, { x, y }); await send('touchStart', [...fingers].map(([i,p]) => [i,p.x,p.y])); }
async function move(id, x, y) { fingers.set(id, { x, y }); await send('touchMove', [...fingers].map(([i,p]) => [i,p.x,p.y])); }
async function lift(id) { const p = fingers.get(id); await send('touchEnd', [[id,p.x,p.y]]); fingers.delete(id); }
async function release() { if (fingers.size) await send('touchEnd', []); fingers.clear(); }
async function swipe(dx, dy, start = { x: 615, y: 180 }, steps = 8) {
  await down(2, start.x, start.y);
  for (let i=1; i<=steps; i++) { await move(2, start.x + dx*i/steps, start.y + dy*i/steps); await advance(0.035); }
  await lift(2); await advance(0.06);
}
async function aimOffsetTo(x, z) { const s = await snapshot(), p = pixelsFor(s, x - s.aimOffset.x, z - s.aimOffset.z); await swipe(p.x, p.y); }
async function aimTarget(index) { const s=await snapshot(), t=s.targets[index]; await aimOffsetTo(t.x-s.x, t.z-s.z); }
async function setPhase(text) { phase = text; phases.push({ text, wallSeconds: (performance.now()-wallStart)/1000 }); await page.locator('#review-phase').evaluate((el, value) => { el.textContent = value; }, text); }
async function checkpoint(name) { const file = `${out}/${String(++checkpointIndex).padStart(2,'0')}-${name}.png`; await page.screenshot({ path: file }); const s=await sample(name); return { file, ...s }; }
async function reset() { await release(); await page.locator('#reset').tap(); await advance(0.1); }
let moveCenter, fireCenter;
async function moveToward(x, z) {
  await down(1, moveCenter.x, moveCenter.y);
  const until = (await snapshot()).simTime + 14;
  for (let i=0; i<110; i++) {
    const s=await snapshot(), dx=x-s.x, dz=z-s.z, distance=Math.hypot(dx,dz);
    if (distance<0.03 || s.simTime>until) break;
    const p=pixelsFor(s,dx,dz), magnitude=Math.hypot(p.x,p.y), strength=Math.min(0.45,distance/4);
    const radius=118*0.37*(0.13+0.87*strength);
    await move(1, moveCenter.x+p.x/magnitude*radius, moveCenter.y+p.y/magnitude*radius);
    await advance(0.075);
  }
  await lift(1); await advance(0.08); return sample('arrived');
}
try {
  await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__combat?.snapshot().started);
  cdp=await context.newCDPSession(page);
  // Capture-only overlays show phase and actual pointer locations, never feed the game.
  await page.evaluate(() => {
    const title=document.createElement('div'); title.id='review-phase'; title.style.cssText='position:fixed;left:20px;top:104px;padding:5px 9px;background:#0c141de8;color:#def4ff;border:1px solid #7ac5f5;border-radius:6px;font:11px system-ui;z-index:99;pointer-events:none'; document.body.append(title);
    const dots=new Map(), active=new Set(); window.reviewTouchStats={ max:0, events:[] };
    for (const type of ['pointerdown','pointermove','pointerup','pointercancel']) document.addEventListener(type, e => {
      if (e.pointerType!=='touch') return;
      window.reviewTouchStats.events.push({type,id:e.pointerId,target:e.target.id,x:e.clientX,y:e.clientY});
      if (type==='pointerdown') { active.add(e.pointerId); window.reviewTouchStats.max=Math.max(window.reviewTouchStats.max,active.size); const dot=document.createElement('div'); dot.style.cssText=`position:fixed;width:36px;height:36px;border-radius:50%;border:2px solid ${e.target.id==='move'?'#59dfff':'#ffba5b'};background:#ffffff18;pointer-events:none;z-index:98`; document.body.append(dot); dots.set(e.pointerId,dot); }
      const dot=dots.get(e.pointerId); if (dot) { dot.style.left=(e.clientX-18)+'px'; dot.style.top=(e.clientY-18)+'px'; }
      if (type==='pointerup'||type==='pointercancel') { active.delete(e.pointerId); dot?.remove(); dots.delete(e.pointerId); }
    },true);
  });
  const center=async id=>{const b=await page.locator(id).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  moveCenter=await center('#move'); fireCenter=await center('#fire-right');
  if (!closeOnly) {
  await setPhase('01 · Move, strafe and aim with two thumbs');
  await advance(0.6); await down(1,moveCenter.x,moveCenter.y); await move(1,moveCenter.x+40,moveCenter.y);
  await swipe(70,-35); await advance(0.6); await checkpoint('strafe');
  await move(1,moveCenter.x,moveCenter.y-40); await swipe(-100,60); await advance(0.6);
  await move(1,moveCenter.x-40,moveCenter.y); await swipe(60,30); await advance(0.6); await release();
  const released=await snapshot(); await advance(0.3); const stopped=await snapshot();
  observations.push({case:'release',movementAfterRelease:Math.hypot(stopped.x-released.x,stopped.z-released.z),extraShots:stopped.shots-released.shots});

  await reset(); await setPhase('02 · Rifle: strafe + fire + drag tracking'); await aimTarget(0);
  await down(1,moveCenter.x,moveCenter.y); await move(1,moveCenter.x+32,moveCenter.y);
  await down(2,fireCenter.x,fireCenter.y); let previous={...fireCenter};
  const fireStart=await snapshot();
  for(let i=0;i<18;i++) { const s=await snapshot(), t=s.targets[0], p=pixelsFor(s,t.x-s.x-s.aimOffset.x,t.z-s.z-s.aimOffset.z); previous.x+=p.x;previous.y+=p.y;await move(2,previous.x,previous.y);await advance(0.09);if(i===8)await checkpoint('rifle-strafe-fire'); }
  await release(); const fireEnd=await snapshot(); observations.push({case:'rifle-strafe-track',shots:fireEnd.shots-fireStart.shots,hits:fireEnd.hits-fireStart.hits,movement:Math.hypot(fireEnd.x-fireStart.x,fireEnd.z-fireStart.z)});
  await page.locator('#reload').tap(); await advance(0.45); await checkpoint('reload'); await advance(1.05);
  await page.locator('#swap').tap(); await advance(0.3); await aimTarget(2); const pistolStart=await snapshot();
  await down(2,fireCenter.x,fireCenter.y);await advance(1);await checkpoint('pistol');await release();
  const pistolEnd=await snapshot();observations.push({case:'pistol',shots:pistolEnd.shots-pistolStart.shots,hits:pistolEnd.hits-pistolStart.hits});

  await reset();await setPhase('03 · Chase the moving dummy with firing drags');await aimTarget(6);await down(2,fireCenter.x,fireCenter.y);previous={...fireCenter};const trackingStart=await snapshot();
  for(let i=0;i<20;i++){const s=await snapshot(),t=s.targets[6],p=pixelsFor(s,t.x-s.x-s.aimOffset.x,t.z-s.z-s.aimOffset.z);previous.x+=p.x;previous.y+=p.y;await move(2,previous.x,previous.y);await advance(0.12);if(i===10)await checkpoint('moving-target');}
  await release();const trackingEnd=await snapshot();observations.push({case:'moving-target-tracking',shots:trackingEnd.shots-trackingStart.shots,hits:trackingEnd.hits-trackingStart.hits});

  await reset();await setPhase('04 · Long swipes: does the aiming cursor stay visible?');await swipe(0,-210);await swipe(0,-150);
  const edge=await checkpoint('offscreen-reticle'), reticle=projectedReticle(edge);observations.push({case:'reticle-visibility',reticle,visible:reticle.x>=0&&reticle.x<=844&&reticle.y>=0&&reticle.y<=390,aimOffset:edge.aimOffset});
  await down(2,fireCenter.x,fireCenter.y);await advance(0.5);await release();

  await reset();await setPhase('05 · Precision: small swipe near the player');await aimOffsetTo(0,-0.35);const nearBefore=await checkpoint('near-aim-before');
  const nearPixels=pixelsFor(nearBefore,0,0.7);await swipe(nearPixels.x,nearPixels.y,undefined,6);const nearAfter=await checkpoint('near-aim-after');
  observations.push({case:'near-player-aim',swipePixels:Math.hypot(nearPixels.x,nearPixels.y),rotationDegrees:angleBetween(nearBefore,nearAfter),before:nearBefore.aimOffset,after:nearAfter.aimOffset});

  }
  await reset();await setPhase('06 · Normal range: shots aligned on dummy');await moveToward(0,-5);await aimTarget(0);const mediumStart=await snapshot();
  await down(2,fireCenter.x,fireCenter.y);await advance(0.32);await checkpoint('medium-range-hit');await release();const mediumEnd=await snapshot();
  observations.push({case:'normal-range',range:Math.hypot(mediumStart.targets[0].x-mediumStart.x,mediumStart.targets[0].z-mediumStart.z),shots:mediumEnd.shots-mediumStart.shots,hits:mediumEnd.hits-mediumStart.hits});
  await reset();await setPhase('07 · Point-blank: aim on body, hold fire');await moveToward(0,-7.4);await aimTarget(0);const closeStart=await snapshot();
  await down(2,fireCenter.x,fireCenter.y);await advance(0.55);await checkpoint('point-blank-result');await release();const closeEnd=await snapshot();
  observations.push({case:'point-blank',range:Math.hypot(closeStart.targets[0].x-closeStart.x,closeStart.targets[0].z-closeStart.z),shots:closeEnd.shots-closeStart.shots,hits:closeEnd.hits-closeStart.hits,targetHp:closeEnd.targets[0].hp,aimX:closeEnd.aimX,aimZ:closeEnd.aimZ});
  await advance(0.8);await setPhase('08 · Review complete — original live game unchanged');await advance(0.8);
  const touchStats=await page.evaluate(()=>window.reviewTouchStats);assert.ok(touchStats.max<=2);assert.deepEqual(errors,[]);
  if (releaseMeta.release_id.startsWith('combat-5-')) {
    const close = observations.find(o => o.case === 'point-blank');
    assert.ok(close.range > 0.5 && close.range < 0.7 && close.hits >= 3, 'controlled close-range shots hit');
    const turn = observations.find(o => o.case === 'near-player-aim');
    if (turn) assert.ok(turn.rotationDegrees < 30, 'small near-player swipe stays stable');
    const edge = samples.find(o => o.label === 'offscreen-reticle');
    if (edge) assert.equal(edge.aimEdge, true, 'off-screen aim has an edge indicator');
  }
  await writeFile(out+'/review.json',JSON.stringify({url,release:releaseMeta,integrity,errors,observations,phases,samples,inputLog,touchStats,wallSeconds:(performance.now()-wallStart)/1000,scope:'Scripted live gameplay with actual CDP touch events, recording-only overlays, read-only diagnostics. SwiftShader/capture timing does not establish phone frame rate or human ergonomics.'},null,2));
  console.log(JSON.stringify({release:releaseMeta.release_id,errors,observations,maxConcurrentFingers:touchStats.max,wallSeconds:(performance.now()-wallStart)/1000},null,2));
} finally {
  await context.close();await video.saveAs(out+'/playthrough.webm');await browser.close();
}
