import {MEC2_KEV,add,scale,sub,normalize,dot,cross,clamp} from './physics.js';
/** One ideal two-site Compton event. k and deposits stay fixed when beta changes.
 * beta enumerates alternative incident directions, NOT repeated scattering.
 * Momenta below use keV/c (with the numerical factor c suppressed).
 */
export function scatteringModel(energy,phi,beta=0){
 if(!Number.isFinite(energy)||energy<=0||!Number.isFinite(phi)||phi<=0||phi>=Math.PI||!Number.isFinite(beta))throw new RangeError('Use E > 0 and 0 < varphi < pi');
 const k=[Math.cos(phi),-Math.sin(phi),0],a=scale(k,-1),u=[Math.sin(phi),Math.cos(phi),0],v=cross(k,u);
 const n=add(scale(k,Math.cos(phi)),scale(add(scale(u,Math.cos(beta)),scale(v,Math.sin(beta))),Math.sin(phi))),s=scale(n,-1);
 const e2=energy/(1+energy/MEC2_KEV*(1-Math.cos(phi))),e1=energy-e2,pElectron=sub(scale(n,energy),scale(k,e2));
 return {energy,phi,beta,k,a,n,s,u,v,e1,e2,pElectron,electronDirection:normalize(pElectron),r1:[0,0,0],r2:scale(k,2),sourcePoint:scale(s,2.85),angle:Math.acos(clamp(dot(n,k),-1,1)),reconstructedPhi:Math.acos(clamp(1-MEC2_KEV*(1/e2-1/energy),-1,1))};
}
export function eventCircle(energy,phi,count=180){return Array.from({length:count+1},(_,i)=>scatteringModel(energy,phi,i/count*2*Math.PI).sourcePoint)}
