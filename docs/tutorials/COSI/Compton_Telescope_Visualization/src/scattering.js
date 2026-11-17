import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {mathHTML,typesetMath} from './math-typesetting.js';
import {scatteringModel,eventCircle} from './scattering-model.js';
import {add,scale,sub,normalize,cross,greatCircleArcDirections} from './physics.js';

const $=id=>document.getElementById(id),C={incident:'#b27a0b',scattered:'#007c96',electron:'#b34567',circle:'#7352b3',muted:'#73869a'};
const texts={zh:{title:'Compton 散射：从二维到三维',fullscreen:'全屏',previous:'上一步',next:'下一步',restart:'重新开始',resetView:'重置视角',incident:'入射光子 / 候选来源方向',scattered:'散射光子 / 第二次作用',recoil:'反冲电子（方向未用于重建）',circle:'event circle / event cone',candidate:'候选方向',sweep:'绕行一圈',pause:'暂停',showElectron:'显示反冲电子',showCone:'显示锥面',help:'二维阶段：按下一步讲解。三维阶段：左键拖动旋转，右键平移，滚轮缩放。← / → 切换步骤。自由电子初始静止，第二处完全吸收，忽略测量误差。',steps:['静止电子','入射光子','一次 Compton 散射','探测到的事件','转到三维','一整圈候选来源'],messages:['','光子到达第一次作用位置','光子改变方向，并将部分能量传给电子','两个位置确定散射方向；两处能量确定散射角','同一个事件，换一个观察角度','改变候选入射方向，散射角始终相同'],electron:'静止电子',invalid:'请输入 10–10000 keV 的入射能量。',webgl:'当前浏览器无法启动 WebGL。请使用支持 WebGL 的 Safari 或 Chrome。'},en:{title:'Compton scattering: 2D to 3D',fullscreen:'Fullscreen',previous:'Previous',next:'Next',restart:'Restart',resetView:'Reset view',incident:'Incident photon / candidate source',scattered:'Scattered photon / second interaction',recoil:'Recoil electron (direction not used)',circle:'Event circle / event cone',candidate:'Candidate',sweep:'Sweep 360°',pause:'Pause',showElectron:'Recoil electron',showCone:'Cone surface',help:'2D: advance one step at a time. 3D: drag to orbit, right-drag to pan, scroll to zoom. ← / → change steps. Free electron initially at rest, full absorption at site 2, ideal measurements.',steps:['Electron at rest','Incident photon','One Compton scatter','Measured event','Reveal the third dimension','A circle of possible sources'],messages:['','The photon reaches the first interaction','The photon changes direction and transfers energy to the electron','Two positions determine direction. Two energy deposits determine the angle.','The same event, viewed in three dimensions','Different candidate incident directions. The same scattering angle.'],electron:'Electron at rest',invalid:'Enter an incident energy between 10 and 10,000 keV.',webgl:'WebGL could not start. Use a WebGL-enabled Safari or Chrome browser.'}};
let language='zh',stage=0,energy=1000,phi=55*Math.PI/180,beta=0,sweeping=false,sweepMax=0,flight=null,cameraTween=null,lastDynamic=0,scatterAnimation=null;
let scatterProgress={paths:1,angle:1};
const view=$('view'),scene=new THREE.Scene();scene.background=new THREE.Color('#ffffff');
const camera=new THREE.PerspectiveCamera(38,1,.05,80);camera.up.set(0,1,0);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true})}catch(error){$('error').hidden=false;$('error').textContent=texts.zh.webgl;throw error}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));view.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=4.5;controls.maxDistance=20;controls.enablePan=true;
const fixed=new THREE.Group(),moving=new THREE.Group();scene.add(fixed,moving);
const labels={};
for(const [name,tex,color]of [['phi','\\varphi',C.incident],['k','\\boldsymbol{k}',C.scattered],['n','\\boldsymbol{n}',C.incident],['a','\\boldsymbol{a}',C.muted],['r1','r_1',C.muted],['r2','r_2',C.scattered],['s','\\boldsymbol{s}',C.incident],['electron','e^-',C.electron]]){const el=document.createElement('span');el.className='math-label';el.innerHTML=mathHTML(tex);el.style.color=color;el.dataset.label=name;$('labels').append(el);labels[name]={el,point:[0,0,0],visible:false}}
function vec(q){return new THREE.Vector3(...q)}
function clear(group){for(const o of [...group.children]){group.remove(o);o.traverse(child=>{child.geometry?.dispose();for(const m of Array.isArray(child.material)?child.material:[child.material])m?.dispose()})}}
function line(group,points,color,width=2,opacity=1){const geometry=new LineGeometry();geometry.setPositions(points.flat());const material=new LineMaterial({color,linewidth:width,transparent:opacity<1,opacity,depthWrite:false});const mesh=new Line2(geometry,material);mesh.userData.screenLine=true;group.add(mesh);return mesh}
function dashed(group,points,color,opacity=.6){const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(vec)),new THREE.LineDashedMaterial({color,dashSize:.09,gapSize:.07,transparent:true,opacity,depthWrite:false}));mesh.computeLineDistances();group.add(mesh);return mesh}
function arrow(group,start,direction,length,color){line(group,[start,add(start,scale(direction,length))],color,2.2);const o=new THREE.ArrowHelper(vec(direction),vec(start),length,color,Math.min(.19,length*.65),Math.min(.105,length*.36));group.add(o);return o}
function dot(group,point,color,radius=.075){const o=new THREE.Mesh(new THREE.SphereGeometry(radius,20,14),new THREE.MeshBasicMaterial({color}));o.position.set(...point);group.add(o);return o}
function label(name,point,visible=true){labels[name].point=point;labels[name].visible=visible}
/** Reveal a prefix of the final wave, keeping its wavelength and shape fixed. */
function wave(group,start,end,color,amplitude=.055,progress=1){
 if(progress<=0)return null;
 const direction=normalize(sub(end,start)),side=normalize(cross(direction,[0,0,1]),[0,1,0]),points=[],count=Math.max(2,Math.ceil(180*progress));
 for(let i=0;i<=count;i++){const t=i/count*progress;points.push(add(add(start,scale(sub(end,start),t)),scale(side,amplitude*Math.sin(t*18*Math.PI)*Math.sin(t*Math.PI))))}
 const path=line(group,points,color,2.7),tip=points.at(-1),tangent=normalize(sub(tip,points.at(-2))),headLength=Math.min(.28,Math.hypot(...sub(end,start))*progress*.5);
 arrow(group,add(tip,scale(tangent,-headLength)),tangent,headLength,color);return path;
}
function currentScatterProgress(now=performance.now()){
 if(!scatterAnimation)return{paths:1,angle:1};
 const elapsed=now-scatterAnimation.start;
 return{paths:Math.max(0,Math.min(1,elapsed/scatterAnimation.pathDuration)),angle:Math.max(0,Math.min(1,(elapsed-scatterAnimation.pathDuration)/scatterAnimation.angleDuration))};
}
function model(){return scatteringModel(energy,phi,beta)}
function flatHome(){camera.up.set(0,1,0);camera.position.set(.1,0,6.8);controls.target.set(.1,0,0);camera.lookAt(controls.target)}
const threeHome=[5.1,3.5,7.5];
function resetView(){cameraTween=null;const damping=controls.enableDamping;controls.enableDamping=false;controls.update();if(stage<4)flatHome();else{camera.position.set(...threeHome);camera.up.set(0,1,0);controls.target.set(0,0,0);camera.lookAt(controls.target)}controls.update();controls.enableDamping=damping}
function resize(){const width=view.clientWidth,height=view.clientHeight;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height)}new ResizeObserver(resize).observe(view);resize();flatHome();
function buildFixed(){clear(fixed);for(const o of Object.values(labels))o.visible=false;const m=model();
 dot(fixed,[0,0,0],stage>=3?'#273f55':C.electron,.085);label('r1',[0,-.22,0],stage>=3);label('electron',[-.1,.25,0],stage<2);
 if(stage>=3){dot(fixed,m.r2,C.scattered,.10);label('r2',add(m.r2,[.16,-.18,0]));}
 if(stage>=4){const sphere=new THREE.Mesh(new THREE.SphereGeometry(2.85,32,20),new THREE.MeshBasicMaterial({color:'#8fa8b7',wireframe:true,transparent:true,opacity:.10,depthWrite:false}));fixed.add(sphere);dashed(fixed,[[0,0,0],scale(m.a,3.15)],C.muted,.7);label('a',add(scale(m.a,1.6),[0,.22,0]));}
 if(stage>=5){const ring=eventCircle(energy,phi,200);line(fixed,ring,C.circle,3.6,.9);if($('cone').checked){const vertices=[];for(let i=1;i<ring.length;i++)vertices.push(0,0,0,...ring[i-1],...ring[i]);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));fixed.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:C.circle,side:THREE.DoubleSide,transparent:true,opacity:.075,depthWrite:false})));for(let i=0;i<12;i++)line(fixed,[[0,0,0],ring[Math.floor(i/12*200)]],C.circle,1,.16)}}
 buildMoving();
}
function buildMoving(){clear(moving);const m=model();scatterProgress=currentScatterProgress();
 for(const name of ['phi','n','s','k'])labels[name].visible=false;
 if(stage>=1){wave(moving,scale(m.s,3.15),[0,0,0],C.incident);if(stage>=4){dot(moving,m.sourcePoint,C.incident,.095);label('s',add(m.sourcePoint,[0,.18,0]));}label('n',add(scale(m.s,1.5),[0,.21,0]));}
 if(stage>=2){
  const path=wave(moving,[0,0,0],scale(m.k,1.84),C.scattered,.055,scatterProgress.paths);
  if(path)path.userData.role='scattered-path';
  label('k',scale(m.k,1.42),scatterProgress.paths>=.95);
  if($('electron').checked&&scatterProgress.paths>0){const recoil=arrow(moving,[0,0,0],m.electronDirection,1.42*scatterProgress.paths,C.electron);recoil.userData.role='recoil-arrow';}
  if(scatterProgress.angle>0){dashed(moving,[[0,0,0],scale(m.n,1.3)],C.incident,.55*scatterProgress.angle);const arc=greatCircleArcDirections(m.n,m.k,80);line(moving,arc.slice(0,Math.max(2,Math.ceil(arc.length*scatterProgress.angle))).map(q=>scale(q,.79)),C.incident,2.8);label('phi',scale(arc[Math.floor(arc.length*.53)],1.04),scatterProgress.angle>=.95);}
 }
 if(stage>=5&&sweepMax>0){const points=Array.from({length:Math.max(2,Math.ceil(sweepMax/2))+1},(_,i)=>scatteringModel(energy,phi,i/Math.max(2,Math.ceil(sweepMax/2))*sweepMax*Math.PI/180).sourcePoint);line(moving,points,C.incident,4);}
 if(stage===1){const progress=flight?Math.min(1,(performance.now()-flight)/1000):1;dot(moving,scale(m.s,3.15*(1-progress)),C.incident,.105);}
 readout();
}
function text(key){return texts[language][key]}
function readout(){const m=model();$('read-energy').textContent=energy.toFixed(0)+' keV';$('read-e1').textContent=m.e1.toFixed(1)+' keV';$('read-e2').textContent=m.e2.toFixed(1)+' keV';$('read-angle').textContent=(m.angle*180/Math.PI).toFixed(2)+'°';$('phi-value').textContent=Math.round(phi*180/Math.PI)+'°';$('beta-value').textContent=(beta*180/Math.PI).toFixed(1)+'°';$('beta-slider').value=String(beta*180/Math.PI);$('deposit-1').classList.toggle('hidden',stage<2);$('deposit-2').classList.toggle('hidden',stage<2);$('angle-readout').classList.toggle('hidden',stage<2||stage===2&&scatterProgress.angle===0);$('equation').classList.toggle('hidden',stage<5);}
function updateText(){document.documentElement.lang=language==='zh'?'zh-CN':'en';document.querySelectorAll('[data-t]').forEach(el=>el.textContent=text(el.dataset.t));$('language').textContent=language==='zh'?'English':'中文';$('step-title').textContent=text('steps')[stage];$('stage-count').textContent=`${stage+1} / 6`;$('stage-message').textContent=text('messages')[stage];$('previous').disabled=stage===0;$('next').disabled=!!scatterAnimation;$('next').textContent=text(stage===5?'restart':'next');$('beta-slider').disabled=stage<5;$('sweep').disabled=stage<5;$('sweep').textContent=text(sweeping?'pause':'sweep');$('cone').disabled=stage<5;typesetMath();readout();}
function setStage(next){sweeping=false;cameraTween=null;scatterAnimation=null;const before=stage;stage=next;beta=0;sweepMax=0;flight=stage===1?performance.now():null;if(stage===2){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;scatterAnimation={start:performance.now(),pathDuration:reduced?80:2500,angleDuration:reduced?40:550}}if(stage===3&&before!==3)$('electron').checked=false;
 if(stage<4){controls.enabled=false;resetView()}else{controls.enabled=true;if(before<4){cameraTween={start:performance.now(),from:camera.position.clone(),to:vec(threeHome)};controls.target.set(0,0,0)}}buildFixed();updateText();}
