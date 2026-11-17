import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const root=process.cwd();await mkdir('output/reconstruction',{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
try{
await page.goto('file://'+root+'/reconstruction.html');await page.waitForFunction(()=>window.__COMPTON_RECONSTRUCTION__);const state=()=>page.evaluate(()=>window.__COMPTON_RECONSTRUCTION__.state());
async function settle(){await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().animating)}
assert.equal((await state()).count,0);
for(let i=1;i<=6;i++){await page.locator('#next').click();await settle();const s=await state();assert.equal(s.stage,i);assert.equal(s.count,i===6?1:0)}
const first=(await state()).current;assert.ok(first.e1>0&&first.e2>0);
assert.match(await page.locator('#event-id').textContent(),/#1/);
await page.screenshot({path:root+'/output/reconstruction/full-standard.png',fullPage:true});
await page.locator('#replay').click();await settle();for(let i=2;i<=6;i++){await page.locator('#next').click();await settle()}assert.equal((await state()).count,1);assert.equal((await state()).current.id,first.id);
const camerasBefore=await state();await page.selectOption('#projection','mollweide');assert.equal((await state()).count,1);assert.equal((await state()).current.id,first.id);await page.screenshot({path:root+'/output/reconstruction/full-mollweide.png',fullPage:true});await page.selectOption('#projection','standard');assert.ok((await state()).coneError<1e-10);const point=(await state()).selectedPoint;assert.ok(Math.abs(Math.hypot(point[0],point[1])-point[2])<1e-10);
await page.locator('#settings').evaluate(e=>e.open=true);await page.locator('#energy').fill('2000');await page.locator('#apply-settings').click();assert.equal((await state()).energy,2000);assert.equal((await state()).count,1);for(let i=1;i<=6;i++){await page.locator('#next').click();await settle()}assert.equal((await state()).current.energy,2000);assert.equal((await state()).count,2);
const previousEvents=await page.evaluate(()=>window.__COMPTON_RECONSTRUCTION__.events());
await page.locator('#settings').evaluate(e=>e.open=true);await page.locator('#source-chi').fill('90');await page.locator('#source-psi').fill('150');await page.locator('#apply-settings').click();assert.equal((await state()).groups.length,2);assert.equal((await state()).visible,0);assert.deepEqual(await page.evaluate(()=>window.__COMPTON_RECONSTRUCTION__.events()),previousEvents);
await page.locator('#batch').click();await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().batchBusy);let s=await state();assert.equal(s.count,1002);assert.equal(s.visible,1000);assert.equal(s.renderedPoints,1000);assert.ok(s.coneError<1e-10);assert.ok(s.errors.energy<1e-9);assert.ok(s.errors.angle<1e-10);
await page.locator('#show-others').check();assert.equal((await state()).visible,1002);
await page.locator('#settings').evaluate(e=>e.open=true);await page.selectOption('#source-group',{index:0});assert.equal((await state()).count,1002);await page.locator('#show-others').uncheck();assert.equal((await state()).visible,2);
await page.locator('#event-history').fill('0');assert.equal((await state()).current.energy,1000);
// Free-flight moves the chosen camera only, and preserves physics.
const beforeFly=await state();await page.selectOption('#camera-left','fly');await page.locator('#left-view').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(800);await page.keyboard.up('KeyW');const afterFly=await state();assert.ok(Math.hypot(...afterFly.leftCamera.map((x,i)=>x-beforeFly.leftCamera[i]))>.001);assert.ok(Math.hypot(...afterFly.rightCamera.map((x,i)=>x-beforeFly.rightCamera[i]))<1e-9);assert.equal(afterFly.current.id,beforeFly.current.id);await page.locator('#reset-left').click();
// Auto mode advances without button clicks; pausing stops further stages.
await page.locator('#auto').click();await page.waitForTimeout(1200);await page.locator('#auto').click();await settle();const paused=await state();await page.waitForTimeout(1000);assert.equal((await state()).stage,paused.stage);assert.equal((await state()).count,paused.count);
await page.locator('#language').click();assert.equal((await state()).language,'en');assert.match(await page.locator('.projection-note').textContent(),/same events/);
const alignment=await page.evaluate(()=>{const a=document.getElementById('left-view').getBoundingClientRect(),b=document.getElementById('right-view').getBoundingClientRect();return{top:Math.abs(a.top-b.top),bottom:Math.abs(a.bottom-b.bottom),bodyWidth:document.body.scrollWidth,innerWidth}});assert.ok(alignment.top<1&&alignment.bottom<1);assert.ok(alignment.bodyWidth<=alignment.innerWidth);
await page.locator('#settings').evaluate(e=>e.open=true);await page.selectOption('#source-group',{index:1});await page.locator('#event-history').fill('999');await page.waitForTimeout(250);await page.setViewportSize({width:1366,height:768});await page.screenshot({path:root+'/output/reconstruction/projector-1366.png',fullPage:true});const low=await page.evaluate(()=>{const a=document.getElementById('left-view').getBoundingClientRect(),b=document.getElementById('right-view').getBoundingClientRect();return{top:Math.abs(a.top-b.top),bottom:Math.abs(a.bottom-b.bottom),body:document.body.scrollWidth,inner:innerWidth}});assert.ok(low.top<1&&low.bottom<1);assert.ok(low.body<=low.inner);
await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/output/reconstruction/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth));
await page.locator('#clear').click();assert.equal((await state()).count,0);assert.equal((await state()).stage,0);assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
console.log(JSON.stringify({passed:true,manualStages:6,replayNoDuplicate:true,batch1000:true,energyAndSourceHistory:true,freeFlight:true,pause:true,aligned:alignment,projector:low,offline:true,errors},null,2));
}finally{await browser.close()}
