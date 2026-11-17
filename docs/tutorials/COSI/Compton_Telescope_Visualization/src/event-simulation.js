/** Ideal, fully contained Compton events. No rendering dependencies.
 * Free electrons at rest; no detector acceptance, attenuation, or resolution model.
 * A position layout is illustrative; all energies and directions are reconstructed.
 */
import {MEC2_KEV, makeSourceBasis, coneAxisDirection, anglesFromDirection, dot, sub, normalize, scale, add, phiFromEnergyDeposits, scatteredPhotonEnergy, clamp} from './physics.js';
export const DETECTOR_HALF_SIZE=1.9;
export function seededRandom(seed=20261107){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
/** dσ/dΩ apart from r_e²/2. Sampling μ = cosφ uniformly includes sinφ dφ. */
export function kleinNishinaWeight(energy,mu){const q=1/(1+energy/MEC2_KEV*(1-mu));return q*q*(q+1/q-(1-mu*mu))}
export const unpolarizedModel={
 id:'unpolarized-klein-nishina',
 sample({energy,rng}){let mu;do{mu=2*rng()-1}while(2*rng()>kleinNishinaWeight(energy,mu));return{phi:Math.acos(clamp(mu,-1,1)),beta:2*Math.PI*rng()}}
};
/** Custom polarization models can implement sample({energy,rng,source,basis,polarization}). */
export function createEvent({id,energy,source,sourceId='source-1',rng=Math.random,model=unpolarizedModel,polarization=null}){
 if(!Number.isFinite(energy)||energy<=0)throw new Error('Energy must be positive');
 const basis=makeSourceBasis(source),sample=model.sample({energy,rng,source:basis.s0,basis,polarization});
 const {axis,k}=coneAxisDirection(sample.phi,sample.beta,basis);
 // Layout is conditioned to two contained interactions, NOT material transport.
 const r1=[0,0,0].map(()=>.55*(rng()-.5));
 let exit=Infinity;for(let j=0;j<3;j++)if(Math.abs(k[j])>1e-12)exit=Math.min(exit,((k[j]>0?DETECTOR_HALF_SIZE:-DETECTOR_HALF_SIZE)-r1[j])/k[j]);
 const distance=Math.min(exit*.94,1.25+.35*rng()),r2=add(r1,scale(k,distance));
 const e2=scatteredPhotonEnergy(energy,sample.phi),e1=energy-e2;
 // Reconstruct from measured quantities, not from a second independent draw.
 const reconstructedK=normalize(sub(r2,r1)),a=scale(reconstructedK,-1),phi=phiFromEnergyDeposits(e1,e2);
 return{id,sourceId,source:basis.s0.slice(),energy,e1,e2,r1,r2,k:reconstructedK,a,phi,beta:sample.beta,anglesK:anglesFromDirection(reconstructedK),anglesA:anglesFromDirection(a),model:model.id,polarization};
}
/** HEALPix RING indexing, using the physical Cartesian direction (+z polar axis). */
export function healpixRingIndex(q,nside=8){const z=clamp(q[2],-1,1),za=Math.abs(z),npix=12*nside*nside,ncap=2*nside*(nside-1);let longitude=Math.atan2(q[1],q[0]);if(longitude<0)longitude+=2*Math.PI;const tt=longitude/(Math.PI/2);
 if(za<=2/3){const jp=Math.floor(nside*(.5+tt-.75*z)),jm=Math.floor(nside*(.5+tt+.75*z)),ir=nside+1+jp-jm,kshift=1-(ir&1);let ip=Math.floor((jp+jm-nside+kshift+1)/2)+1;ip=((ip-1)%(4*nside)+4*nside)%(4*nside)+1;return ncap+(ir-1)*4*nside+ip-1}
 const tp=tt-Math.floor(tt),tmp=nside*Math.sqrt(3*(1-za)),jp=Math.floor(tp*tmp),jm=Math.floor((1-tp)*tmp),ir=jp+jm+1;let ip=Math.floor(tt*ir)+1;ip=((ip-1)%(4*ir)+4*ir)%(4*ir)+1;return z>0?2*ir*(ir-1)+ip-1:npix-2*ir*(ir+1)+ip-1;
}
export function eventErrors(e){return{energy:Math.abs(e.energy-e.e1-e.e2),angle:Math.abs(dot(e.source,e.a)-Math.cos(e.phi)),direction:Math.hypot(...sub(normalize(sub(e.r2,e.r1)),e.k))}}