$('next').onclick=()=>{if(!scatterAnimation)setStage((stage+1)%6)};$('previous').onclick=()=>setStage(Math.max(0,stage-1));$('reset-view').onclick=resetView;
$('language').onclick=()=>{language=language==='zh'?'en':'zh';updateText()};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{}};
$('phi-slider').oninput=()=>{sweeping=false;phi=Number($('phi-slider').value)*Math.PI/180;sweepMax=0;buildFixed();updateText()};
function updateEnergy(){const proposed=Number($('energy').value);if(!Number.isFinite(proposed)||proposed<10||proposed>10000){$('energy').value=String(energy);$('error').hidden=false;$('error').textContent=text('invalid');return}$('error').hidden=true;energy=proposed;sweeping=false;buildFixed();updateText()}
$('energy').onchange=updateEnergy;$('energy').onkeydown=e=>{if(e.key==='Enter'){$('energy').blur();updateEnergy()}};
$('beta-slider').oninput=()=>{sweeping=false;beta=Number($('beta-slider').value)*Math.PI/180;sweepMax=Math.max(sweepMax,beta*180/Math.PI);buildMoving();updateText()};
$('sweep').onclick=()=>{sweeping=!sweeping;if(sweeping&&beta>=2*Math.PI-1e-7){beta=0;sweepMax=0}updateText()};$('electron').onchange=buildMoving;$('cone').onchange=buildFixed;
window.addEventListener('keydown',e=>{if(e.target.closest('input,button,select'))return;if(e.key==='ArrowRight'){e.preventDefault();if(!scatterAnimation)setStage((stage+1)%6)}if(e.key==='ArrowLeft'){e.preventDefault();setStage(Math.max(0,stage-1))}});
let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;
 if(cameraTween){const t=Math.min(1,(now-cameraTween.start)/(matchMedia('(prefers-reduced-motion: reduce)').matches?100:1100)),smooth=t*t*(3-2*t);camera.position.lerpVectors(cameraTween.from,cameraTween.to,smooth);camera.lookAt(controls.target);if(t===1)cameraTween=null}else if(stage>=4)controls.update();
 if(sweeping){beta=Math.min(2*Math.PI,beta+dt*Math.PI/4);sweepMax=Math.max(sweepMax,beta*180/Math.PI);if(beta>=2*Math.PI){sweeping=false;buildMoving();updateText()}}
 if((sweeping||stage===1&&flight||scatterAnimation)&&now-lastDynamic>32){buildMoving();lastDynamic=now;if(flight&&now-flight>=1000)flight=null;if(scatterAnimation&&scatterProgress.angle===1){scatterAnimation=null;updateText();}}
 scene.traverse(o=>{if(o.userData.screenLine)o.material.resolution.set(view.clientWidth,view.clientHeight)});renderer.render(scene,camera);
 for(const [name,{el,point,visible}]of Object.entries(labels)){const p=vec(point).project(camera),front=vec(point).applyMatrix4(camera.matrixWorldInverse).z<0;el.hidden=!visible||!front||Math.abs(p.x)>.98||Math.abs(p.y)>.98;if(!el.hidden){let x=(p.x+1)*view.clientWidth/2+7,y=(1-p.y)*view.clientHeight/2-12;
 // Keep k beside the projected photon path, including after camera rotation.
 if(name==='k'){const origin=vec([0,0,0]).project(camera),dx=(p.x-origin.x)*view.clientWidth,dy=-(p.y-origin.y)*view.clientHeight,length=Math.hypot(dx,dy);let nx=length>1e-6?-dy/length:1,ny=length>1e-6?dx/length:0;if(nx<0){nx=-nx;ny=-ny}const w=el.offsetWidth,h=el.offsetHeight,gap=25+Math.abs(nx)*w/2+Math.abs(ny)*h/2;x=(p.x+1)*view.clientWidth/2+nx*gap-w/2;y=(1-p.y)*view.clientHeight/2+ny*gap-h/2;}
 el.style.left=x+'px';el.style.top=y+'px'}}
}
controls.enabled=false;buildFixed();updateText();requestAnimationFrame(frame);
window.__COMPTON_SCATTERING__={state:()=>({stage,language,energy,phi,beta,sweeping,sweepMax,scatterAnimating:!!scatterAnimation,scatterProgress:{...scatterProgress},outgoingGeometry:moving.children.filter(o=>o.userData.role).map(o=>{if(o.userData.role==='recoil-arrow')return{role:o.userData.role,length:o.cone.position.y};const a=o.geometry.attributes.instanceEnd;return{role:o.userData.role,tip:[a.getX(a.count-1),a.getY(a.count-1),a.getZ(a.count-1)]}}),camera:camera.position.toArray(),controlsEnabled:controls.enabled,...model()}),circle:()=>eventCircle(energy,phi)};
