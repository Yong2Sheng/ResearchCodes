import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {add,scale,normalize,sub} from './physics.js';
import {makeAngleRelations,angleGuideSelected} from './angle-relations.js';
import {addAxisAnnotation} from './reconstruction-scene.js';

function dashed(group,points,color,opacity=.55) {
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(q=>new THREE.Vector3(...q))),new THREE.LineDashedMaterial({color,dashSize:.075,gapSize:.045,transparent:true,opacity,depthTest:false,depthWrite:false}));
  line.computeLineDistances();group.add(line);return line;
}
function arcLine(group,guide) {
  const geometry=new LineGeometry();geometry.setPositions(guide.points.flat());
  const material=new LineMaterial({color:guide.color,linewidth:2.8,depthTest:false,depthWrite:false,transparent:true,opacity:1});
  const line=new Line2(geometry,material);line.userData.screenLine=true;line.userData.angleGuide=guide.name;group.add(line);return line;
}
function mathLabel(view,tex,point,color,name) {
  const element=addAxisAnnotation(view,tex,point,color);
  const annotation=view.annotations.at(-1);annotation.kind='angle';
  element.removeAttribute('data-axis');element.dataset.angle=name;
  return annotation;
}
function directionArrow(group,direction,color) {
  const arrow=new THREE.ArrowHelper(new THREE.Vector3(...direction),new THREE.Vector3(),2.18,color,.14,.07);
  arrow.traverse(o=>{if(o.material){o.material.depthTest=false;o.material.depthWrite=false}});group.add(arrow);
}

/** Rebuild disposable guides and transparent math labels at the SAME r1 origin. */
export function drawAngleRelations(view,group,event,mode) {
  const data=makeAngleRelations(event),objects=[];
  group.position.set(...event.r1);group.renderOrder=40;
  const full=mode==='all',showK=full||mode==='k',showA=full||mode==='a';
  const label=(tex,q,color,name)=>mathLabel(view,tex,add(event.r1,q),color,name);
  if(showK||showA) {
    dashed(group,[[0,0,0],[0,0,-2.6]],'#aec2d0',.65);
    label('-z',[0,0,-2.7],'#c5d3df','reference-z');
    const plane=[];for(let i=0;i<=96;i++){const t=2*Math.PI*i/96;plane.push([1.78*Math.sin(t),1.78*Math.cos(t),0])}
    dashed(group,plane,'#8aa5b5',.25);
  }
  if(showK) {directionArrow(group,event.k,'#60dfd3');label('\\boldsymbol{k}',scale(event.k,2.3),'#60dfd3','direction-k')}
  if(showA||mode==='k')label('\\boldsymbol{a}',scale(event.a,2.48),'#70c4ff','direction-a');
  for(const [id,direction,angles,color]of [['k',event.k,data.kAngles,'#60dfd3'],['a',event.a,data.aAngles,'#70c4ff']]) {
    if(!(id==='k'?showK:showA)||angles.psi===null)continue;
    const tip=scale(direction,2.18),foot=[tip[0],tip[1],0],radius=id==='k'?1.28:1.72;
    const end=[radius*Math.sin(angles.psi),radius*Math.cos(angles.psi),0];
    dashed(group,[tip,foot],color,.8);dashed(group,[[0,0,0],foot,end],color,.55);
  }
  const selected=data.guides.filter(g=>angleGuideSelected(g.name,mode));
  for(const guide of selected) {
    if(!guide.zero) {
      const line=arcLine(group,guide);objects.push({guide,line});
      const first=guide.points[0],last=guide.points.at(-1);
      dashed(group,[[0,0,0],first],guide.color,.3);
      dashed(group,[[0,0,0],last],guide.color,.3);
      // A small arrowhead shows the sweep direction; omit it on tiny arcs.
      if(guide.radius*guide.value>.2) {
        const tangent=normalize(sub(last,guide.points.at(-2)));
        const cone=new THREE.Mesh(new THREE.ConeGeometry(.035,.10,12),new THREE.MeshBasicMaterial({color:guide.color,depthTest:false,depthWrite:false}));
        cone.position.set(...add(last,scale(tangent,-.05)));
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...tangent));group.add(cone);
      }
    }
    label(guide.tex+(guide.zero?'=0^\\circ':''),guide.anchor,guide.color,guide.name);
  }
  return {data,selected,objects};
}
