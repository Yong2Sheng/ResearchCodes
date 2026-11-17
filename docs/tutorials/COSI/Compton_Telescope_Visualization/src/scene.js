/**
 * Three.js rendering layer for the real-space Compton geometry.
 *
 * Rendering coordinates are a right-handed z-up presentation frame:
 *   render = (x_phys, z_phys, -y_phys)
 * so Three.js world +Y is physical +z. All physics is computed in the plain
 * arrays from physics.js, and converted only at this boundary.
 */

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {
  anglesFromDirection,
  coneAxisDirection,
  degToRad,
  directionFromAngles,
  makeSourceBasis,
  scale,
} from './physics.js';
import {
  makeDirectionAngleAids,
  makeEventConeData,
  makePhiAngleArc,
  makeTheoreticalOrbit,
} from './geometry.js';

const COLORS = {
  source: 0xffd166,
  sourceAxis: 0x3ddc97,
  eventCone: 0xff5e68,
  eventCircle: 0xff626c,
  axisA: 0xff7b73,
  historyA: 0x55aaff,
  theory: 0x4d89bd,
  k: 0x5de0e6,
  incoming: 0xffb45e,
  phi: 0xffd27a,
  chi: 0xc8a8ff,
  psi: 0xf6ac72,
  bMarker: 0xa8b8c8,
  xAxis: 0xe39a7a,
  yAxis: 0x8fcf9e,
  zAxis: 0x86b7ef,
  grid: 0x81a9c5,
  origin: 0xf2f7fb,
};

const GRID_LAT_STEP_DEG = 15;
const GRID_LON_STEP_DEG = 30;

function toWorld(vector, radius = 1) {
  return new THREE.Vector3(vector[0] * radius, vector[2] * radius, -vector[1] * radius);
}

function toWorldArray(points, radius = 1) {
  return points.map((point) => toWorld(point, radius));
}

function flattenPoints(points) {
  const flat = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i += 1) {
    flat[i * 3] = points[i].x;
    flat[i * 3 + 1] = points[i].y;
    flat[i * 3 + 2] = points[i].z;
  }
  return flat;
}

