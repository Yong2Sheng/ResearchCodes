import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEvent,seededRandom,healpixRingIndex,kleinNishinaWeight,eventErrors,DETECTOR_HALF_SIZE} from '../src/event-simulation.js';
import {directionFromAngles,makeSourceBasis,degToRad,dot} from '../src/physics.js';
import {projectDirection} from '../src/cds-projections.js';
const source=directionFromAngles(degToRad(145),degToRad(35)),basis=makeSourceBasis(source),data=JSON.parse(await readFile(new URL('../src/healpix-reference-data.json',import.meta.url)));
for(let i=0;i<data.events;i++)assert.equal(healpixRingIndex(data.axis_a[i],8),data.pixels[i],`HEALPix pixel ${i}`);
let tested=0;const stats=[];
for(const energy of [10,100,1000,10000]){
 const rng=seededRandom(180+energy);let mean=0,variance=0,forward=0;const observed=new Array(12).fill(0),expectedBins=new Array(12).fill(0);
 const count=25000;
 for(let i=0;i<count;i++){
 const e=createEvent({id:i,energy,source,rng}),err=eventErrors(e);assert.ok(err.energy<1e-9);assert.ok(err.angle<1e-10);assert.ok(err.direction<1e-12);assert.ok(e.e1>0&&e.e2>0);assert.ok(e.r1.every(x=>Math.abs(x)<DETECTOR_HALF_SIZE)&&e.r2.every(x=>Math.abs(x)<DETECTOR_HALF_SIZE));assert.ok(Math.hypot(...e.r1.map((x,j)=>x-e.r2[j]))>=1.25-1e-12);
 const xy=projectDirection(e.a,basis,'standard');assert.ok(Math.abs(Math.hypot(...xy)-e.phi)<1e-10);
 const mu=Math.cos(e.phi);observed[Math.min(11,Math.floor((mu+1)*6))]++;mean+=mu;variance+=mu*mu;if(mu>0)forward++;tested++;
 }
 // Independent midpoint integration of the probability density in cos(phi).
 let norm=0,m1=0,m2=0,pos=0;const bins=100000;for(let i=0;i<bins;i++){const mu=-1+(i+.5)*2/bins,w=kleinNishinaWeight(energy,mu);expectedBins[Math.min(11,Math.floor((mu+1)*6))]+=w;norm+=w;m1+=mu*w;m2+=mu*mu*w;if(mu>0)pos+=w}
 const expected=m1/norm,standardError=Math.sqrt((m2/norm-expected*expected)/count);assert.ok(Math.abs(mean/count-expected)<6*standardError);assert.ok(Math.abs(forward/count-pos/norm)<.025);const chiSquare=observed.reduce((sum,n,i)=>{const expectedCount=expectedBins[i]/norm*count;return sum+(n-expectedCount)**2/expectedCount},0);assert.ok(chiSquare<50);stats.push({energy,count,chiSquare,meanCos:mean/count,expectedMeanCos:expected});
}
for(const degrees of [0,90,180]){const phi=degToRad(degrees);for(const beta of [0,Math.PI/2,Math.PI]){const q=basis.s0.map((x,j)=>Math.cos(phi)*x+Math.sin(phi)*(basis.b1[j]*Math.cos(beta)+basis.b2[j]*Math.sin(beta)));const xy=projectDirection(q,basis,'standard');if(degrees===180)assert.equal(xy,null);else assert.ok(Math.abs(Math.hypot(...xy)-phi)<1e-12)}}
for(const chi of [0,60,180])for(const psi of [0,120,359]){const s=directionFromAngles(degToRad(chi),degToRad(psi));const e=createEvent({id:1,energy:1000,source:s,rng:seededRandom(chi+psi)});assert.ok(Math.abs(dot(s,e.a)-Math.cos(e.phi))<1e-12)}
console.log(JSON.stringify({passed:true,eventsChecked:tested,healpixReferenceMatches:data.events,stats},null,2));
