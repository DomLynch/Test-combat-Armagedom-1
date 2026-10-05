import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
await mkdir('artifacts', { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '4187' }, stdio: 'pipe' });
await new Promise((resolve,reject) => { server.stdout.once('data',resolve); server.once('error',reject); });
let browser;
const results=[];
try {
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4187',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__combat?.snapshot().started);
  const snapshot=()=>page.evaluate(()=>window.__combat.snapshot());
  const advance=async seconds=>{const end=(await snapshot()).simTime+seconds; await page.waitForFunction(t=>window.__combat.snapshot().simTime>=t,end,{timeout:15000});};
  const center=async id=>{const b=await page.locator(id).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const move=await center('#move'), fire=await center('#fire-right');
  const stickRadius=await page.locator('#move').evaluate(e=>e.getBoundingClientRect().width*0.37);
  const cdp=await context.newCDPSession(page);
  const fingers=new Set();
  const touch=async(type,points)=>{
    if((type==='touchEnd'||type==='touchCancel')&&!fingers.size)return;
    await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:4,radiusY:4,force:1}))});
    if(type==='touchCancel'||(type==='touchEnd'&&!points.length))fingers.clear();
    else if(type==='touchEnd')for(const [id] of points)fingers.delete(id);
    else for(const [id] of points)fingers.add(id);
  };
  const heading=s=>Math.atan2(s.aimOffset.x,s.aimOffset.z);
  const gap=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  const aligned=s=>{assert.ok(gap(s.bodyYaw,s.legsYaw)<1e-5);assert.ok(gap(s.bodyYaw,s.torsoYaw)<1e-5);assert.ok(gap(s.bodyYaw,Math.atan2(-s.aimX,-s.aimZ))<1e-5);};
  let left=[1,move.x,move.y];
  const steer=async(angle,strength=0.42,firing=false)=>{
    const s=await snapshot(), x=Math.sin(angle),z=Math.cos(angle);
    const sx=x*Math.cos(s.cameraYaw)-z*Math.sin(s.cameraYaw), sy=(x*Math.sin(s.cameraYaw)+z*Math.cos(s.cameraYaw))*s.verticalScale;
    const length=Math.hypot(sx,sy),radius=stickRadius*(0.13+0.87*strength);
    left=[1,move.x+sx/length*radius,move.y+sy/length*radius];
    await touch('touchMove',firing?[left,[2,fire.x,fire.y]]:[left]);
  };
  const walkTo=async(x,z)=>{
    await touch('touchStart',[[1,move.x,move.y]]);
    for(let i=0;i<260;i++){
      const s=await snapshot(),dx=x-s.x,dz=z-s.z,distance=Math.hypot(dx,dz);
      if(distance<0.03)break;
      await steer(Math.atan2(dx,dz),Math.min(0.45,distance/4));await advance(0.075);
    }
    await touch('touchEnd',[]);await advance(0.08);
    const s=await snapshot();assert.ok(Math.hypot(s.x-x,s.z-z)<0.05,'reached position through actual left-stick travel');
  };
  const reset=async()=>{await touch('touchEnd',[]);await page.locator('#reset').click();await advance(0.1);};
  assert.equal(await page.title(),'Mobile Combat Prototype');
  assert.equal(await page.locator('#welcome').isVisible(),false);assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.locator('#sensitivity,#aim,#fire-left').count(),0);
  assert.equal((await snapshot()).controls,'left-move-aim-fire-button');
  assert.equal(await page.locator('#fire-hint').textContent(),'HOLD TO FIRE');
  let b=await page.locator('#game').boundingBox();assert.equal(b.width,844);assert.equal(b.height,390);
  results.push('Independent prototype opens directly; mobile HUD labels left movement/aim and fire-only action');
  let before=await snapshot();assert.equal(before.selectedTarget,0);assert.equal(before.reticle.z,before.targets[0].z);
  await page.mouse.move(before.targets[0].screenX,before.targets[0].screenY);
  await page.keyboard.down('Space');await advance(0.45);await page.keyboard.up('Space');
  let after=await snapshot();assert.ok(after.hits>=3);assert.ok(after.shots>=3);aligned(after);
  results.push('Desktop mouse aim and actual hits retained; gun direction matches whole body');
  await reset();await page.locator('#assist').click();assert.equal((await snapshot()).assistEnabled,false);
  // FIRE travel and empty right-side touch travel cannot turn or move the player.
  before=await snapshot();await touch('touchStart',[[2,fire.x,fire.y]]);await advance(0.15);
  await touch('touchMove',[[2,fire.x-170,fire.y-110]]);await advance(0.3);after=await snapshot();
  assert.ok(after.shots>before.shots);assert.equal(after.x,before.x);assert.equal(after.z,before.z);assert.ok(gap(heading(after),heading(before))<1e-9);assert.ok(gap(after.bodyYaw,before.bodyYaw)<1e-5);
  await touch('touchEnd',[]);await advance(0.2);const stoppedShots=(await snapshot()).shots;await advance(0.2);assert.equal((await snapshot()).shots,stoppedShots);
  before=await snapshot();await touch('touchStart',[[2,620,170]]);await touch('touchMove',[[2,500,330]]);await advance(0.3);await touch('touchEnd',[]);after=await snapshot();
  assert.equal(after.x,before.x);assert.equal(after.z,before.z);assert.equal(after.shots,before.shots);assert.ok(gap(heading(after),heading(before))<1e-9);
  results.push('Dragging FIRE or the free right canvas does not steer or move; only held FIRE shoots and release stops it');
  await reset();await touch('touchStart',[[1,move.x+20,move.y]]);await advance(0.1);before=await snapshot();await advance(0.4);after=await snapshot();
  const walkingSpeed=Math.hypot(after.x-before.x,after.z-before.z)/(after.simTime-before.simTime);
  const priorSpeed=6*((20/stickRadius-0.13)/(1-0.13));
  assert.ok(Math.abs(walkingSpeed-priorSpeed)<1e-6,'same physical thumb deflection restores the original walking speed');
  assert.ok(Math.abs(walkingSpeed-6*Math.hypot(before.move.x,before.move.y))<1e-6);
  await touch('touchMove',[[1,move.x+stickRadius*1.1,move.y]]);await advance(0.1);before=await snapshot();await advance(0.3);after=await snapshot();
  assert.ok(Math.abs(Math.hypot(after.x-before.x,after.z-before.z)/(after.simTime-before.simTime)-6)<1e-6,'full stick restores 6 units per second');
  await touch('touchEnd',[]);await advance(0.08);before=await snapshot();await advance(0.2);after=await snapshot();assert.equal(after.x,before.x);assert.equal(after.z,before.z);
  results.push('Original walking response and 6-unit full-stick speed restored; release stops without inertia');
  await reset();await touch('touchStart',[[1,move.x,move.y]]);
  for(const degrees of [0,37,90,133,180,225,270,315,360]){
    const a=degrees*Math.PI/180;await steer(a);await advance(0.5);before=await snapshot();await advance(0.25);after=await snapshot();aligned(after);
    const dx=after.x-before.x,dz=after.z-before.z,length=Math.hypot(dx,dz);
    assert.ok(length>0.2 && (after.aimX*dx+after.aimZ*dz)/length>0.995,'left stick faces actual travel at '+degrees);
    assert.equal(after.shots,0);
  }
  await touch('touchStart',[left,[2,fire.x,fire.y]]);before=await snapshot();await steer(Math.PI,0.42,true);await advance(0.08);after=await snapshot();assert.ok(gap(heading(after),Math.PI)>0.05,'large thumb turn is softened rather than instant');await advance(0.7);after=await snapshot();
  assert.ok(after.shots>before.shots);assert.ok(gap(heading(after),Math.PI)<0.01,'held fire cannot freeze left-stick targeting');
  await steer(0,0.42,true);await advance(0.7);after=await snapshot();assert.ok(gap(heading(after),0)<0.01);aligned(after);
  await page.screenshot({path:'artifacts/left-aim-fire.png'});
  await touch('touchEnd',[[2,fire.x,fire.y]]);await advance(0.08);after=await snapshot();assert.equal(after.fireCount,0);assert.ok(Math.hypot(after.move.x,after.move.y)>0);
  await touch('touchEnd',[]);await advance(0.35);before=await snapshot();await advance(0.2);after=await snapshot();assert.equal(after.x,before.x);assert.equal(after.z,before.z);assert.ok(gap(heading(after),heading(before))<1e-9);
  results.push('Left stick turns full body through intermediate/360-degree travel; it keeps steering while FIRE is held, independently releases and stops');
  // Keep room ahead while the real-time renderer captures and toggles settings.
  await reset();await walkTo(0,-4);await page.locator('#assist').click();assert.equal((await snapshot()).assistEnabled,true);
  before=await snapshot();const bearing=Math.atan2(-before.x,-8-before.z),leftAngle=bearing+4*Math.PI/180;
  await touch('touchStart',[[1,move.x,move.y]]);await steer(leftAngle,0.16);await advance(0.1);before=await snapshot();
  assert.equal(before.assistTarget,0);assert.equal(before.selectedTarget,0);
  await advance(0.5);after=await snapshot();assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>0.3);assert.equal(after.assistTarget,0);assert.equal(after.selectedTarget,0);
  await steer(leftAngle+3*Math.PI/180,0.16);await advance(0.25);after=await snapshot();assert.equal(after.assistTarget,0,'7-degree offset stays retained by left targeting');assert.equal(after.selectedTarget,0);
  await page.screenshot({path:'artifacts/sticky-left-walking.png'});
  await touch('touchStart',[left,[2,fire.x,fire.y]]);await advance(0.08);assert.equal((await snapshot()).assistTarget,0);
  await touch('touchEnd',[[2,fire.x,fire.y]]);await advance(0.08);after=await snapshot();assert.equal(after.fireCount,0);assert.equal(after.assistTarget,0,'releasing FIRE cannot disengage left-stick assistance');
  await steer(leftAngle+25*Math.PI/180,0.16);await advance(0.25);assert.equal((await snapshot()).assistTarget,null,'deliberate left turn releases');
  await touch('touchEnd',[]);before=await snapshot();
  await touch('touchStart',[[1,move.x,move.y]]);await steer(Math.atan2(-before.x,-8-before.z)+4*Math.PI/180,0.16);await advance(0.1);assert.equal((await snapshot()).assistTarget,0);
  await touch('touchMove',[[1,move.x,move.y]]);await advance(0.08);before=await snapshot();
  const delta=Math.atan2(Math.sin(Math.atan2(-before.x,-8-before.z)-heading(before)),Math.cos(Math.atan2(-before.x,-8-before.z)-heading(before)));
  const range=Math.hypot(before.x,before.z+8);const expected=delta*0.3575*Math.max(0,Math.min(1,(6-range)/4));
  assert.ok(Math.abs(before.assistCorrection-expected)<1e-8,'left assist keeps accepted strength');
  await page.locator('#swap').click();await advance(0.08);after=await snapshot();assert.equal(after.weapon,'PISTOL');assert.ok(Math.abs(after.assistCorrection-expected)<1e-8);
  await page.locator('#assist').click();await advance(0.08);after=await snapshot();assert.equal(after.assistCorrection,0);assert.equal(after.assistTarget,null);
  await page.locator('#assist').click();await steer(Math.atan2(-after.x,-8-after.z)+4*Math.PI/180,0.16);await advance(0.1);assert.equal((await snapshot()).assistTarget,0);
  await touch('touchCancel',[]);await advance(0.08);after=await snapshot();assert.equal(after.assistTarget,null);assert.equal(after.moveHeld,false);assert.equal(after.fireCount,0);
  results.push('Left thumb retains nearby opponents through travel/jitter, deliberately releases; rifle/pistol strength, OFF and cancellation work');
  await page.locator('#assist').click();assert.equal((await snapshot()).assistEnabled,false);
  await reset();await walkTo(0,-7.4);before=await snapshot();assert.ok(Math.hypot(before.x,before.z+8)<0.7);
  await touch('touchStart',[[2,fire.x,fire.y]]);await advance(0.42);await touch('touchEnd',[]);after=await snapshot();assert.ok(after.hits>=3);assert.ok(after.targets[0].hp<=25);assert.equal(after.fireCount,0);
  await page.screenshot({path:'artifacts/point-blank-fixed.png'});
  const reload=await center('#reload');await touch('touchStart',[[1,move.x,move.y],[2,reload.x,reload.y]]);await touch('touchEnd',[[2,reload.x,reload.y]]);await advance(0.08);before=await snapshot();assert.ok(before.reloading>0);
  await touch('touchStart',[[1,move.x,move.y],[2,reload.x,reload.y]]);await touch('touchEnd',[[2,reload.x,reload.y]]);after=await snapshot();assert.ok(after.reloading<=before.reloading);
  await advance(1.5);after=await snapshot();assert.equal(after.ammo,30);assert.equal(after.reloading,0);
  await touch('touchStart',[[1,move.x,move.y],[2,reload.x,reload.y]]);assert.equal(await page.locator('#feedback').textContent(),'MAGAZINE FULL');await touch('touchEnd',[]);
  results.push('Fire-only button hits point-blank opponents; two-thumb reload/repeated taps/full-mag feedback retained');
  await reset();await page.locator('#swap').click();await advance(0.25);before=await snapshot();
  await touch('touchStart',[[2,fire.x,fire.y]]);await touch('touchEnd',[]);await advance(0.08);after=await snapshot();assert.equal(after.shots,before.shots+1);assert.equal(after.ammo,11);
  await advance(0.3);await touch('touchStart',[[2,fire.x,fire.y]]);await touch('touchEnd',[]);await advance(0.08);assert.equal((await snapshot()).shots,after.shots+1);
  await advance(0.3);await touch('touchStart',[[2,fire.x,fire.y]]);await touch('touchCancel',[]);before=await snapshot();await advance(0.15);assert.equal((await snapshot()).shots,before.shots);
  await page.locator('#reload').click();await advance(1.05);assert.equal((await snapshot()).ammo,12);
  results.push('Brief pistol fire taps each shoot once; canceled presses do not leave queued/held fire; actual pistol reload completes');
  // Native Safari event guards remain scoped; this does not prove real iOS zoom behaviour.
  const guard=await page.evaluate(async()=>{
    const game=document.getElementById('game'),move=document.getElementById('move'),fire=document.getElementById('fire-right'),menu=document.getElementById('assist');
    const gesture=[];for(const type of ['gesturestart','gesturechange','gestureend']){const e=new Event(type,{bubbles:true,cancelable:true});game.dispatchEvent(e);gesture.push(e.defaultPrevented);}
    const t=(target,id)=>new Touch({identifier:id,target,clientX:85,clientY:300});
    const dispatch=(type,target,touches)=>{const e=new TouchEvent(type,{bubbles:true,cancelable:true,touches,changedTouches:[t(target,9)]});target.dispatchEvent(e);return e.defaultPrevented;};
    const pair=dispatch('touchstart',fire,[t(move,1),t(fire,2)]),extra=dispatch('touchmove',game,[t(move,1),t(fire,2),t(game,3)]);
    await new Promise(r=>setTimeout(r,360));const first=dispatch('touchend',game,[]),second=dispatch('touchend',game,[]),menuEnd=dispatch('touchend',menu,[]);
    return{gesture,pair,extra,first,second,menuEnd,scale:visualViewport.scale,action:getComputedStyle(document.documentElement).touchAction};
  });
  assert.deepEqual(guard.gesture,[true,true,true]);assert.equal(guard.pair,false);assert.equal(guard.extra,true);assert.equal(guard.first,false);assert.equal(guard.second,true);assert.equal(guard.menuEnd,false);assert.equal(guard.scale,1);assert.equal(guard.action,'none');
  results.push('Safari gesture/double-tap guards retain valid left-stick plus fire touches and menu taps');
  before=await snapshot();assert.ok(before.audio.played>0);await page.locator('#sound').click();assert.equal((await snapshot()).audio.enabled,false);const muted=(await snapshot()).audio.played;
  await touch('touchStart',[[2,fire.x,fire.y]]);await advance(0.3);await touch('touchEnd',[]);assert.equal((await snapshot()).audio.played,muted);await page.locator('#sound').click();
  results.push('Gesture-unlocked shot audio and mute retained');
  await touch('touchStart',[[1,move.x+20,move.y],[2,fire.x,fire.y]]);await advance(0.08);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);after=await snapshot();assert.equal(after.moveHeld,false);assert.equal(after.fireCount,0);assert.equal(after.assistTarget,null);
  b=await page.locator('#game').boundingBox();assert.equal(b.width,390);assert.equal(b.height,844);
  for(const id of ['#move','#fire-right','#reload','#swap','#sound','#assist']){const q=await page.locator(id).boundingBox();assert.ok(q.x>=0&&q.y>=0&&q.x+q.width<=391&&q.y+q.height<=845,id+' fits portrait');}
  await page.screenshot({path:'artifacts/portrait.png'});await page.setViewportSize({width:844,height:390});await page.screenshot({path:'artifacts/landscape.png'});
  assert.deepEqual(errors,[]);results.push('Resize cancels held controls; landscape/portrait HUD fits with no runtime/console errors');
  await writeFile('artifacts/browser-result.json',JSON.stringify({pass:true,results,snapshot:await snapshot()},null,2));console.log(JSON.stringify({pass:true,results},null,2));
} finally {if(browser)await browser.close();server.kill();}