function makeRadialTexture({ inner, outer, core = '#ffffff', ring = true }) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 60);
  gradient.addColorStop(0, core);
  gradient.addColorStop(0.18, inner);
  gradient.addColorStop(0.52, outer);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(64, 64, 60, 0, Math.PI * 2);
  context.fill();
  if (ring) {
    context.strokeStyle = 'rgba(255,255,255,0.88)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(64, 64, 35, 0, Math.PI * 2);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeEventPointTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(64, 64, 28, 64, 64, 60);
  glow.addColorStop(0, 'rgba(255,98,108,0)');
  glow.addColorStop(0.7, 'rgba(255,98,108,0.13)');
  glow.addColorStop(1, 'rgba(255,98,108,0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(64, 64, 60, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,112,120,0.95)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(64, 64, 36, 0, Math.PI * 2);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeStarTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(128, 128, 3, 128, 128, 118);
  glow.addColorStop(0, 'rgba(255,225,140,0.38)');
  glow.addColorStop(0.38, 'rgba(255,199,86,0.12)');
  glow.addColorStop(1, 'rgba(255,193,70,0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(128, 128, 118, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.translate(128, 128);
  context.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 78 : 31;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  const starGradient = context.createLinearGradient(-60, -80, 60, 70);
  starGradient.addColorStop(0, '#fff5c4');
  starGradient.addColorStop(0.5, '#ffd166');
  starGradient.addColorStop(1, '#efad3f');
  context.fillStyle = starGradient;
  context.fill();
  context.strokeStyle = 'rgba(255,245,210,0.95)';
  context.lineWidth = 3;
  context.stroke();
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

class LabelLayer {
  constructor(container) {
    this.container = container;
    this.labels = new Map();
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.panelRects = [];
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  setPanelRects(rects) {
    this.panelRects = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  }

  invalidateMeasurements() {
    for (const label of this.labels.values()) {
      label.width = 0;
      label.height = 0;
    }
  }

  create(id, { html = '', className = '', color = '', offsetX = 0, offsetY = 0 } = {}) {
    const element = document.createElement('div');
    element.className = `scene-label ${className}`.trim();
    element.innerHTML = html;
    if (color) element.style.setProperty('--label-accent', color);
    this.container.appendChild(element);
    const label = {
      element,
      position: new THREE.Vector3(),
      offsetX,
      offsetY,
      visible: true,
      layerVisible: true,
    };
    this.labels.set(id, label);
    return label;
  }

  get(id) {
    return this.labels.get(id);
  }

  setText(id, html) {
    const label = this.labels.get(id);
    if (label) label.element.innerHTML = html;
  }

  setVisible(id, visible) {
    const label = this.labels.get(id);
    if (label) label.visible = visible;
  }

  setLayerVisible(visible) {
    for (const label of this.labels.values()) label.layerVisible = visible;
  }

  update(camera) {
    const width = this.width;
    const height = this.height;
    for (const label of this.labels.values()) {
      if (!label.visible || !label.layerVisible) {
        label.element.style.display = 'none';
        continue;
      }
      const projected = label.position.clone().project(camera);
      const cameraSpace = label.position.clone().applyMatrix4(camera.matrixWorldInverse);
      if (cameraSpace.z > -0.01 || projected.z < -1 || projected.z > 1) {
        label.element.style.display = 'none';
        continue;
      }
      const anchorX = (projected.x * 0.5 + 0.5) * width;
      const anchorY = (-projected.y * 0.5 + 0.5) * height;
      if (anchorX < -80 || anchorX > width + 80 || anchorY < -40 || anchorY > height + 40) {
        label.element.style.display = 'none';
        continue;
      }

      // Do not let DOM labels disappear under the opaque side panels. If the
      // anchor itself is behind a panel, hide the label; otherwise slide the
      // label box just outside the panel while preserving its association.
      let anchorUnderPanel = false;
      for (const panel of this.panelRects) {
        if (
          anchorX > panel.left - 4 &&
          anchorX < panel.right + 4 &&
          anchorY > panel.top - 4 &&
          anchorY < panel.bottom + 4
        ) {
          anchorUnderPanel = true;
          break;
        }
      }
      if (anchorUnderPanel) {
        label.element.style.display = 'none';
        continue;
      }

      label.element.style.display = 'block';
      const labelWidth = label.width || label.element.offsetWidth || 96;
      const labelHeight = label.height || label.element.offsetHeight || 22;
      label.width = labelWidth;
      label.height = labelHeight;
      let x = anchorX + label.offsetX;
      let y = anchorY + label.offsetY;
      y = Math.min(height - labelHeight / 2 - 8, Math.max(labelHeight / 2 + 8, y));

      for (const panel of this.panelRects) {
        if (y + labelHeight / 2 < panel.top || y - labelHeight / 2 > panel.bottom) continue;
        if (x + labelWidth / 2 > panel.left && x - labelWidth / 2 < panel.right) {
          if (x < panel.left + panel.width / 2) {
            x = panel.left - labelWidth / 2 - 10;
          } else {
            x = panel.right + labelWidth / 2 + 10;
          }
        }
      }
      x = Math.min(width - labelWidth / 2 - 8, Math.max(labelWidth / 2 + 8, x));
      label.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    this.resolveCollisions();
  }

  resolveCollisions() {
    const width = this.width;
    const height = this.height;
    const margin = 6;
    const entries = [];
    for (const label of this.labels.values()) {
      if (!label.visible || !label.layerVisible || label.element.style.display === 'none') continue;
      const box = label.element.getBoundingClientRect();
      entries.push({
        label,
        priority: label.priority ?? 50,
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
        w: box.width,
        h: box.height,
      });
    }
    entries.sort((a, b) => b.priority - a.priority);
    const placed = [];
    const makRect = (x, y, w, h) => ({ left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 });
    const intersects = (a, b) =>
      a.left < b.right + 4 && a.right + 4 > b.left && a.top < b.bottom + 4 && a.bottom + 4 > b.top;
    const fits = (x, y, w, h) => {
      const rect = makRect(x, y, w, h);
      if (rect.left < margin || rect.right > width - margin || rect.top < margin || rect.bottom > height - margin) return false;
      for (const panel of this.panelRects) if (intersects(rect, panel)) return false;
      for (const other of placed) if (intersects(rect, other)) return false;
      return true;
    };

    for (const entry of entries) {
      let chosen = null;
      if (fits(entry.x, entry.y, entry.w, entry.h)) {
        chosen = { x: entry.x, y: entry.y };
      } else {
        const shifts = [];
        for (const vdir of [-1, 1]) {
          for (let step = 1; step <= 2; step += 1) {
            shifts.push([0, vdir * (entry.h + 7) * step]);
            for (const hdir of [-1, 1]) shifts.push([hdir * (entry.w + 9), vdir * (entry.h + 7) * step]);
          }
        }
        for (const hdir of [-1, 1]) {
          for (let step = 1; step <= 2; step += 1) shifts.push([hdir * (entry.w + 9) * step, 0]);
        }
        for (const [dx, dy] of shifts) {
          const x = Math.min(width - entry.w / 2 - margin, Math.max(entry.w / 2 + margin, entry.x + dx));
          const y = Math.min(height - entry.h / 2 - margin, Math.max(entry.h / 2 + margin, entry.y + dy));
          if (fits(x, y, entry.w, entry.h)) {
            chosen = { x, y };
            break;
          }
        }
      }
      if (!chosen) chosen = { x: entry.x, y: entry.y };
      placed.push(makRect(chosen.x, chosen.y, entry.w, entry.h));
      entry.label.element.style.transform = `translate(${chosen.x}px, ${chosen.y}px) translate(-50%, -50%)`;
    }
  }
}

/**
 * A visible vector arrow made from a fat line and a real 3D cone head.
 * Used for k, n_in and the coordinate axes.
 */
class VectorArrow {
  constructor(scene, {
    color,
    lineWidth = 1.8,
    headLength = 0.12,
    headRadius = 0.045,
    opacity = 1,
    depthTest = false,
    dashed = false,
    lineFactory,
  }) {
    this.scene = scene;
    this.color = color;
    this.headLength = headLength;
    this.headRadius = headRadius;
    this.line = lineFactory({
      color,
      width: lineWidth,
      opacity,
      depthTest,
      dashed,
    });
    scene.add(this.line);
    this.headMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.head = new THREE.Mesh(
      new THREE.ConeGeometry(headRadius, headLength, 24, 1, false),
      this.headMaterial,
    );
    this.head.renderOrder = 16;
    scene.add(this.head);
    this.up = new THREE.Vector3(0, 1, 0);
    this._lineFactoryUpdate = lineFactory;
  }

  setVisible(visible) {
    this.line.visible = visible;
    this.head.visible = visible;
  }

  setPoints(start, end, sceneUpdater) {
    const delta = end.clone().sub(start);
    const distance = delta.length();
    if (distance < 1e-6) {
      this.setVisible(false);
      return;
    }
    const direction = delta.clone().normalize();
    const headLength = Math.min(this.headLength, distance * 0.42);
    const headStart = end.clone().addScaledVector(direction, -headLength);
    this.line.position.set(0, 0, 0);
    sceneUpdater(this.line, [start, headStart]);
    this.head.position.copy(end).addScaledVector(direction, -headLength * 0.5);
    this.head.quaternion.setFromUnitVectors(this.up, direction);
    this.head.scale.setScalar(1);
    this.head.updateMatrixWorld();
  }
}

export class ComptonScene {
  constructor(container, {
    sourceChiDeg = 145,
    sourcePsiDeg = 35,
    R = 1.6,
    ringSegments = 192,
    homePosition = new THREE.Vector3(5.2, 2.15, 2.35),
    homeTarget = new THREE.Vector3(0, 0.05, 0),
  } = {}) {
    this.container = container;
    this.R = R;
    this.ringSegments = ringSegments;
    this.sourceChiDeg = sourceChiDeg;
    this.sourcePsiDeg = sourcePsiDeg;
    this.sourceChi = degToRad(sourceChiDeg);
    this.sourcePsi = degToRad(sourcePsiDeg);
    this.basis = makeSourceBasis(directionFromAngles(this.sourceChi, this.sourcePsi));
    this.homePosition = homePosition;
    this.homeTarget = homeTarget;
    this._lineMaterials = new Set();
    this._historyLines = new Map();
    this._historySegmentsRef = [];
    this._historyVisible = true;
    this._angleAidsVisible = true;
    this._theoryVisible = false;
    this._bVisible = false;
    this._currentPhi = null;
    this._currentBeta = null;
    this._lastTheoryPhi = null;
    this._disposed = false;

    this._createRenderer();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.03, 120);
    this.camera.position.copy(homePosition);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(homeTarget);

    this.labelLayer = new LabelLayer(container.querySelector('#scene-labels'));
    this._buildSky();
    this._buildCoordinateAxes();
    this._buildSourceAndOrigin();
    this._buildDirectionVectors();
    this._buildEventCone();
    this._buildAxisTrackMarkers();
    this._buildAngleAids();
    this._buildTheoryTrack();
    this._buildLabels();

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(container);
    this.resize();
  }

  _createRenderer() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
    } catch (error) {
      throw new Error(`WebGL 渲染器创建失败：${error.message || error}`);
    }
    if (!renderer || !renderer.getContext()) {
      throw new Error('当前浏览器不能创建 WebGL 上下文。');
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'webgl-canvas';
    renderer.domElement.setAttribute('aria-label', 'Compton event cone 三维几何场景');
    renderer.domElement.tabIndex = 0;
    this.container.prepend(renderer.domElement);
    this.renderer = renderer;
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      if (typeof window.__showComptonFatal === 'function') {
        window.__showComptonFatal('WebGL 上下文已丢失。请重新加载页面；若反复出现，请检查浏览器硬件加速设置。');
      }
    });
  }

  get domElement() {
    return this.renderer.domElement;
  }

  _makeLineMaterial({ color, width, opacity = 1, depthTest = false, dashed = false }) {
    const material = new LineMaterial({
      color,
      linewidth: width,
      transparent: opacity < 1,
      opacity,
      depthTest,
      depthWrite: false,
      worldUnits: false,
      dashed,
    });
    if (dashed) {
      material.dashSize = 0.055;
      material.gapSize = 0.04;
      material.dashScale = 1;
    }
    material.toneMapped = false;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    material.resolution.set(size.x, size.y);
    this._lineMaterials.add(material);
    return material;
  }

  _createFatLine({
    color,
    width = 2,
    opacity = 1,
    depthTest = false,
    dashed = false,
    points = [],
    renderOrder = 10,
  }) {
    const material = this._makeLineMaterial({ color, width, opacity, depthTest, dashed });
    const geometry = new LineGeometry();
    geometry.setPositions([0, 0, 0, 0, 0, 0]);
    const line = new Line2(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = renderOrder;
    this.scene.add(line);
    if (points.length >= 2) this._updateFatLine(line, points);
    else line.visible = false;
    return line;
  }

  _updateFatLine(line, points) {
    if (!line || points.length < 2) {
      if (line) line.visible = false;
      return;
    }
    line.visible = true;
    const segmentCount = points.length - 1;
    let geometry = line.geometry;
    let starts = geometry.getAttribute('instanceStart');
    // r160 caches a geometry's maximum instance count on its first render.
    // Replacing its attributes with longer arrays does not reset that limit:
    // growing trails then keep drawing only their initial few segments.
    // Grow by replacing/disposal of the geometry; otherwise reuse the buffers.
    if (!starts || starts.count < segmentCount) {
      const capacity = 2 ** Math.ceil(Math.log2(segmentCount));
      const replacement = new LineGeometry();
      replacement.setPositions(new Float32Array((capacity + 1) * 3));
      line.geometry = replacement;
      geometry.dispose();
      geometry = replacement;
      starts = geometry.getAttribute('instanceStart');
    }
    const ends = geometry.getAttribute('instanceEnd');
    for (let i = 0; i < segmentCount; i += 1) {
      const start = points[i];
      const end = points[i + 1];
      starts.setXYZ(i, start.x, start.y, start.z);
      ends.setXYZ(i, end.x, end.y, end.z);
    }
    starts.data.needsUpdate = true;
    geometry.instanceCount = segmentCount;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    if (line.material.dashed) line.computeLineDistances();
  }

  _makeSprite(texture, color, scale, depthTest = false) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      depthTest,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = 30;
    return sprite;
  }

  _buildSky() {
    this.skyGroup = new THREE.Group();
    this.skyGroup.name = 'sky-direction-sphere';
    this.scene.add(this.skyGroup);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(this.R * 0.998, 64, 48),
      new THREE.MeshBasicMaterial({
        color: 0x3b7594,
        transparent: true,
        opacity: 0.032,
        side: THREE.FrontSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    sphere.renderOrder = 0;
    this.skyGroup.add(sphere);

    const segments = [];
    const latCount = 160;
    for (let lat = GRID_LAT_STEP_DEG; lat < 180; lat += GRID_LAT_STEP_DEG) {
      const chi = degToRad(lat);
      let previous = null;
      for (let i = 0; i <= latCount; i += 1) {
        const psi = (i / latCount) * Math.PI * 2;
        const point = toWorld(directionFromAngles(chi, psi), this.R);
        if (previous) {
          segments.push(previous.x, previous.y, previous.z, point.x, point.y, point.z);
        }
        previous = point;
      }
    }
    const lonCount = 240;
    for (let lon = 0; lon < 360; lon += GRID_LON_STEP_DEG) {
      const psi = degToRad(lon);
      let previous = null;
      for (let i = 0; i <= lonCount; i += 1) {
        const chi = (i / lonCount) * Math.PI;
        const point = toWorld(directionFromAngles(chi, psi), this.R);
        if (previous) {
          segments.push(previous.x, previous.y, previous.z, point.x, point.y, point.z);
        }
        previous = point;
      }
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    const grid = new THREE.LineSegments(
      gridGeometry,
      new THREE.LineBasicMaterial({
        color: COLORS.grid,
        transparent: true,
        opacity: 0.23,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      }),
    );
    grid.renderOrder = 1;
    this.skyGroup.add(grid);

    // A slightly brighter great-circle equator.
    const equatorPoints = [];
    for (let i = 0; i <= 240; i += 1) {
      equatorPoints.push(toWorld(directionFromAngles(Math.PI / 2, (i / 240) * Math.PI * 2), this.R));
    }
    const equatorMaterial = new THREE.LineBasicMaterial({
      color: COLORS.grid,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      toneMapped: false,
    });
    const equatorGeometry = new THREE.BufferGeometry().setFromPoints(equatorPoints);
    const equator = new THREE.Line(equatorGeometry, equatorMaterial);
    equator.renderOrder = 2;
    this.skyGroup.add(equator);
  }

  _buildCoordinateAxes() {
    this.axesGroup = new THREE.Group();
    this.axesGroup.name = 'physical-axes';
    this.scene.add(this.axesGroup);
    const axes = [
      { dir: [1, 0, 0], color: COLORS.xAxis, label: 'x' },
      { dir: [0, 1, 0], color: COLORS.yAxis, label: 'y' },
      { dir: [0, 0, 1], color: COLORS.zAxis, label: 'z' },
    ];
    this.axisLabelPositions = {};
    for (const item of axes) {
      const start = new THREE.Vector3(0, 0, 0);
      const end = toWorld(item.dir, this.R * 1.035);
      const line = this._createFatLine({
        color: item.color,
        width: 1.3,
        opacity: 0.72,
        points: [start, end.clone().multiplyScalar(0.94)],
        renderOrder: 5,
      });
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(this.R * 0.025, this.R * 0.09, 18),
        new THREE.MeshBasicMaterial({
          color: item.color,
          transparent: true,
          opacity: 0.9,
          depthTest: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      head.position.copy(end);
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().normalize());
      head.renderOrder = 6;
      this.axesGroup.add(line, head);
      this.axisLabelPositions[item.label] = end.clone().multiplyScalar(1.012);
    }

    // χ = 0 reference direction (-z), shown faintly as a dashed guide.
    this.negativeZGuide = this._createFatLine({
      color: COLORS.chi,
      width: 1.2,
      opacity: 0.38,
      dashed: true,
      points: [new THREE.Vector3(0, 0, 0), toWorld([0, 0, -1], this.R * 0.86)],
      renderOrder: 4,
    });
  }

  _buildSourceAndOrigin() {
    const sourceDir = this.basis.s0;
    const sourceWorld = toWorld(sourceDir, this.R);
    this.sourcePosition = sourceWorld;

    this.sourceAxisLine = this._createFatLine({
      color: COLORS.sourceAxis,
      width: 3.0,
      opacity: 0.94,
      points: [new THREE.Vector3(0, 0, 0), sourceWorld.clone().multiplyScalar(1.13)],
      renderOrder: 8,
    });
    // A faint extension makes the fixed rotation axis read as an axis.
    this.sourceAxisExtension = this._createFatLine({
      color: COLORS.sourceAxis,
      width: 1.4,
      opacity: 0.28,
      points: [sourceWorld.clone().multiplyScalar(1.13), sourceWorld.clone().multiplyScalar(1.25)],
      renderOrder: 7,
    });

    this.originMarker = new THREE.Mesh(
      new THREE.SphereGeometry(this.R * 0.025, 20, 16),
      new THREE.MeshBasicMaterial({
        color: COLORS.origin,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.originMarker.renderOrder = 29;
    this.scene.add(this.originMarker);

    this.sourceStar = this._makeSprite(makeStarTexture(), 0xffffff, this.R * 0.23, false);
    this.sourceStar.position.copy(sourceWorld);
    this.scene.add(this.sourceStar);

    this.incomingArrow = new VectorArrow(this.scene, {
      color: COLORS.incoming,
      lineWidth: 2.7,
      headLength: this.R * 0.1,
      headRadius: this.R * 0.038,
      opacity: 0.93,
      depthTest: false,
      dashed: false,
      lineFactory: (options) => this._createFatLine({ ...options, renderOrder: 13 }),
    });
    const incomingStart = toWorld(scale(sourceDir, 0.62), this.R);
    const incomingEnd = toWorld(scale(sourceDir, 0.2), this.R);
    this.incomingArrow.setPoints(incomingStart, incomingEnd, this._updateFatLine.bind(this));
    this.incomingArrowLabelPosition = toWorld(scale(sourceDir, 0.4), this.R);
  }

  _buildDirectionVectors() {
    this.kArrow = new VectorArrow(this.scene, {
      color: COLORS.k,
      lineWidth: 2.6,
      headLength: this.R * 0.1,
      headRadius: this.R * 0.037,
      opacity: 0.98,
      depthTest: false,
      lineFactory: (options) => this._createFatLine({ ...options, renderOrder: 14 }),
    });
    this.aAxisLine = this._createFatLine({
      color: 0xff9d96,
      width: 1.7,
      opacity: 0.9,
      depthTest: false,
      points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)],
      renderOrder: 14,
    });
    this.aAxisLine.visible = false;
  }

  _buildEventCone() {
    this.coneGroup = new THREE.Group();
    this.coneGroup.name = 'real-event-cone';
    this.scene.add(this.coneGroup);

    const vertexCount = this.ringSegments + 1;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3),
    );
    const indices = [];
    for (let i = 0; i < this.ringSegments; i += 1) {
      indices.push(0, 1 + i, 1 + ((i + 1) % this.ringSegments));
    }
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    geometry.computeVertexNormals();
    this.coneGeometry = geometry;
    this.coneMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7580,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      blending: THREE.NormalBlending,
    });
    this.coneMesh = new THREE.Mesh(geometry, this.coneMaterial);
    this.coneMesh.frustumCulled = false;
    this.coneMesh.renderOrder = 3;
    this.coneGroup.add(this.coneMesh);

    const genericCount = 12;
    const genGeometry = new THREE.BufferGeometry();
    genGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(genericCount * 2 * 3), 3),
    );
    this.generatrixGeometry = genGeometry;
    this.generatrixLines = new THREE.LineSegments(
      genGeometry,
      new THREE.LineBasicMaterial({
        color: COLORS.eventCone,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      }),
    );
    this.generatrixLines.frustumCulled = false;
    this.generatrixLines.renderOrder = 4;
    this.coneGroup.add(this.generatrixLines);

    this.eventCircleHalo = this._createFatLine({
      color: COLORS.eventCircle,
      width: 10.5,
      opacity: 0.075,
      depthTest: false,
      points: [],
      renderOrder: 8,
    });
    this.eventCircleLine = this._createFatLine({
      color: COLORS.eventCircle,
      width: 3.1,
      opacity: 1,
      depthTest: false,
      points: [],
      renderOrder: 15,
    });
    this.degenerateRayLine = this._createFatLine({
      color: COLORS.eventCircle,
      width: 4.2,
      opacity: 0.55,
      depthTest: false,
      points: [new THREE.Vector3(0, 0, 0), toWorld(this.basis.s0, this.R)],
      renderOrder: 12,
    });
    this.degenerateRayLine.visible = false;
  }

  _buildAxisTrackMarkers() {
    this.axisTrackLimitMaterials = [];
    this.aMarkerTexture = makeRadialTexture({
      inner: 'rgba(104,191,255,0.98)',
      outer: 'rgba(41,117,202,0.18)',
      core: '#eef9ff',
      ring: true,
    });
    this.aMarker = this._makeSprite(this.aMarkerTexture, 0xffffff, this.R * 0.155, false);
    this.scene.add(this.aMarker);

    this.bMarkerTexture = makeRadialTexture({
      inner: 'rgba(190,202,214,0.95)',
      outer: 'rgba(130,150,170,0.26)',
      core: '#f5f8fa',
      ring: true,
    });
    this.bMarker = this._makeSprite(this.bMarkerTexture, 0xffffff, this.R * 0.105, false);
    this.bMarker.visible = false;
    this.scene.add(this.bMarker);

    this.bGuideLine = this._createFatLine({
      color: COLORS.bMarker,
      width: 1.2,
      opacity: 0.62,
      dashed: false,
      points: [],
      renderOrder: 12,
    });
    this.bGuideLine.visible = false;
  }

  _buildAngleAids() {
    this.angleAidsGroup = new THREE.Group();
    this.angleAidsGroup.name = 'angle-aids';
    this.scene.add(this.angleAidsGroup);

    this.phiArc = this._createFatLine({
      color: COLORS.phi,
      width: 2.2,
      opacity: 0.92,
      depthTest: false,
      points: [],
      renderOrder: 16,
    });
    this.chiArc = this._createFatLine({
      color: COLORS.chi,
      width: 1.8,
      opacity: 0.82,
      depthTest: false,
      points: [],
      renderOrder: 15,
    });
    this.psiArc = this._createFatLine({
      color: COLORS.psi,
      width: 1.8,
      opacity: 0.82,
      depthTest: false,
      points: [],
      renderOrder: 15,
    });
    this.angleAidsGroup.add(this.phiArc, this.chiArc, this.psiArc);
    this.psiReferenceRay = this._createFatLine({
      color: COLORS.psi, width: 1.5, opacity: 0.65, points: [], renderOrder: 15,
    });
    this.psiProjectionRay = this._createFatLine({
      color: COLORS.psi, width: 1.8, opacity: 0.9, points: [], renderOrder: 16,
    });
    this.psiProjectionDrop = this._createFatLine({
      color: COLORS.psi, width: 1.5, opacity: 0.8, dashed: true,
      points: [], renderOrder: 15,
    });
    this.psiDirectionHead = new THREE.Mesh(
      new THREE.ConeGeometry(this.R * 0.012, this.R * 0.045, 16),
      new THREE.MeshBasicMaterial({ color: COLORS.psi, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.psiDirectionHead.renderOrder = 17;
    this.psiProjectionMarker = new THREE.Mesh(
      new THREE.SphereGeometry(this.R * 0.014, 12, 8),
      new THREE.MeshBasicMaterial({ color: COLORS.psi, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.psiProjectionMarker.renderOrder = 17;
    this.angleAidsGroup.add(
      this.psiReferenceRay, this.psiProjectionRay, this.psiProjectionDrop,
      this.psiDirectionHead, this.psiProjectionMarker,
    );
    this.negativeZGuide.visible = true;
    this._theoryAvailable = false;
  }

  _buildTheoryTrack() {
    this.theoryMaterial = new THREE.LineBasicMaterial({
      color: 0x69c7ff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.theoryGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0.001),
    ]);
    // Explicit dash segments are used instead of LineDashedMaterial so the
    // theoretical guide renders reliably on all WebGL line implementations.
    this.theoryLine = new THREE.LineSegments(this.theoryGeometry, this.theoryMaterial);
    this.theoryLine.frustumCulled = false;
    this.theoryLine.renderOrder = 11;
    this.theoryLine.visible = false;
    this.scene.add(this.theoryLine);

    this.eventPointSprite = this._makeSprite(makeEventPointTexture(), 0xffffff, this.R * 0.27, false);
    this.eventPointSprite.visible = false;
    this.scene.add(this.eventPointSprite);
  }

  _buildLabels() {
    const labelLayer = this.labelLayer;
    this.labels = {
      origin: labelLayer.create('origin', {
        html: '<span class="label-main">O</span><span class="label-sub">方向原点</span>',
        className: 'label-origin',
        offsetX: -28,
        offsetY: 22,
      }),
      source: labelLayer.create('source', {
        html: '<span class="label-main">S</span><span class="label-sub">固定源</span>',
        className: 'label-source',
        offsetX: 42,
        offsetY: -24,
      }),
      a: labelLayer.create('a', {
        html: '<span class="label-main">A</span><span class="label-sub">反投影轴端点</span>',
        className: 'label-a',
        offsetX: 42,
        offsetY: -24,
      }),
      b: labelLayer.create('b', {
        html: '<span class="label-main">B</span><span class="label-sub">平面圆心</span>',
        className: 'label-b',
        offsetX: 36,
        offsetY: 22,
      }),
      k: labelLayer.create('k', {
        html: '<span class="label-main"><i>k</i></span><span class="label-sub">散射后</span>',
        className: 'label-k',
        offsetX: 30,
        offsetY: -18,
      }),
      incoming: labelLayer.create('incoming', {
        html: '<span class="label-main"><i>n</i><sub>in</sub></span><span class="label-sub">入射 · 射向 O</span>',
        className: 'label-incoming',
        offsetX: 38,
        offsetY: 22,
      }),
      phi: labelLayer.create('phi', {
        html: '<span class="label-main">φ</span>',
        className: 'label-angle label-phi',
        offsetX: 18,
        offsetY: -10,
      }),
      chi: labelLayer.create('chi', {
        html: '<span class="label-main">χ<sub>k</sub></span>',
        className: 'label-angle label-chi',
        offsetX: 18,
        offsetY: -10,
      }),
      psi: labelLayer.create('psi', {
        html: '<span class="label-main">ψ<sub>k</sub></span>',
        className: 'label-angle label-psi',
        offsetX: 18,
        offsetY: -10,
      }),
      psiZero: labelLayer.create('psiZero', {
        html: '<span class="label-main">+y</span><span class="label-sub">ψ = 0°</span>',
        className: 'label-angle label-psi', offsetX: 20, offsetY: 16,
      }),
      kProjection: labelLayer.create('kProjection', {
        html: '<span class="label-main">k<sub>xy</sub></span><span class="label-sub">xy 平面投影</span>',
        className: 'label-angle label-psi', offsetX: 26, offsetY: -20,
      }),
      minusZ: labelLayer.create('minusZ', {
        html: '<span class="label-main">−z</span><span class="label-sub">χ=0</span>',
        className: 'label-axis label-minus-z',
        offsetX: -12,
        offsetY: 16,
      }),
    };
    for (const axis of ['x', 'y', 'z']) {
      this.labels[axis] = labelLayer.create(`axis-${axis}`, {
        html: `<span class="label-main">${axis}</span>`,
        className: `label-axis label-axis-${axis}`,
        offsetX: 10,
        offsetY: -10,
      });
    }
    this.labels.b.visible = false;
    const priorities = {
      source: 100, a: 98, origin: 92, k: 86, incoming: 82, b: 80,
      x: 72, y: 72, z: 72, phi: 60, chi: 58, psi: 58,
      psiZero: 48, kProjection: 44, minusZ: 35,
    };
    for (const [id, label] of Object.entries(this.labels)) {
      if (Number.isFinite(priorities[id])) label.priority = priorities[id];
    }
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    for (const material of this._lineMaterials) {
      material.resolution.set(width, height);
    }
    this.labelLayer.resize(width, height);
    const panelRects = ['.controls-panel', '.readout-panel']
      .map((selector) => document.querySelector(selector))
      .filter((element) => element && getComputedStyle(element).display !== 'none')
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
    this.labelLayer.setPanelRects(panelRects);
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    for (const material of this._lineMaterials) {
      material.resolution.set(size.x, size.y);
    }
  }

  setCameraRig(rig) {
    this.cameraRig = rig;
  }

  invalidateLabelLayout() {
    this.labelLayer.invalidateMeasurements();
  }

  setSkyVisible(visible) {
    this.skyGroup.visible = visible;
  }

  setHistoryVisible(visible) {
    this._historyVisible = visible;
    for (const entry of this._historyLines.values()) entry.line.visible = visible && entry.visible;
  }

  setAngleAidsVisible(visible) {
    this._angleAidsVisible = visible;
    this.angleAidsGroup.visible = visible;
    this.labelLayer.setVisible('phi', visible && this.phiArc.visible);
    this.labelLayer.setVisible('chi', visible && this.chiArc.visible);
    this.labelLayer.setVisible('psi', visible && this.psiArc.visible);
    this.labelLayer.setVisible('psiZero', visible && this.psiProjectionRay.visible);
    this.labelLayer.setVisible('kProjection', visible && this.psiProjectionRay.visible);
    this.labelLayer.setVisible('minusZ', visible);
    this.negativeZGuide.visible = visible;
  }

  setTheoryVisible(visible) {
    this._theoryVisible = visible;
    this.theoryLine.visible = visible && Boolean(this._theoryAvailable);
  }

  setBVisible(visible) {
    this._bVisible = visible;
    this.bMarker.visible = visible;
    this.bGuideLine.visible = visible;
    this.labels.b.visible = visible;
  }

  updateCurrent(phi, beta, { force = false } = {}) {
    if (!Number.isFinite(phi) || !Number.isFinite(beta)) return;
    const phiChanged = this._currentPhi === null || Math.abs(this._currentPhi - phi) > 1e-13;
    this._currentPhi = phi;
    this._currentBeta = beta;
    this.currentData = makeEventConeData(phi, beta, this.basis, this.R, this.ringSegments);
    const data = this.currentData;
    const axisWorld = toWorld(data.frame.axis, this.R);
    const betaWorld = toWorld(data.axisPointA, 1);
    const kWorld = toWorld(data.frame.axis, -this.R);

    this.aMarker.position.copy(betaWorld);
    this.bMarker.position.copy(toWorld(data.centerB, 1));
    this.labels.a.position.copy(betaWorld);
    this.labels.b.position.copy(toWorld(data.centerB, 1));

    this._updateConeGeometry(data);
    this._updateFatLine(this.eventCircleLine, data.circlePositions.map((p) => toWorld(p, 1)));
    this._updateFatLine(this.eventCircleHalo, data.circlePositions.map((p) => toWorld(p, 1)));
    const isRay = data.classification === 'ray';
    this.coneMesh.visible = !isRay;
    this.generatrixLines.visible = !isRay;
    this.degenerateRayLine.visible = isRay;
    this.eventCircleLine.visible = !isRay;
    this.eventCircleHalo.visible = !isRay;
    this.eventPointSprite.visible = isRay;
    this.eventPointSprite.position.copy(this.sourcePosition);

    // Cone axis a and k.
    this._updateFatLine(this.aAxisLine, [
      new THREE.Vector3(0, 0, 0),
      axisWorld.clone().multiplyScalar(0.96),
    ]);
    this.aAxisLine.visible = true;
    const kEnd = kWorld.clone().multiplyScalar(0.8);
    this.kArrow.setPoints(new THREE.Vector3(0, 0, 0), kEnd, this._updateFatLine.bind(this));
    this.labels.k.position.copy(kEnd.clone().multiplyScalar(0.91));
    this.labels.k.visible = true;

    this._updateAngleAids(phi, data.frame.axis);
    this._updateBGuideLine();
    if (phiChanged || this._lastTheoryPhi === null) {
      this._updateTheoryTrack(phi);
      this._lastTheoryPhi = phi;
    }

    this.incomingArrowLabelPosition.copy(toWorld(scale(this.basis.s0, 0.36), this.R));
    this.labels.incoming.position.copy(this.incomingArrowLabelPosition);
    this.labels.origin.position.set(0, 0, 0);
    this.labels.source.position.copy(this.sourcePosition);
    this.labels.axisX = this.labels.x;
    this.labels.x.position.copy(this.axisLabelPositions.x);
    this.labels.y.position.copy(this.axisLabelPositions.y);
    this.labels.z.position.copy(this.axisLabelPositions.z);
    this.labels.minusZ.position.copy(toWorld([0, 0, -1], this.R * 0.9));

    this._lastCurrentState = data;
  }

  _updateConeGeometry(data) {
    const positions = this.coneGeometry.getAttribute('position');
    const vertices = data.mesh.vertices;
    for (let i = 0; i < positions.count; i += 1) {
      const world = toWorld([vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]], 1);
      positions.setXYZ(i, world.x, world.y, world.z);
    }
    positions.needsUpdate = true;
    this.coneGeometry.computeBoundingSphere();

    const genPositions = this.generatrixGeometry.getAttribute('position');
    let index = 0;
    for (const [start, end] of data.generatrices) {
      const worldStart = toWorld(start, 1);
      const worldEnd = toWorld(end, 1);
      genPositions.setXYZ(index, worldStart.x, worldStart.y, worldStart.z);
      index += 1;
      genPositions.setXYZ(index, worldEnd.x, worldEnd.y, worldEnd.z);
      index += 1;
    }
    genPositions.needsUpdate = true;
    this.generatrixGeometry.computeBoundingSphere();
  }

  _updateAngleAids(phi, axis) {
    const axisUnit = axis;
    const phiArc = makePhiAngleArc(phi, this._currentBeta, this.basis, 120);
    const phiPoints = phiArc.map((p) => toWorld(p, this.R * 0.61));
    this._updateFatLine(this.phiArc, phiPoints);
    if (phiPoints.length >= 2) {
      const midpoint = phiPoints[Math.floor(phiPoints.length / 2)];
      this.labels.phi.position.copy(midpoint.clone().multiplyScalar(1.12));
      this.labels.phi.visible = this._angleAidsVisible;
    } else {
      this.labels.phi.visible = false;
    }

    const k = scale(axisUnit, -1);
    const kAngles = anglesFromDirection(k);
    const aids = makeDirectionAngleAids(k, kAngles.chi, kAngles.psi, !kAngles.pole);
    const chiArc = aids.chiArc.map((p) => toWorld(p, this.R * 0.74));
    this._updateFatLine(this.chiArc, chiArc);
    if (chiArc.length >= 2) {
      const midpoint = chiArc[Math.floor(chiArc.length / 2)];
      this.labels.chi.position.copy(midpoint);
      this.labels.chi.visible = this._angleAidsVisible;
    } else {
      this.labels.chi.visible = false;
    }

    if (kAngles.pole || kAngles.psi === null) {
      this.psiArc.visible = false;
      this.labels.psi.visible = false;
      for (const object of [this.psiReferenceRay, this.psiProjectionRay, this.psiProjectionDrop, this.psiDirectionHead, this.psiProjectionMarker]) object.visible = false;
      this.labels.psiZero.visible = false;
      this.labels.kProjection.visible = false;
    } else {
      // The azimuth is measured to k's xy projection, not directly to k in 3D.
      // Match the cyan k arrow's displayed tip (0.8 R k), then drop it along
      // physical z to the xy plane. The arc endpoint lies on that radial ray.
      const kTip = scale(k, this.R * 0.8);
      const projectedTip = toWorld([kTip[0], kTip[1], 0]);
      const zeroTip = toWorld([0, this.R * 0.62, 0]);
      this._updateFatLine(this.psiReferenceRay, [new THREE.Vector3(), zeroTip]);
      this._updateFatLine(this.psiProjectionRay, [new THREE.Vector3(), projectedTip]);
      if (Math.abs(kTip[2]) > 1e-10) {
        this._updateFatLine(this.psiProjectionDrop, [toWorld(kTip), projectedTip]);
      } else {
        this.psiProjectionDrop.visible = false;
      }
      this.psiProjectionMarker.position.copy(projectedTip);
      this.psiProjectionMarker.visible = true;
      this.labels.psiZero.position.copy(zeroTip);
      this.labels.kProjection.position.copy(projectedTip);
      this.labels.psiZero.visible = this._angleAidsVisible;
      this.labels.kProjection.visible = this._angleAidsVisible;
      this.labelLayer.setText('psi', `<span class="label-main">ψ<sub>k</sub> = ${(kAngles.psi * 180 / Math.PI).toFixed(1)}°</span>`);
      const psiPoints = aids.psiArc.map((p) => toWorld(p, this.R * 0.47));
      this._updateFatLine(this.psiArc, psiPoints);
      const tangent = toWorld([Math.cos(kAngles.psi), -Math.sin(kAngles.psi), 0]);
      const headLength = this.R * 0.045;
      this.psiDirectionHead.position.copy(psiPoints[psiPoints.length - 1]).addScaledVector(tangent, -headLength * 0.5);
      this.psiDirectionHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      this.psiDirectionHead.visible = kAngles.psi > 0.03;
      if (psiPoints.length >= 2) {
        const midpoint = psiPoints[Math.floor(psiPoints.length / 2)];
        this.labels.psi.position.copy(midpoint);
        this.labels.psi.visible = this._angleAidsVisible;
      } else {
        this.labels.psi.visible = false;
      }
    }

    // The angular aids group also contains the negative-z guide, which is
    // created in _buildCoordinateAxes and reparented visually by visibility.
    this.angleAidsGroup.visible = this._angleAidsVisible;
  }

  _updateBGuideLine() {
    if (!this._bVisible) return;
    const points = [
      this.aMarker.position.clone(),
      this.bMarker.position.clone(),
    ];
    this._updateFatLine(this.bGuideLine, points);
    this.bGuideLine.visible = true;
  }

  _updateTheoryTrack(phi) {
    if (Math.abs(Math.sin(phi)) < 1e-8) {
      this._theoryAvailable = false;
      this.theoryLine.visible = false;
      return;
    }
    const points = makeTheoreticalOrbit(phi, this.basis, this.R, 720).map((p) => toWorld(p, 1));
    const dashed = [];
    const onSamples = 6;
    const offSamples = 5;
    for (let i = 0; i < points.length - 1; i += 1) {
      if ((Math.floor(i / (onSamples + offSamples)) * (onSamples + offSamples)) + onSamples > i) {
        dashed.push(points[i], points[i + 1]);
      }
    }
    this.theoryGeometry.dispose();
    this.theoryGeometry = new THREE.BufferGeometry().setFromPoints(dashed);
    this.theoryLine.geometry = this.theoryGeometry;
    this._theoryAvailable = true;
    this.theoryLine.visible = this._theoryVisible;
  }

  getHistoryLineCount() {
    return this._historyLines.size;
  }

  getRenderDiagnostics() {
    return {
      theoryAvailable: Boolean(this._theoryAvailable),
      theoryVisible: Boolean(this.theoryLine?.visible),
      theoryPoints: this.theoryLine?.geometry?.getAttribute('position')?.count ?? 0,
      bVisible: Boolean(this.bMarker?.visible),
      bGuideVisible: Boolean(this.bGuideLine?.visible),
      bGuidePoints: this.bGuideLine?.geometry?.getAttribute('instanceStart')?.count ?? 0,
      renderedHistoryLines: this._historyLines.size,
      historyLines: [...this._historyLines.entries()].map(([id, entry]) => {
        const geometry = entry.line.geometry;
        const drawnSegments = Math.min(
          geometry.instanceCount,
          geometry._maxInstanceCount ?? Infinity,
        );
        const ends = geometry.getAttribute('instanceEnd');
        const lastIndex = Math.max(0, drawnSegments - 1);
        return {
          id,
          expectedSegments: Math.max(0, entry.count - 1),
          drawnSegments,
          visible: entry.line.visible,
          lastRenderedPoint: drawnSegments > 0
            ? [ends.getX(lastIndex), ends.getY(lastIndex), ends.getZ(lastIndex)]
            : null,
        };
      }),
      angleAidsVisible: this.angleAidsGroup.visible,
      phiArcVisible: this.phiArc.visible,
      chiArcVisible: this.chiArc.visible,
      psiArcVisible: this.psiArc.visible,
      psiProjection: {
        visible: this.angleAidsGroup.visible && this.psiProjectionRay.visible,
        rayEnd: this.psiProjectionMarker.position.toArray(),
        zeroEnd: this.labels.psiZero.position.toArray(),
        arcEnd: this.psiArc.visible ? (() => {
          const geometry = this.psiArc.geometry;
          const end = geometry.getAttribute('instanceEnd');
          const i = geometry.instanceCount - 1;
          return [end.getX(i), end.getY(i), end.getZ(i)];
        })() : null,
        dropVisible: this.angleAidsGroup.visible && this.psiProjectionDrop.visible,
        arrowVisible: this.angleAidsGroup.visible && this.psiDirectionHead.visible,
      },
    };
  }

  setHistory(segments, visible = this._historyVisible) {
    this._historySegmentsRef = segments;
    this._historyVisible = visible;
    const seen = new Set();
    for (const segment of segments) {
      seen.add(segment.id);
      let entry = this._historyLines.get(segment.id);
      const count = segment.points.length;
      if (!entry) {
        const line = this._createFatLine({
          color: segment.style?.color ? new THREE.Color(segment.style.color).getHex() : COLORS.historyA,
          width: segment.style?.width ?? 3.2,
          opacity: 0.94,
          depthTest: false,
          points: [],
          renderOrder: 18,
        });
        entry = { line, count: 0 };
        this._historyLines.set(segment.id, entry);
      }
      if (entry.count !== count) {
        const points = segment.points.map((point) => toWorld(point.dir, this.R));
        if (points.length >= 2) {
          this._updateFatLine(entry.line, points);
          entry.line.visible = visible;
          entry.visible = true;
        } else {
          entry.line.visible = false;
          entry.visible = false;
        }
        entry.count = count;
      }
      entry.line.visible = visible && entry.visible;
    }
    for (const [id, entry] of this._historyLines) {
      if (!seen.has(id)) {
        this.scene.remove(entry.line);
        entry.line.geometry.dispose();
        entry.line.material.dispose();
        this._historyLines.delete(id);
      }
    }
  }

  refreshHistoryVisibility() {
    for (const entry of this._historyLines.values()) {
      entry.line.visible = this._historyVisible && entry.visible;
    }
  }

  render() {
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
    this.labelLayer.update(this.camera);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._resizeObserver?.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

