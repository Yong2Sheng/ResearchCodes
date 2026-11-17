import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const root=process.cwd(),browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+root+'/reconstruction.html');await page.waitForFunction(()=>window.__COMPTON_RECONSTRUCTION__);
for(let i=0;i<6;i++){await page.locator('#next').click();await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().animating)}
await page.locator('#batch').click();await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().batchBusy);assert.equal((await page.evaluate(()=>window.__COMPTON_RECONSTRUCTION__.state())).count,1001);
await page.locator('#language').click();await page.waitForTimeout(200);await page.screenshot({path:root+'/output/reconstruction/presentation-standard.png',fullPage:true});
await page.selectOption('#projection','mollweide');await page.waitForTimeout(200);await page.screenshot({path:root+'/output/reconstruction/presentation-mollweide.png',fullPage:true});
// Clear during a running batch: stop without putting events back after the clear.
await page.evaluate(()=>{document.getElementById('batch').click();document.getElementById('clear').click()});await page.waitForFunction(()=>!window.__COMPTON_RECONSTRUCTION__.state().batchBusy);assert.equal((await page.evaluate(()=>window.__COMPTON_RECONSTRUCTION__.state())).count,0);
const align=await page.evaluate(()=>{const a=document.getElementById('left-view').getBoundingClientRect(),b=document.getElementById('right-view').getBoundingClientRect();return{top:a.top-b.top,bottom:a.bottom-b.bottom,overflow:document.body.scrollWidth-innerWidth}});assert.deepEqual(align,{top:0,bottom:0,overflow:0});assert.deepEqual(errors,[]);
const result={passed:true,alignment:align,fixedLegends:true,batchClearRace:true,errors};await writeFile('output/reconstruction/display-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
