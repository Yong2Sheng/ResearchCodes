import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Shape,ShapeGeometry,Vector2} from 'three';
import {makeSourceBasis,directionFromAngles,degToRad,makeFullAxisTrack} from '../src/physics.js';
import {projectMollweidePixel,projectDirectionCurve,projectDirection} from '../src/cds-projections.js';
import {seededRandom,healpixRingIndex} from '../src/event-simulation.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/healpix-reference-data.json',import.meta.url))),expected=4*Math.PI/768;
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;
const rng=seededRandom(90173),poses=[[145,35],[90,0],[0,0],[180,0],[90,90],[90,180],[10,300]];
for(let i=0;i<16;i++)poses.push([Math.acos(2*rng()-1)*180/Math.PI,360*rng()]);
let maxAreaError=0,maxTotalError=0;
for(const [chi,psi]of poses){const basis=makeSourceBasis(directionFromAngles(degToRad(chi),degToRad(psi)));let total=0;for(const vs of data.pixel_boundaries){const parts=projectMollweidePixel(vs,basis);assert.ok(parts.length);let sum=0;for(const p of parts){assert.ok(p.every(q=>q.every(Number.isFinite)));assert.ok(p.every(q=>(q[0]/(2*Math.SQRT2))**2+(q[1]/Math.SQRT2)**2<=1+1e-10));sum+=area(p)}maxAreaError=Math.max(maxAreaError,Math.abs(sum/expected-1));total+=sum}maxTotalError=Math.max(maxTotalError,Math.abs(total/(4*Math.PI)-1))}
assert.ok(maxAreaError<.01,`Maximum pixel area error ${maxAreaError}`);assert.ok(maxTotalError<.0001);
function inside([x,y],p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
const basis=makeSourceBasis(directionFromAngles(degToRad(145),degToRad(35))),parts=projectMollweidePixel(data.pixel_boundaries[536],basis);let samples=0,covered=0;
for(let i=0;i<300000;i++){const z=2*rng()-1,t=2*Math.PI*rng(),r=Math.sqrt(1-z*z),q=[r*Math.cos(t),r*Math.sin(t),z];if(healpixRingIndex(q,8)!==536)continue;samples++;if(parts.some(p=>inside(projectDirection(q,basis,'mollweide'),p)))covered++}
let meshArea=0;for(const poly of parts){const geometry=new ShapeGeometry(new Shape(poly.map(q=>new Vector2(...q)))),positions=geometry.attributes.position,index=geometry.index;for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);meshArea+=Math.abs((positions.getX(b)-positions.getX(a))*(positions.getY(c)-positions.getY(a))-(positions.getY(b)-positions.getY(a))*(positions.getX(c)-positions.getX(a)))/2}geometry.dispose()}const polygonArea=parts.reduce((sum,p)=>sum+area(p),0);assert.ok(Math.abs(meshArea-polygonArea)/polygonArea<1e-5);
assert.ok(samples>250);assert.ok(covered/samples>.985,`Pixel 536 covers only ${covered}/${samples}`);
const guides=[];
for(const degrees of [15,30,55,80,90,91,100,110,140,165]){const projected=projectDirectionCurve(makeFullAxisTrack(degToRad(degrees),basis,1,240),basis,'mollweide');let maxSegment=0;for(const part of projected)for(let i=1;i<part.length;i++)maxSegment=Math.max(maxSegment,Math.hypot(...part[i].map((x,j)=>x-part[i-1][j])));assert.ok(projected.flat(2).every(Number.isFinite));if(degrees===110){assert.ok(projected.length>=2);assert.ok(maxSegment<.1)}guides.push({degrees,parts:projected.length,maxSegment})}
console.log(JSON.stringify({passed:true,sourceFrames:poses.length,pixelsPerFrame:768,maxAreaError,maxTotalError,pixel536:{samples,covered,meshArea,polygonArea},guides},null,2));
