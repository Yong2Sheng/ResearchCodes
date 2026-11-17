/** Angle guides in the event's local physical frame (origin r1).
 * Geometry only: enabling a guide must never mutate or resample an event.
 */
import {anglesFromDirection, greatCircleArcDirections, dot, clamp, scale} from './physics.js';
import {makeDirectionAngleAids} from './geometry.js';

export const ANGLE_COLORS = Object.freeze({phi:'#ffd166',chiK:'#ff8dd8',psiK:'#60dfd3',chiA:'#c6a0ff',psiA:'#70c4ff'});
export function makeAngleRelations(event) {
  const kAngles = anglesFromDirection(event.k), aAngles = anglesFromDirection(event.a);
  const k = makeDirectionAngleAids(event.k,kAngles.chi,kAngles.psi,kAngles.psi!==null);
  const a = makeDirectionAngleAids(event.a,aAngles.chi,aAngles.psi,aAngles.psi!==null);
  const guides = [];
  const add = (name,tex,color,radius,value,directions) => {
    if (value === null || !directions.length) return;
    const points = directions.map(q=>scale(q,radius));
    const anchor = scale(directions[Math.floor((directions.length-1)*.55)],radius+.12);
    guides.push({name,tex,color,radius,value,points,anchor,zero:value<1e-8});
  };
  add('chi-k','\\chi_k',ANGLE_COLORS.chiK,.78,kAngles.chi,k.chiArc);
  add('psi-k','\\psi_k',ANGLE_COLORS.psiK,1.28,kAngles.psi,k.psiArc);
  add('chi-a','\\chi_a',ANGLE_COLORS.chiA,1.08,aAngles.chi,a.chiArc);
  add('psi-a','\\psi_a',ANGLE_COLORS.psiA,1.72,aAngles.psi,a.psiArc);
  // At exact forward/backward scatter the scattering plane is not unique.
  const separation = Math.acos(clamp(dot(event.source,event.a),-1,1));
  if (separation>1e-8 && Math.PI-separation>1e-8) {
    add('phi','\\varphi',ANGLE_COLORS.phi,1.94,event.phi,greatCircleArcDirections(event.source,event.a,96));
  }
  return {guides,kAngles,aAngles,referenceZ:[0,0,-1],referenceY:[0,1,0]};
}
export function angleGuideSelected(name,mode) {
  return mode==='all'||mode==='k'&&(name==='phi'||name.endsWith('-k'))||mode==='a'&&name.endsWith('-a');
}
