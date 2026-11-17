import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const root=process.cwd();const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
await page.goto('file://'+root+'/reconstruction.html');await page.waitForFunction(()=>window.__COMPTON_RECONSTRUCTION__);await page.evaluate(()=>document.fonts.ready);
for(let i=0;i<6;i++){await page.locator('#next').click();await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().animating)}
let state=await page.evaluate(()=>window.__COMPTON_RECONSTRUCTION__.state());const distance=Math.hypot(...state.current.r1.map((x,i)=>x-state.current.r2[i]));assert.ok(distance>=1.25&&distance<=1.6);
assert.equal(await page.locator('#left-view .axis-annotation').count(),3);assert.equal(await page.locator('#left-view .axis-annotation .katex').count(),3);assert.ok(await page.locator('#event-card .katex').count()>5);assert.equal(await page.locator('.katex-error').count(),0);assert.equal(await page.locator('.formula .katex-display').count(),1);
for(const el of await page.locator('#left-view .axis-annotation').all()){assert.equal(await el.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)')}
await page.screenshot({path:root+'/output/reconstruction/math-and-axes.png',fullPage:true});
await page.locator('.notes summary').click();await page.locator('.formula').screenshot({path:root+'/output/reconstruction/latex-equations.png'});
await page.locator('#language').click();assert.match(await page.locator('.legend').first().textContent(),/Back-projection/);assert.ok(await page.locator('#event-card .katex').count()>5);
await page.locator('.notes summary').click();await page.locator('#left-view').scrollIntoViewIfNeeded();const box=await page.locator('#left-view').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+100,box.y+box.height/2+45,{steps:8});await page.mouse.up();await page.waitForTimeout(250);assert.deepEqual((await page.evaluate(()=>window.__COMPTON_RECONSTRUCTION__.state())).current,state.current);assert.equal(await page.locator('#left-view .axis-annotation').count(),3);
assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);const result={passed:true,distance,axes:'transparent DOM labels + real arrows',katex:true,offlineFonts:true,physicsUnchangedByCamera:true,errors};await writeFile('output/reconstruction/legibility-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
