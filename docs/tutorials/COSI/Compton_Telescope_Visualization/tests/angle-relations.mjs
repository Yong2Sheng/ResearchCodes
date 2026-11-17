import assert from 'node:assert/strict';
import {createEvent,seededRandom} from '../src/event-simulation.js';
import {makeAngleRelations,angleGuideSelected} from '../src/angle-relations.js';
import {directionFromAngles,degToRad,dot} from '../src/physics.js';
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const rng=seededRandom(45178);let checked=0;
const events=[];
for(let i=0;i<120;i++)events.push(createEvent({id:i,energy:1000,source:directionFromAngles(degToRad(145),degToRad(35)),rng}));
for(const chi of [0,45,90,180])for(const psi of [0,90,183.57,359.99]){const k=directionFromAngles(degToRad(chi),degToRad(psi)),a=k.map(x=>-x),source=[0,0,1];events.push({k,a,source,phi:Math.acos(Math.max(-1,Math.min(1,a[2])))})}
for(const event of events){const before=JSON.stringify(event),data=makeAngleRelations(event);assert.equal(JSON.stringify(event),before);for(const g of data.guides){assert.ok(g.points.every(p=>p.every(Number.isFinite)));for(const p of g.points)close(Math.hypot(...p),g.radius);const start=g.points[0].map(x=>x/g.radius),end=g.points.at(-1).map(x=>x/g.radius);if(g.name==='phi'){assert.ok(distance(start,event.source)<1e-10);assert.ok(distance(end,event.a)<1e-10)}else if(g.name.startsWith('chi')){assert.ok(distance(start,[0,0,-1])<1e-10);assert.ok(distance(end,g.name.endsWith('-k')?event.k:event.a)<1e-10)}else{assert.ok(distance(start,[0,1,0])<1e-10);const d=g.name.endsWith('-k')?event.k:event.a,h=Math.hypot(d[0],d[1]);assert.ok(h>0);assert.ok(distance(end,[d[0]/h,d[1]/h,0])<1e-10);assert.ok(g.points.every(p=>Math.abs(p[2])<1e-12))}
let sweep=0;for(let i=1;i<g.points.length;i++)sweep+=Math.acos(Math.max(-1,Math.min(1,dot(g.points[i-1],g.points[i])/(g.radius*g.radius))));close(sweep,g.value,2e-7);checked++}
if(data.kAngles.psi===null)assert.equal(data.guides.some(g=>g.name==='psi-k'),false);if(data.aAngles.psi===null)assert.equal(data.guides.some(g=>g.name==='psi-a'),false);for(const mode of ['k','a']){const subset=data.guides.filter(g=>angleGuideSelected(g.name,mode));if(mode==='k')assert.equal(subset.some(g=>g.name==='phi'),data.guides.some(g=>g.name==='phi'));assert.ok(subset.every(g=>mode==='k'?(g.name==='phi'||g.name.endsWith('-k')):g.name.endsWith('-a')))}}
console.log(JSON.stringify({passed:true,events:events.length,arcs:checked,origins:'local r1',chiReference:'-z',psiReference:'+y toward +x',fullAzimuthSweeps:true,poles:true,eventImmutable:true},null,2));
