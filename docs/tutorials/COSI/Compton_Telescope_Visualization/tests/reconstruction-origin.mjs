import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const root=process.cwd(),browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+root+'/reconstruction.html');await page.waitForFunction(()=>window.__COMPTON_RECONSTRUCTION__);const state=()=>page.evaluate(()=>window.__COMPTON_RECONSTRUCTION__.state());
function check(s){assert.equal(s.hitVisible,true);assert.deepEqual(s.hitPoint,s.current.r1);assert.deepEqual(s.localAxesOrigin,s.current.r1);for(const anchor of s.axisLabelAnchors){const expected=s.current.r1.slice();expected[{x:0,y:1,z:2}[anchor.axis]]+=2.72;assert.deepEqual(anchor.position,expected)}if(s.stage>=4)assert.deepEqual(s.coneApex,s.current.r1)}
assert.equal((await state()).hitVisible,false);
// Check at the instant the first step starts, not only after the animation.
await page.evaluate(()=>document.getElementById('next').click());check(await state());await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().animating);check(await state());await page.screenshot({path:root+'/output/reconstruction/first-hit-origin.png',fullPage:true});
for(let step=2;step<=6;step++){await page.locator('#next').click();await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().animating);check(await state())}
const first=await state();await page.screenshot({path:root+'/output/reconstruction/cone-hit-origin.png',fullPage:true});
await page.locator('#next').click();await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().animating);const second=await state();check(second);assert.notDeepEqual(second.current.r1,first.current.r1);
await page.locator('#clear').click();assert.equal((await state()).hitVisible,false);assert.deepEqual((await state()).localAxesOrigin,[0,0,0]);assert.deepEqual(errors,[]);const result={passed:true,immediateFirstHit:true,axesHitConeCoincide:true,axesFollowEachEvent:true,labelsFollowAxes:true,clearResetsOrigin:true,errors};await writeFile('output/reconstruction/origin-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
