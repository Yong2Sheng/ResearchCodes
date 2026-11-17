import {THREE,vector,line,ball,label,arrow,disposeGroup,setupScene,addAxisAnnotation} from './reconstruction-scene.js';
import {messages} from './reconstruction-i18n.js';
import {drawAngleRelations} from './angle-relations-view.js';
import {mathHTML,typesetMath} from './math-typesetting.js';
import {createEvent,DETECTOR_HALF_SIZE,seededRandom,healpixRingIndex,eventErrors} from './event-simulation.js';
import {projectDirection,projectMollweidePixel,projectDirectionCurve} from './cds-projections.js';
import {makeSourceBasis,directionFromAngles,degToRad,radToDeg,scale,add,normalize,makeFullAxisTrack} from './physics.js';
import {makeEventConeData,makePhiAngleArc,makeDirectionAngleAids} from './geometry.js';
import data from './healpix-reference-data.json';
const $=id=>document.getElementById(id);
let language='zh';try{if(localStorage.getItem('compton-language')==='en')language='en'}catch{}
const text=key=>messages[language][key];
const rng=seededRandom(),groups=new Map();
let sourceCounter=0,eventCounter=0,activeSource,energy=1000,projection='standard',events=[],current=null,stage=0,transition=null,auto=false,batchBusy=false,batchCancel=false,batchAdded=0,sliceCenter=55,notice='',singularOmitted=0;
const nside=data.nside;
function getSource(chi,psi){const direction=directionFromAngles(degToRad(chi),degToRad(psi)),key=direction.map(x=>x.toFixed(7)).join(',');let source=groups.get(key);if(!source){source={key,id:`source-${++sourceCounter}`,number:sourceCounter,chi,psi,direction,basis:makeSourceBasis(direction)};groups.set(key,source)}return source}
activeSource=getSource(145,35);
const left=setupScene('left-view',[5.4,-6.5,4.15],[0,0,0]),right=setupScene('right-view',[5.184,-6.048,4.008],[0,0,1.2]);
const leftBase=new THREE.Group(),physical=new THREE.Group(),mapGroup=new THREE.Group(),sliceGroup=new THREE.Group(),selectionGroup=new THREE.Group();left.scene.add(leftBase,physical);right.scene.add(mapGroup,sliceGroup,selectionGroup);
const detector=new THREE.Mesh(new THREE.BoxGeometry(...[1,1,1].map(()=>2*DETECTOR_HALF_SIZE)),new THREE.MeshBasicMaterial({color:'#3a8cae',transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false}));leftBase.add(detector);leftBase.add(new THREE.LineSegments(new THREE.EdgesGeometry(detector.geometry),new THREE.LineBasicMaterial({color:'#6cb1d4',transparent:true,opacity:.45})));
const eventAxes=new THREE.Group();left.scene.add(eventAxes);
for(const [q,name,color]of [[[1,0,0],'x','#c99b82'],[[0,1,0],'y','#98be9b'],[[0,0,1],'z','#8fb7eb']]){arrow(eventAxes,[0,0,0],q,2.65,color);addAxisAnnotation(left,name,scale(q,2.72),color)}
const angleGroup=new THREE.Group();left.scene.add(angleGroup);let angleView=null;
const anglesVisible=()=>$('angles-visible').checked;
const coneOpacity=()=>anglesVisible()?.075:.22;
function clearAngleRelations(){disposeGroup(angleGroup);angleView=null;for(let i=left.annotations.length-1;i>=0;i--)if(left.annotations[i].kind==='angle'){left.annotations[i].el.remove();left.annotations.splice(i,1)}}
const photon=ball(left.scene,'#ffe6a0',.065);photon.visible=false;
let coneMesh=null,firstMarker=null,secondMarker=null,currentConeGroup=null;
let cloudGeometry=new THREE.BufferGeometry(),cloudMaterial=new THREE.PointsMaterial({size:2.5,vertexColors:true,sizeAttenuation:false,transparent:true,opacity:.9,depthWrite:false}),cloud=new THREE.Points(cloudGeometry,cloudMaterial);right.scene.add(cloud);
let visibleEvents=[],theoryGroup=null;
const eventBasis=e=>makeSourceBasis(e.source);
const angle=a=>a===null?'—':radToDeg(a).toFixed(2)+'°';
const energyLabel=e=>e<100?e.toFixed(2):e.toFixed(1);
function create(){return createEvent({id:++eventCounter,energy,source:activeSource.direction,sourceId:activeSource.id,rng})}
function physicalSource(){return current?current.source:activeSource.direction}
function sourceStar(group,pos){const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.08:.18,x=Math.cos(a)*r,y=Math.sin(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y)}shape.closePath();const star=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#ffd166',side:THREE.DoubleSide,depthTest:false}));star.position.copy(vector(pos));star.quaternion.copy(left.camera.quaternion);star.userData.billboard=true;group.add(star);return star}
function drawPhysical(){clearAngleRelations();disposeGroup(physical);coneMesh=null;currentConeGroup=null;firstMarker=null;secondMarker=null;const e=current,origin=e?e.r1:[0,0,0],source=physicalSource(),radius=2.35,sourcePosition=add(origin,scale(source,radius));eventAxes.position.copy(vector(origin));for(const annotation of left.annotations){annotation.el.innerHTML=mathHTML(annotation.el.dataset.axis==='y'&&anglesVisible()?'+y':annotation.el.dataset.axis);const endpoint=[0,0,0];endpoint[{x:0,y:1,z:2}[annotation.el.dataset.axis]]=2.72;annotation.position.copy(vector(add(origin,endpoint)))}sourceStar(physical,sourcePosition);line(physical,[origin,add(origin,scale(source,2.65))],'#5bc89f',.45);
 if(!e)return;
 if(stage>=1){line(physical,[sourcePosition,e.r1],'#ffd166',.6);firstMarker=ball(physical,'#ffffff',.085);firstMarker.position.copy(vector(e.r1));firstMarker.material.depthTest=false;firstMarker.material.depthWrite=false;firstMarker.renderOrder=25;}
 if(stage>=2){arrow(physical,e.r1,e.k,.55,'#60dfd3')}
 if(stage>=3){secondMarker=ball(physical,'#60dfd3',.08);secondMarker.position.copy(vector(e.r2));line(physical,[e.r1,e.r2],'#60dfd3')}
 if(stage>=4){const basis=eventBasis(e),g=makeEventConeData(e.phi,e.beta,basis,radius,160),coneGroup=new THREE.Group();coneGroup.position.copy(vector(e.r1));physical.add(coneGroup);currentConeGroup=coneGroup;
 const sky=new THREE.Mesh(new THREE.SphereGeometry(radius,28,18),new THREE.MeshBasicMaterial({color:'#6295ac',wireframe:true,transparent:true,opacity:anglesVisible()?.04:.085,depthWrite:false}));coneGroup.add(sky);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.mesh.vertices,3));geometry.setIndex(g.mesh.indices);coneMesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#fb8495',transparent:true,opacity:coneOpacity(),side:THREE.DoubleSide,depthWrite:false}));coneGroup.add(coneMesh);line(coneGroup,g.circlePositions,'#ff91a2');for(const pair of g.generatrices)line(coneGroup,pair,'#fb8495',.32);
 arrow(coneGroup,[0,0,0],e.a,radius,'#70c4ff');const a=ball(coneGroup,'#70c4ff',.065);a.position.copy(vector(scale(e.a,radius)));
 const arc=makePhiAngleArc(e.phi,e.beta,basis,72);if(arc.length&&!anglesVisible()){line(coneGroup,arc.map(q=>scale(q,.75)),'#ffd166');}
 if(anglesVisible())angleView=drawAngleRelations(left,angleGroup,e,$('angle-mode').value);
 }
}
function mapLine(points,color,opacity=1){return line(mapGroup,points,color,opacity)}
function rebuildMap(){disposeGroup(mapGroup);right.annotationLayer.replaceChildren();right.annotations.length=0;const basis=activeSource.basis;
 if(projection==='standard'){
 for(const degrees of [30,60,90,120,150,180]){const rho=degToRad(degrees),points=[];for(let i=0;i<=120;i++)points.push([rho*Math.cos(i*Math.PI/60),rho*Math.sin(i*Math.PI/60),0]);mapLine(points,'#708f9f',.3);label(mapGroup,degrees+'°',[rho,0,-.15],'#aac4d4',.045)}
 for(let i=0;i<12;i++){const beta=i*Math.PI/6;mapLine([[0,0,0],[Math.PI*Math.cos(beta),Math.PI*Math.sin(beta),0]],'#708f9f',.2)}
 }else{for(const bounds of data.pixel_boundaries)for(const part of projectMollweidePixel(bounds,basis))mapLine([...part,part[0]].map(p=>[...p,0]),'#708f9f',.19);const ellipse=[];for(let i=0;i<=160;i++)ellipse.push([2*Math.SQRT2*Math.cos(i*Math.PI/80),Math.SQRT2*Math.sin(i*Math.PI/80),0]);mapLine(ellipse,'#9ab9ca',.6)}
 const source=ball(mapGroup,'#ffd166',.06);source.position.set(0,0,0);
 mapLine([[-3.35,-1.65,0],[-3.35,-1.65,Math.PI]],'#a8c5d7');addAxisAnnotation(right,'\\varphi',[-3.35,-1.65,3.75],'#d3e8f5').dataset.axis='varphi';
 for(const d of [0,30,60,90,120,150,180]){const z=degToRad(d);mapLine([[-3.45,-1.65,z],[-3.25,-1.65,z]],'#a8c5d7');label(mapGroup,d+'°',[-3.65,-1.65,z],'#d3e8f5',.05)}
 theoryGroup=new THREE.Group();mapGroup.add(theoryGroup);theoryGroup.visible=$('theory-visible').checked;
 for(const degrees of [15,30,55,80,110,140,165]){const phi=degToRad(degrees);for(const part of projectDirectionCurve(makeFullAxisTrack(phi,basis,1,240),basis,projection))line(theoryGroup,part.map(xy=>[...xy,phi]),'#4bba96',.36)}
}
function refreshCloud(){visibleEvents=events.filter(e=>e.sourceId===activeSource.id||$('show-others').checked);const points=[],colors=[];singularOmitted=0;
 for(const e of visibleEvents){const xy=projectDirection(e.a,activeSource.basis,projection);if(!xy){singularOmitted++;continue}points.push(...xy,e.phi);const color=new THREE.Color(e.sourceId===activeSource.id?'#70c4ff':'#ac8fea');colors.push(color.r,color.g,color.b)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));cloud.geometry.dispose();cloud.geometry=geometry;cloudGeometry=geometry;
 refreshSelection();refreshSlice();updateCounts();
}
function refreshSelection(){disposeGroup(selectionGroup);if(!current||stage<6||!events.some(e=>e.id===current.id))return;const xy=projectDirection(current.a,activeSource.basis,projection);if(!xy)return;const selected=ball(selectionGroup,'#ffd166',.075);selected.position.set(...xy,current.phi);line(selectionGroup,[[...xy,0],[...xy,current.phi]],'#ffd166',.5)}
function refreshSlice(){disposeGroup(sliceGroup);sliceGroup.visible=$('slice-visible').checked;const counts=new Uint32Array(data.pixel_boundaries.length);for(const e of events)if(e.sourceId===activeSource.id&&Math.abs(radToDeg(e.phi)-sliceCenter)<10)counts[healpixRingIndex(e.a,nside)]++;
 const max=Math.max(1,...counts);for(let i=0;i<counts.length;i++)if(counts[i]){const weight=Math.log1p(counts[i])/Math.log1p(max),color=new THREE.Color('#9b431e').lerp(new THREE.Color('#ff9a45'),weight);if(projection==='standard'){const q=normalize(data.pixel_boundaries[i].reduce((a,b)=>a.map((x,j)=>x+b[j]),[0,0,0])),xy=projectDirection(q,activeSource.basis,projection);if(!xy)continue;const disk=new THREE.Mesh(new THREE.CircleGeometry(.045+.065*weight,12),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));disk.position.set(...xy,degToRad(sliceCenter));sliceGroup.add(disk)}else for(const poly of projectMollweidePixel(data.pixel_boundaries[i],activeSource.basis)){const mesh=new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(poly.map(p=>new THREE.Vector2(...p)))),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));mesh.position.z=degToRad(sliceCenter);sliceGroup.add(mesh)}}
 $('slice-label').textContent=sliceCenter+'°';$('slice-detail').textContent=text(projection==='standard'?'sliceStandard':'sliceMollweide');typesetMath($('slice-detail'));
}
function updateGroups(){const select=$('source-group');select.replaceChildren();for(const group of groups.values()){const option=document.createElement('option');option.value=group.key;const n=events.filter(e=>e.sourceId===group.id).length;option.textContent=`${text('source')} ${group.number} · χ₀ ${group.chi}° · ψ₀ ${group.psi}° · ${n}`;select.append(option)}select.value=activeSource.key}
function updateCounts(){const n=events.filter(e=>e.sourceId===activeSource.id).length;$('event-total').textContent=`${text('total')} ${n} / ${events.length} ${text('events')}`;$('source-status').textContent=`${text('nextEnergy')}: ${energyLabel(energy)} keV · ${text('source')} ${activeSource.number}`;
 const slider=$('event-history');slider.disabled=visibleEvents.length===0||batchBusy;slider.max=Math.max(0,visibleEvents.length-1);const selection=visibleEvents.findIndex(e=>e.id===current?.id);slider.value=selection<0?Math.max(0,visibleEvents.length-1):selection;$('history-label').textContent=selection<0?(visibleEvents.length?`${visibleEvents.length} ${text('events')}`:text('noEvents')):`${selection+1} / ${visibleEvents.length}`;
 $('history-detail').textContent=current&&stage>=6?`${text('event')} #${current.id} · ${text('source')} ${[...groups.values()].find(g=>g.id===current.sourceId)?.number??'—'} · E = ${energyLabel(current.energy)} keV · ϕ = ${angle(current.phi)}`:(visibleEvents.length?`${visibleEvents.length} ${text('events')}`:text('noEvents'));if(singularOmitted)$('history-detail').textContent+=` · ${text('singularOmitted')}: ${singularOmitted}`;updateGroups();
}
function updateCard(){$('physical-angle').textContent=current&&stage>=4?`ϕ = ${angle(current.phi)}`:'ϕ = —';const show=current&&stage>=5,card=$('event-card');card.classList.toggle('pending',!show);card.classList.toggle('highlight',!!show&&stage===5);$('event-id').textContent=show?`${text('event')} #${current.id}`:text('awaiting');
 for(const [id,value]of [['card-energy',show?energyLabel(current.energy)+'\u00a0keV':'—'],['card-phi',show?angle(current.phi):'—'],['card-chi',show?angle(current.anglesK.chi):'—'],['card-psi',show?angle(current.anglesK.psi):'—']])$(id).textContent=value;
 $('deposits').textContent=show?`r₁: E₁ = ${energyLabel(current.e1)}\u00a0keV\nr₂: E₂ = ${energyLabel(current.e2)}\u00a0keV`:'—';$('deposits').title=show?`${text('firstDeposit')} / ${text('secondDeposit')}`:'';$('axis-coordinates').textContent=show?`${text('cdsCoordinates')}\nχₐ = ${angle(current.anglesA.chi)}\nψₐ = ${angle(current.anglesA.psi)}`:'—';
}
function updateAngleLegend(){$('angle-mode').disabled=!anglesVisible();if(!angleView)return;for(const guide of angleView.selected){if(guide.name==='phi')continue;const key=document.createElement('span');key.className='angle-key';key.style.color=guide.color;key.innerHTML=mathHTML(guide.tex);$('physical-angle').append(key)}}
function updateSourceContext(){const warning=$('source-context');const mismatch=current&&current.sourceId!==activeSource.id;warning.hidden=!mismatch;if(mismatch){const eventGroup=[...groups.values()].find(g=>g.id===current.sourceId);warning.textContent=text('sourceContext').replace('{event}',eventGroup?.number??'?').replace('{center}',activeSource.number)}else warning.textContent=''}
let layoutScheduled=false;
function schedulePresentationLayout(){if(layoutScheduled)return;layoutScheduled=true;requestAnimationFrame(()=>{layoutScheduled=false;const root=document.documentElement;if(!document.body.classList.contains('presentation')||innerWidth<=800){root.style.removeProperty('--presentation-view-height');return}const gallery=document.querySelector('.gallery'),top=gallery.getBoundingClientRect().top+scrollY;const footer=Math.max(...[...document.querySelectorAll('.panel')].map(panel=>['.panel-heading','.scene-tools','.legend'].reduce((sum,selector)=>sum+panel.querySelector(selector).getBoundingClientRect().height,0)));const height=Math.max(180,Math.min(520,innerHeight-top-footer-14));root.style.setProperty('--presentation-view-height',height+'px')})}
window.addEventListener('resize',schedulePresentationLayout);
document.addEventListener('toggle',schedulePresentationLayout,true);
function updateFlow(){const container=$('steps');container.replaceChildren();messages[language].steps.forEach((name,i)=>{const element=document.createElement('span');element.className='step'+(i===stage?' active':i<stage?' done':'');element.textContent=`${i}. ${name}`;container.append(element)});$('stage-description').textContent=notice||messages[language].descriptions[stage];$('next').textContent=text(stage===6?'newEvent':'next');$('auto').textContent=text(auto?'pause':'auto');$('next').disabled=!!transition||batchBusy;$('replay').disabled=!current||!!transition||batchBusy;$('apply-settings').disabled=!!transition||batchBusy;$('source-group').disabled=!!transition||batchBusy;$('event-history').disabled=!visibleEvents.length||!!transition||batchBusy;$('batch').textContent=text(batchBusy?'cancelBatch':'batch');$('batch-status').textContent=batchBusy?`${text('batchProgress')} ${batchAdded} / 1000`:'';updateCard();updateAngleLegend();updateCounts();updateSourceContext();typesetMath();schedulePresentationLayout()}
function translate(){document.documentElement.lang=language==='zh'?'zh-CN':'en';document.querySelectorAll('[data-t]').forEach(el=>el.textContent=text(el.dataset.t));$('language').textContent=language==='zh'?'English':'中文';$('projection-info').textContent=text(projection==='standard'?'standardCompact':'mollweideCompact');$('cds-title').textContent=text(projection==='standard'?'standardTitle':'mollweideTitle');updateFlow();refreshSlice()}
function pointOnScreen(view,q){const position=vector(q).project(view.camera),rect=view.renderer.domElement.getBoundingClientRect();return[rect.left+(position.x+1)*rect.width/2,rect.top+(1-position.y)*rect.height/2]}
function cardCenter(){const rect=$('event-card').querySelector('.event-orb').getBoundingClientRect();return[rect.left+rect.width/2,rect.top+rect.height/2]}
function animateStage(){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;transition={stage,start:performance.now(),duration:reduced?100:stage===1?1000:stage===3?850:stage>=5?750:550};updateFlow()}
function commit(){if(current&&!events.some(e=>e.id===current.id)){events.push(current);refreshCloud()}}
function next(){if(transition||batchBusy)return;notice='';if(stage===0||stage===6){current=create();stage=1}else stage++;if(stage===6)commit();drawPhysical();refreshSelection();animateStage()}
function resetPending(){transition=null;$('transfer-token').style.display='none';photon.visible=false;current=null;stage=0;drawPhysical();refreshSelection();updateFlow()}
function applySettings(){if(batchBusy||transition)return;const newEnergy=Number($('energy').value),chi=Number($('source-chi').value),psi=Number($('source-psi').value);if(!Number.isFinite(newEnergy)||newEnergy<10||newEnergy>10000||!Number.isFinite(chi)||chi<0||chi>180||!Number.isFinite(psi)||psi<0||psi>360){notice=text('invalid');updateFlow();return}energy=newEnergy;activeSource=getSource(chi,psi%360);auto=false;resetPending();notice=text('settingsApplied');$('settings').open=false;rebuildMap();refreshCloud();translate()}
async function addBatch(){if(batchBusy){batchCancel=true;return}auto=false;batchBusy=true;batchCancel=false;batchAdded=0;notice=current&&stage>0&&stage<6?text('batchPending'):'';const configuration={energy,source:activeSource.direction.slice(),sourceId:activeSource.id};updateFlow();
 while(batchAdded<1000&&!batchCancel){for(let j=0;j<50&&batchAdded<1000;j++){events.push(createEvent({id:++eventCounter,...configuration,rng}));batchAdded++}refreshCloud();updateFlow();await new Promise(resolve=>requestAnimationFrame(resolve))}
 batchBusy=false;if(notice!==text('clearDone'))notice=`${text('completed')} ${batchAdded} ${text('events')}.`+(current&&stage>0&&stage<6?' '+text('batchPending'):'');updateFlow();
}
$('next').onclick=next;$('auto').onclick=()=>{if(batchBusy)return;auto=!auto;notice='';if(auto&&!transition)next();updateFlow()};$('replay').onclick=()=>{if(!current||transition||batchBusy)return;auto=false;stage=1;notice='';drawPhysical();refreshSelection();animateStage()};$('batch').onclick=addBatch;
$('clear').onclick=()=>{batchCancel=true;auto=false;events=[];resetPending();notice=text('clearDone');refreshCloud();updateFlow()};
$('apply-settings').onclick=applySettings;for(const id of ['energy','source-chi','source-psi'])$(id).addEventListener('keydown',e=>{if(e.key==='Enter')applySettings()});
$('source-group').onchange=()=>{auto=false;activeSource=groups.get($('source-group').value);$('settings').open=false;$('source-chi').value=activeSource.chi;$('source-psi').value=activeSource.psi;resetPending();notice=text('sourceChanged');rebuildMap();refreshCloud();updateFlow()};
$('angles-visible').onchange=()=>{drawPhysical();updateFlow()};$('angle-mode').onchange=()=>{drawPhysical();updateFlow()};
$('projection').onchange=()=>{projection=$('projection').value;rebuildMap();refreshCloud();translate()};$('show-others').onchange=()=>{refreshCloud();updateFlow()};$('slice').oninput=()=>{sliceCenter=Number($('slice').value);refreshSlice()};$('slice-visible').onchange=()=>sliceGroup.visible=$('slice-visible').checked;$('theory-visible').onchange=()=>{if(theoryGroup)theoryGroup.visible=$('theory-visible').checked};
$('event-history').oninput=()=>{if(transition||batchBusy)return;auto=false;current=visibleEvents[Number($('event-history').value)];if(!current)return;stage=6;notice='';drawPhysical();refreshSelection();updateFlow()};
$('language').onclick=()=>{language=language==='zh'?'en':'zh';notice='';try{localStorage.setItem('compton-language',language)}catch{}translate()};
$('presentation').onclick=()=>{document.body.classList.toggle('presentation');schedulePresentationLayout()};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()};
for(const [name,scene]of [['left',left],['right',right]]){$('reset-'+name).onclick=()=>{scene.reset();$('camera-'+name).value='orbit'};$('camera-'+name).onchange=()=>scene.setMode($('camera-'+name).value)}
let last=performance.now(),autoWait=0;
function frame(now){const dt=Math.min(.08,(now-last)/1000);last=now;let progress=1;
 if(transition){progress=Math.min(1,(now-transition.start)/transition.duration);const e=current;
 if(stage===1){photon.visible=true;photon.position.copy(vector(add(e.r1,scale(e.source,2.35*(1-progress)))))}else if(stage===3){photon.visible=true;photon.position.copy(vector(e.r1).lerp(vector(e.r2),progress));if(secondMarker)secondMarker.visible=progress>.95}else photon.visible=false;
 if(stage===4&&coneMesh)coneMesh.material.opacity=coneOpacity()*progress;
 const token=$('transfer-token');if(stage===5||stage===6){const xy=projectDirection(e.a,activeSource.basis,projection);const start=stage===5?pointOnScreen(left,e.r1):cardCenter(),end=stage===5?cardCenter():xy?pointOnScreen(right,[...xy,e.phi]):cardCenter(),t=progress*progress*(3-2*progress);token.style.display='block';token.style.left=(start[0]+(end[0]-start[0])*t)+'px';token.style.top=(start[1]+(end[1]-start[1])*t-40*Math.sin(Math.PI*t))+'px'}else token.style.display='none';
 if(progress>=1){transition=null;photon.visible=false;token.style.display='none';autoWait=now+800;updateFlow()}
 }else if(auto&&!batchBusy&&now>=autoWait){next()}
 physical.traverse(o=>{if(o.userData.billboard)o.quaternion.copy(left.camera.quaternion)});left.frame(dt);right.frame(dt);requestAnimationFrame(frame)
}
rebuildMap();drawPhysical();refreshCloud();translate();requestAnimationFrame(frame);
Promise.all([document.fonts.load('32px KaTeX_Main'),document.fonts.load('italic 32px KaTeX_Math')]).then(()=>{rebuildMap();drawPhysical();schedulePresentationLayout()});
// Read-only snapshots and the same user actions support reproducible acceptance checks.
window.__COMPTON_RECONSTRUCTION__={state:()=>({language,energy,source:activeSource.direction.slice(),sourceId:activeSource.id,projection,stage,localAxesOrigin:eventAxes.position.toArray(),hitPoint:firstMarker?.position.toArray()??null,hitVisible:firstMarker?.visible??false,coneApex:currentConeGroup?.position.toArray()??null,anglesVisible:anglesVisible(),angleMode:$('angle-mode').value,angleGuides:angleView?angleView.objects.map(({guide,line})=>{const a=line.geometry.attributes.instanceStart,b=line.geometry.attributes.instanceEnd,last=b.count-1;return{name:guide.name,value:guide.value,radius:guide.radius,origin:angleGroup.position.toArray(),start:[a.getX(0),a.getY(0),a.getZ(0)],end:[b.getX(last),b.getY(last),b.getZ(last)]}}):[],axisLabelAnchors:left.annotations.filter(a=>a.kind!=='angle').map(a=>({axis:a.el.dataset.axis,position:a.position.toArray()})),animating:!!transition,auto,batchBusy,count:events.length,current:current?structuredClone(current):null,groups:[...groups.values()].map(g=>({id:g.id,chi:g.chi,psi:g.psi,count:events.filter(e=>e.sourceId===g.id).length})),visible:visibleEvents.length,renderedPoints:cloudGeometry.attributes.position?.count??0,selectedPoint:selectionGroup.children.find(o=>o.isMesh)?.position.toArray()??null,leftMode:left.mode,rightMode:right.mode,leftCamera:left.camera.position.toArray(),rightCamera:right.camera.position.toArray(),errors:events.reduce((worst,e)=>{const error=eventErrors(e);return{energy:Math.max(worst.energy,error.energy),angle:Math.max(worst.angle,error.angle),direction:Math.max(worst.direction,error.direction)}},{energy:0,angle:0,direction:0}),coneError:projection==='standard'?Math.max(0,...events.filter(e=>e.sourceId===activeSource.id).map(e=>{const xy=projectDirection(e.a,activeSource.basis,projection);return xy?Math.abs(Math.hypot(...xy)-e.phi):0})):null}),events:()=>structuredClone(events),next,addBatch};
