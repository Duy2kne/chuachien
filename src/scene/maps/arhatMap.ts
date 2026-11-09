// LA HÁN ĐƯỜNG: điện thờ Đức Phật Thích Ca, hai bên vách bày 18 pho tượng La Hán (mỗi bên 9 vị).
// Vách trái (x âm): vị 1 → 9 đi từ cửa vào trong; vách phải (x dương): vị 10 → 18 đi từ trong ra cửa.
// Toạ độ (khớp src/shared/maps.ts): trong điện x ±13, z -24..12; cửa z = 12.3; bàn thờ (0, -16.2); tượng Phật (0, -21.5)
import * as THREE from 'three';
import { TempleWorld, makeRoofGroup } from '../templeWorld.js';
import { getGrassTexture, getVietnameseCurvedRoofTexture } from '../proceduralTextures.js';
import { ARHATS } from './infoContent.js';
import { V, std, put, seeded, plaqueTexture, plaqueMesh, groundPlane, glowTexture, glowSprite } from './helpers.js';

// ===================== VẬT LIỆU NỀN, TIA NẮNG =====================
function plankTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  for (let row = 0; row < 8; row++) {
    const y = row * 64;
    let x = -((row * 97) % 300);
    while (x < 512) {
      const len = 220 + ((row * 31 + x) % 140);
      const tone = 112 + ((row * 13 + Math.abs(x)) % 26);
      g.fillStyle = `rgb(${tone + 30},${tone - 12},${tone - 50})`;
      g.fillRect(x, y, len, 64);
      g.strokeStyle = 'rgba(40,20,8,0.55)';
      g.lineWidth = 2;
      g.strokeRect(x, y, len, 64);
      x += len;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 7);
  t.anisotropy = 4;
  return t;
}

function gravelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d6cdb8';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 60},${110 + Math.random() * 50},${90 + Math.random() * 40},0.35)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
}

let _shaftTex: THREE.CanvasTexture | null = null;
function shaftTexture() {
  if (_shaftTex) return _shaftTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  const gx = g.createLinearGradient(0, 0, 128, 0);
  gx.addColorStop(0, 'rgba(255,240,200,0.9)');
  gx.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gx;
  g.fillRect(0, 0, 128, 64);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, 64);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.25, 'rgba(0,0,0,1)');
  gy.addColorStop(0.75, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy;
  g.fillRect(0, 0, 128, 64);
  _shaftTex = new THREE.CanvasTexture(c);
  return _shaftTex;
}

// Vị trí 18 bệ tượng: z theo thứ tự từ cửa vào trong
const STATUE_Z = [9, 5.5, 2, -1.5, -5, -8.5, -12, -15.5, -19];
const STATUE_X = 11.3;
export function arhatSpot(n: number) {
  const left = n <= 9;
  const k = left ? n - 1 : 18 - n; // vách phải: vị 10 ở trong cùng, vị 18 gần cửa
  return { x: left ? -STATUE_X : STATUE_X, z: STATUE_Z[k], left };
}

export function buildArhatMap(w: TempleWorld) {
  w.particleArea = [-12, 12, -22, 11, 9];
  w.buildMountainRanges();
  const HALL_H = 11;
  const shell = (m: THREE.Mesh) => { m.userData.noCastShadow = true; return m; };

  // ---------- Nền ----------
  const grassMat = new THREE.MeshStandardMaterial({ map: getGrassTexture(), roughness: 0.95 });
  w.themeMats.grass.push(grassMat);
  groundPlane(w, 400, 400, 0, 0, grassMat, -0.03);
  groundPlane(w, 26.4, 36.8, 0, -6, new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.55, metalness: 0.05 }), 0.01);
  groundPlane(w, 16.6, 8.2, 0, 16.6, new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 0.95 }), 0.01);
  groundPlane(w, 2.6, 27, 0, -1.6, std(0x8a1a14, { roughness: 0.9 }), 0.02);
  // thảm đỏ dọc hai dãy tượng
  for (const sx of [-1, 1]) groundPlane(w, 1.6, 31, sx * 8.3, -5, std(0x7a1a12, { roughness: 0.9 }), 0.02);

  // ---------- Vỏ điện ----------
  const wallMat = std(0xcfa878, { roughness: 0.9 });
  const lacquer = std(0x8a1c14, { roughness: 0.45, metalness: 0.1 });
  const darkWood = std(0x3a2012, { roughness: 0.7 });
  const gold = std(0xd4a537, { metalness: 0.8, roughness: 0.3 });
  const wall = (x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = HALL_H, collide = true) => {
    shell(put(w.root, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), wallMat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    if (collide) {
      w.collisionBoxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, type: 'impassable' });
      w.minimap.rects.push({ x0, x1, z0, z1, kind: 'wall' });
    }
  };
  wall(-13.6, 13.6, -24.6, -24.0);
  wall(-13.6, -13.0, -24.6, 12.6);
  wall(13.0, 13.6, -24.6, 12.6);
  wall(-13.6, -2.5, 12.0, 12.6);
  wall(2.5, 13.6, 12.0, 12.6);
  wall(-2.5, 2.5, 12.0, 12.6, 4.2, HALL_H, false);
  for (const x of [-2.6, 2.6]) put(w.root, new THREE.BoxGeometry(0.3, 4.3, 0.8), lacquer, x, 2.15, 12.3);
  put(w.root, new THREE.BoxGeometry(5.5, 0.35, 0.8), lacquer, 0, 4.3, 12.3);
  shell(put(w.root, new THREE.BoxGeometry(27.2, 0.4, 37.2), darkWood, 0, HALL_H + 0.2, -6));
  for (const z of [-21, -15, -9, -3, 3, 9]) put(w.root, new THREE.BoxGeometry(26, 0.5, 0.45), lacquer, 0, HALL_H - 0.3, z);
  for (const x of [-9.5, 9.5]) put(w.root, new THREE.BoxGeometry(0.45, 0.5, 36.4), lacquer, x, HALL_H - 0.3, -6);
  for (const x of [-12.97, 12.97]) put(w.root, new THREE.BoxGeometry(0.06, 1.2, 36.4), darkWood, x, 0.6, -6);

  const roof = makeRoofGroup(30, 40, 5.5, 1.3, new THREE.MeshStandardMaterial({ map: getVietnameseCurvedRoofTexture(), side: THREE.DoubleSide, roughness: 0.6 }));
  roof.position.set(0, HALL_H + 0.35, -6);
  roof.traverse(o => { o.userData.noCastShadow = true; });
  w.root.add(roof);
  const doorPlaque = plaqueMesh(plaqueTexture([{ text: 'LA HÁN ĐƯỜNG', size: 50, color: '#fde68a' }], { w: 520, h: 130, bg: '#7a1c12', border: '#d4a537' }), 4.2, 1.05, 0.25);
  doorPlaque.position.set(0, 5.4, 12.63);
  w.root.add(doorPlaque);

  // ---------- Cột ----------
  for (const x of [-9.5, 9.5]) {
    for (const z of [-20, -14, -8, -2, 4, 10]) {
      put(w.root, new THREE.CylinderGeometry(0.55, 0.6, 0.35, 12), std(0x8c867a, { roughness: 0.9 }), x, 0.17, z);
      put(w.root, new THREE.CylinderGeometry(0.38, 0.38, HALL_H - 0.6, 16), lacquer, x, (HALL_H - 0.6) / 2 + 0.3, z);
      for (const y of [0.55, HALL_H - 0.9]) {
        const band = put(w.root, new THREE.TorusGeometry(0.39, 0.04, 6, 20), gold, x, y, z);
        band.rotation.x = Math.PI / 2;
      }
      w.collisionCircles.push({ x, z, r: 0.55 });
    }
  }

  // ---------- Cửa sổ cao (trên các biển tên tượng) + tia nắng ----------
  const paneMat = std(0xfff4dc, { emissive: 0xffe2b0, emissiveIntensity: 0.9, roughness: 0.6 });
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const WIN_Y = 8.5;
  for (const side of [-1, 1]) {
    for (const z of [-17, -11, -5, 1, 7]) {
      const x = side * 12.96;
      const pane = put(w.root, new THREE.PlaneGeometry(3.0, 2.6), paneMat, x, WIN_Y, z);
      pane.rotation.y = side * -Math.PI / 2;
      for (let k = -1; k <= 1; k++) put(w.root, new THREE.BoxGeometry(0.08, 2.6, 0.08), darkWood, x - side * 0.04, WIN_Y, z + k * 0.75);
      put(w.root, new THREE.BoxGeometry(0.08, 0.08, 3.0), darkWood, x - side * 0.04, WIN_Y, z);
      if (side > 0) continue;
      const dx = 9.5;
      const dy = WIN_Y;
      const len = Math.hypot(dx, dy);
      const tilt = -Math.atan2(dy, dx);
      for (const vertical of [false, true]) {
        const geo = new THREE.PlaneGeometry(len, 2.8);
        if (!vertical) geo.rotateX(Math.PI / 2);
        geo.translate(len / 2, 0, 0);
        geo.rotateZ(tilt);
        const shaft = new THREE.Mesh(geo, shaftMat);
        shaft.position.set(x + 0.05, WIN_Y, z);
        shaft.renderOrder = 3;
        w.root.add(shaft);
      }
    }
  }

  // ---------- Bệ thờ + tượng Phật Thích Ca cuối điện ----------
  put(w.root, new THREE.BoxGeometry(14, 0.8, 6.5), lacquer, 0, 0.4, -20.75);
  put(w.root, new THREE.BoxGeometry(14.05, 0.08, 0.06), gold, 0, 0.72, -17.5);
  w.collisionBoxes.push({ minX: -7, maxX: 7, minZ: -24, maxZ: -17.4, type: 'impassable' });
  w.minimap.rects.push({ x0: -7, x1: 7, z0: -24, z1: -17.4, kind: 'altar' });
  const parent = new THREE.Group();
  parent.position.set(0, -0.9, -2.6);
  w.root.add(parent);
  w.buildAuthenticBuddhaAndAltar(parent);
  const statue = w.altarGroup?.userData.statue as THREE.Group | undefined;
  if (statue) {
    statue.scale.setScalar(1.6);
    statue.position.set(0, -0.6, -3.44);
  }
  put(w.root, new THREE.CylinderGeometry(2.5, 2.7, 0.5, 8), gold, 0, 1.05, -21.5);
  w.collisionBoxes.push({ minX: -2.7, maxX: 2.7, minZ: -17.2, maxZ: -15.2, type: 'impassable' });
  w.minimap.rects.push({ x0: -2.7, x1: 2.7, z0: -17.2, z1: -15.2, kind: 'altar' });
  w.minimap.marks.push({ x: 0, z: -21, label: '卍' });
  const hp = plaqueMesh(plaqueTexture([{ text: 'THẬP BÁT LA HÁN', size: 56, color: '#fde68a' }], { w: 760, h: 150, bg: '#5c1a12', border: '#d4a537' }), 6.4, 1.26, 0.3);
  hp.position.set(0, 9.9, -23.95);
  w.root.add(hp);

  // mõ lớn và chuông gia trì hai bên bàn thờ
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    put(g, new THREE.BoxGeometry(1.0, 0.5, 1.0), lacquer, 0, 0.25, 0);
    put(g, new THREE.CylinderGeometry(0.42, 0.45, 0.14, 20), std(0xc9952a, { roughness: 0.9 }), 0, 0.57, 0);
    if (side < 0) {
      const mo = put(g, new THREE.SphereGeometry(1, 20, 14), std(0x9a5420, { roughness: 0.45 }), 0, 0.92, 0);
      mo.scale.set(0.42, 0.33, 0.36);
    } else {
      put(g, new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0.02), new THREE.Vector2(0.42, 0.25), new THREE.Vector2(0.44, 0.45), new THREE.Vector2(0.41, 0.46)], 28), std(0x8a5a22, { metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }), 0, 0.64, 0);
    }
    g.position.set(side * 4.6, 0, -15.4);
    w.root.add(g);
    w.collisionCircles.push({ x: side * 4.6, z: -15.4, r: 0.75 });
  }

  // lư hương nhỏ + bồ đoàn lễ Phật
  const circles = w.collisionCircles.length;
  w.buildGrandBronzeUrn(0, -12.2);
  w.incenseUrnGroup?.scale.setScalar(0.7);
  w.collisionCircles[circles].r = 0.95;
  w.smokeY = 1.2;
  for (const z of [-9.6, -8.0]) for (const x of [-5, -3.4, 3.4, 5]) w.createRoundCushion(x, z);

  // đèn lồng, đèn điểm ấm
  for (const x of [-5.5, 5.5]) for (const z of [-14, -8, -2, 4]) w.createHangingLantern(x, HALL_H - 0.6, z, w.root);
  for (const z of [-12, 2]) {
    const l = new THREE.PointLight(0xffc98a, 10, 26, 1.5);
    l.position.set(0, 7, z);
    w.root.add(l);
  }
  const altarGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  altarGlow.scale.set(9, 9, 1);
  altarGlow.position.set(0, 5.5, -22.6);
  w.root.add(altarGlow);

  // ---------- 18 vị La Hán ----------
  const pedestalMat = std(0x6a5a4a, { roughness: 0.9, flatShading: true });
  for (const A of ARHATS) {
    const { x, z, left } = arhatSpot(A.n);
    const face = left ? 1 : -1; // hướng nhìn vào lối giữa
    // bệ đá + viền son
    put(w.root, new THREE.BoxGeometry(2.3, 0.65, 2.7), pedestalMat, x, 0.325, z);
    put(w.root, new THREE.BoxGeometry(2.36, 0.08, 2.76), lacquer, x, 0.66, z);
    w.collisionBoxes.push({ minX: x - 1.2, maxX: x + 1.2, minZ: z - 1.4, maxZ: z + 1.4, type: 'impassable' });
    w.minimap.rects.push({ x0: x - 1.15, x1: x + 1.15, z0: z - 1.35, z1: z + 1.35, kind: 'statue' });
    w.minimap.marks.push({ x, z, label: String(A.n), id: `arhat-${A.n}` });
    const g = new THREE.Group();
    ARHAT_BUILDERS[A.n - 1](g, w);
    g.position.set(x, 0.7, z);
    g.rotation.y = face * Math.PI / 2;
    w.root.add(g);
    // biển tên trên vách
    const t = plaqueTexture([
      { text: `${A.n}. ${A.short} LA HÁN`, size: 40, color: '#fde68a' },
      { text: `${A.sanskrit} · ${A.phonetic}`, size: 20, color: '#fef3c7', weight: '600' }
    ], { w: 560, h: 170, bg: '#5c1a12', border: '#d4a537' });
    const plaque = plaqueMesh(t, 2.9, 0.88, 0.3);
    plaque.position.set(x < 0 ? -12.94 : 12.94, 4.4, z);
    plaque.rotation.y = face * Math.PI / 2;
    w.root.add(plaque);
    w.infoPoints.push({ id: `arhat-${A.n}`, x: x + face * 3.0, z, r: 1.75 });
  }

  // ---------- Bảng giới thiệu gần cửa ----------
  const sign = new THREE.Group();
  for (const sx of [-0.5, 0.5]) put(sign, new THREE.BoxGeometry(0.08, 1.5, 0.08), darkWood, sx, 0.75, 0);
  const signFace = plaqueMesh(plaqueTexture([
    { text: 'THẬP BÁT', size: 30, color: '#fde68a' },
    { text: 'LA HÁN', size: 34, color: '#fde68a' },
    { text: 'Trái: 1 → 9', size: 20, color: '#fef3c7', weight: '600' },
    { text: 'Phải: 10 → 18', size: 20, color: '#fef3c7', weight: '600' }
  ], { w: 280, h: 300, bg: '#3a2012', border: '#d4a537' }), 1.15, 1.2, 0.2);
  signFace.position.set(0, 1.45, 0.05);
  sign.add(signFace);
  sign.position.set(-3.0, 0, 7.2);
  sign.rotation.y = 0.35;
  w.root.add(sign);
  w.collisionCircles.push({ x: -3.0, z: 7.2, r: 0.6 });
  w.infoPoints.push({ id: 'arhat-0', x: -2.4, z: 8.6, r: 2.0 });
  w.minimap.marks.push({ x: -3.0, z: 7.2, label: 'i', id: 'arhat-0' });

  // ---------- Sân trước ----------
  w.createAuthenticStoneLantern(-3.6, 16.8);
  w.createAuthenticStoneLantern(3.6, 16.8);
  w.createPedestalBonsai(-6.2, 14.2, 'green_foliage');
  w.createPedestalBonsai(6.2, 14.2, 'yellow_blossom');
  const hedge = std(0x3a6a3a, { roughness: 0.95, flatShading: true });
  for (const [x0, x1, z0, z1] of [[-8.6, -8.0, 12.6, 20.6], [8.0, 8.6, 12.6, 20.6], [-8.6, 8.6, 20.0, 20.6]] as [number, number, number, number][]) {
    put(w.root, new THREE.BoxGeometry(x1 - x0, 1.1, z1 - z0), hedge, (x0 + x1) / 2, 0.55, (z0 + z1) / 2);
    w.collisionBoxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, type: 'impassable' });
    w.minimap.rects.push({ x0, x1, z0, z1, kind: 'wall' });
  }
  w.buildCloudPine(-10.8, 17, 1.1, 61);
  w.buildCloudPine(10.8, 17, 1.1, 83);
}

// ===================== TƯỢNG LA HÁN =====================
// Toạ độ cục bộ: gốc ở mặt bệ, mặt tượng nhìn +z, thân ngồi kiết già cao ~1m (sau đó phóng to).
// Tay "a" ở phía +x, tay "b" ở phía -x; mỗi tay cho [khuỷu, bàn tay] theo dáng ngồi.
type P3 = [number, number, number];
interface FigureCfg {
  pose?: 'seated' | 'standing';
  robe: number;
  sash: number;
  armA?: [P3, P3];
  armB?: [P3, P3];
  head?: { x?: number; y?: number; z?: number };
  face?: 'calm' | 'smile' | 'closed' | 'yawn';
  longBrows?: boolean;
  belly?: boolean;
}

const SKIN = 0xd8a57a;
const ROBES = [0xb4532a, 0x8a5a2b, 0xc9822c, 0x6b3a2a, 0x9c3b2a, 0x7a4a2a];
const SASHES = [0xd9a63a, 0x7a1c14, 0x4a5a3a, 0xc9822c];
const KNEE_A: [P3, P3] = [[0.36, 0.5, 0.1], [0.24, 0.32, 0.3]];
const KNEE_B: [P3, P3] = [[-0.36, 0.5, 0.1], [-0.24, 0.32, 0.3]];
const LAP_A: [P3, P3] = [[0.33, 0.5, 0.12], [0.06, 0.38, 0.32]];
const LAP_B: [P3, P3] = [[-0.33, 0.5, 0.12], [-0.06, 0.38, 0.32]];

const matCache = new Map<number, THREE.MeshStandardMaterial>();
function M(color: number, o: THREE.MeshStandardMaterialParameters = {}) {
  const key = color;
  if (!Object.keys(o).length && matCache.has(key)) return matCache.get(key)!;
  const m = std(color, { roughness: 0.6, ...o });
  if (!Object.keys(o).length) matCache.set(key, m);
  return m;
}

// Trả về nhóm tượng + độ cao lệch (đứng cao hơn ngồi) + vị trí 2 bàn tay
function figure(cfg: FigureCfg) {
  matCache.clear();
  const g = new THREE.Group();
  const skin = M(SKIN);
  const robe = M(cfg.robe);
  const sash = M(cfg.sash);
  const dark = M(0x2a1a10);
  const standing = cfg.pose === 'standing';
  const dy = standing ? 0.62 : 0;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const v = (p: P3) => V(p[0], p[1] + dy, p[2]);

  if (standing) {
    const body = add(new THREE.LatheGeometry([
      [0, 0], [0.3, 0], [0.32, 0.12], [0.27, 0.6], [0.26, 0.95], [0.29, 1.22], [0.25, 1.36], [0.12, 1.43], [0, 1.44]
    ].map(([r, y]) => new THREE.Vector2(r, y)), 28), robe);
    body.scale.z = 0.75;
    for (const sx of [-0.1, 0.1]) {
      const foot = add(new THREE.SphereGeometry(0.07, 10, 8), skin);
      foot.scale.set(0.8, 0.5, 1.4);
      foot.position.set(sx, 0.03, 0.2);
    }
  } else {
    const lap = add(new THREE.CapsuleGeometry(0.17, 0.46, 6, 14), robe);
    lap.rotation.z = Math.PI / 2;
    lap.scale.z = 1.35;
    lap.position.set(0, 0.17, 0.1);
    for (const sx of [-0.2, 0.2]) {
      const sole = add(new THREE.SphereGeometry(0.07, 10, 8), skin);
      sole.scale.set(1.3, 0.5, 0.8);
      sole.position.set(sx, 0.3, 0.3);
    }
    const torso = add(new THREE.LatheGeometry([
      [0, 0], [0.27, 0], [cfg.belly ? 0.36 : 0.29, 0.17], [cfg.belly ? 0.32 : 0.26, 0.36], [0.28, 0.5], [0.24, 0.58], [0.12, 0.63], [0, 0.64]
    ].map(([r, y]) => new THREE.Vector2(r, y)), 28), robe);
    torso.scale.z = 0.78;
    torso.position.y = 0.2;
  }
  // cà sa vắt chéo ngực
  add(TempleWorld.taperTube(new THREE.CatmullRomCurve3([v([0.25, 0.82, -0.08]), v([0.06, 0.64, 0.23]), v([-0.2, 0.42, 0.21]), v([-0.29, 0.26, 0.12])]), 16, 0.045, 0.04, 6), sash);
  const neck = add(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 12), skin);
  neck.position.copy(v([0, 0.86, 0]));

  // đầu: trọc, tai dài, nét mặt theo cfg
  const head = new THREE.Group();
  head.position.copy(v([0, 0.98, 0.01]));
  head.rotation.set(cfg.head?.x ?? 0, cfg.head?.y ?? 0, cfg.head?.z ?? 0);
  g.add(head);
  const hadd = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    head.add(m);
    return m;
  };
  hadd(new THREE.SphereGeometry(1, 20, 16), skin, 0, 0, 0).scale.set(0.13, 0.15, 0.135);
  for (const sx of [-1, 1]) {
    hadd(new THREE.SphereGeometry(1, 8, 6), skin, sx * 0.13, -0.015, 0).scale.set(0.025, 0.06, 0.035);
    const closed = cfg.face === 'closed' || cfg.face === 'yawn';
    if (closed) {
      const lid = hadd(new THREE.TorusGeometry(0.022, 0.005, 4, 10, Math.PI), dark, sx * 0.045, 0.015, 0.122);
      lid.rotation.z = Math.PI;
    } else if (cfg.face === 'smile') {
      hadd(new THREE.TorusGeometry(0.02, 0.005, 4, 10, Math.PI), dark, sx * 0.045, 0.012, 0.124);
    } else {
      hadd(new THREE.SphereGeometry(0.011, 6, 5), dark, sx * 0.045, 0.02, 0.123);
    }
    if (cfg.longBrows) {
      const brow = TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(sx * 0.03, 0.055, 0.125), V(sx * 0.1, 0.05, 0.12), V(sx * 0.13, -0.1, 0.11), V(sx * 0.13, -0.32, 0.1), V(sx * 0.12, -0.5, 0.13)]), 18, 0.012, 0.006, 5);
      head.add(new THREE.Mesh(brow, M(0xf2efe8)));
    } else {
      const brow = hadd(new THREE.TorusGeometry(0.03, 0.006, 4, 10, Math.PI * 0.7), dark, sx * 0.045, 0.045, 0.122);
      brow.rotation.z = Math.PI * 0.15;
    }
  }
  hadd(new THREE.SphereGeometry(1, 8, 6), skin, 0, -0.01, 0.135).scale.set(0.018, 0.03, 0.022);
  if (cfg.face === 'smile') {
    const mouth = hadd(new THREE.TorusGeometry(0.04, 0.008, 5, 14, Math.PI), M(0x8a3a2a), 0, -0.05, 0.12);
    mouth.rotation.z = Math.PI;
  } else if (cfg.face === 'yawn') {
    hadd(new THREE.SphereGeometry(1, 10, 8), M(0x4a1a12), 0, -0.07, 0.125).scale.set(0.03, 0.035, 0.01);
  } else {
    const mouth = hadd(new THREE.TorusGeometry(0.022, 0.006, 4, 10, Math.PI), M(0x8a3a2a), 0, -0.065, 0.122);
    mouth.rotation.z = Math.PI;
  }

  // tay: ống tay áo + bàn tay
  const hands: THREE.Vector3[] = [];
  for (const [arm, sx] of [[cfg.armA ?? KNEE_A, 1], [cfg.armB ?? KNEE_B, -1]] as [[P3, P3], number][]) {
    const shoulder = v([sx * 0.27, 0.8, 0]);
    const elbow = v(arm[0]);
    const hand = v(arm[1]);
    add(TempleWorld.capsuleBetween(shoulder, elbow, 0.068), robe);
    add(TempleWorld.capsuleBetween(elbow, hand, 0.056), robe);
    const palm = add(new THREE.SphereGeometry(0.052, 10, 8), skin);
    palm.scale.set(0.85, 1.1, 0.65);
    palm.position.copy(hand);
    hands.push(hand);
  }
  return { g, dy, handA: hands[0], handB: hands[1], head };
}

// ---------- Con vật (thân dọc trục x, đầu ở phía +x) ----------
function quadruped(o: { len: number; h: number; wid: number; leg: number; legR: number; color: number }) {
  const g = new THREE.Group();
  const mat = M(o.color, { roughness: 0.75 });
  const body = put(g, new THREE.SphereGeometry(1, 18, 12), mat, 0, o.leg + o.h * 0.45, 0);
  body.scale.set(o.len / 2, o.h / 2, o.wid / 2);
  for (const lx of [-1, 1]) for (const lz of [-1, 1]) {
    put(g, new THREE.CylinderGeometry(o.legR, o.legR * 0.85, o.leg + o.h * 0.2, 8), mat, lx * o.len * 0.32, (o.leg + o.h * 0.2) / 2, lz * o.wid * 0.28);
  }
  return { g, mat, backY: o.leg + o.h * 0.9 };
}

function deer() {
  const { g, mat, backY } = quadruped({ len: 1.1, h: 0.42, wid: 0.36, leg: 0.6, legR: 0.04, color: 0xa8703a });
  put(g, TempleWorld.capsuleBetween(V(0.42, 0.95, 0), V(0.62, 1.3, 0), 0.07), mat);
  const head = put(g, new THREE.SphereGeometry(1, 12, 10), mat, 0.72, 1.33, 0);
  head.scale.set(0.16, 0.08, 0.07);
  head.rotation.z = -0.3;
  const antler = M(0xe8dcc0);
  for (const sz of [-1, 1]) {
    put(g, TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(0.66, 1.4, sz * 0.04), V(0.62, 1.6, sz * 0.12), V(0.55, 1.78, sz * 0.18)]), 8, 0.018, 0.008, 5), antler);
    put(g, TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(0.62, 1.58, sz * 0.12), V(0.72, 1.7, sz * 0.15)]), 4, 0.012, 0.006, 4), antler);
    const ear = put(g, new THREE.ConeGeometry(0.03, 0.1, 6), mat, 0.64, 1.42, sz * 0.07);
    ear.rotation.x = sz * 0.8;
  }
  // đốm trắng trên lưng
  const spot = M(0xf2e6d0);
  const rnd = seeded(11);
  for (let k = 0; k < 9; k++) put(g, new THREE.SphereGeometry(0.03, 6, 5), spot, (rnd() - 0.5) * 0.7, 0.98 + rnd() * 0.06, (rnd() > 0.5 ? 1 : -1) * 0.14);
  return { g, backY };
}

function elephant() {
  const { g, mat, backY } = quadruped({ len: 1.5, h: 0.95, wid: 0.8, leg: 0.5, legR: 0.13, color: 0x8a8a88 });
  put(g, new THREE.SphereGeometry(0.34, 16, 12), mat, 0.8, 1.1, 0);
  for (const sz of [-1, 1]) {
    const ear = put(g, new THREE.CircleGeometry(0.3, 16), M(0x8a8a88, { side: THREE.DoubleSide, roughness: 0.75 }), 0.7, 1.1, sz * 0.3);
    ear.rotation.y = sz * 0.4;
    const tusk = put(g, new THREE.ConeGeometry(0.035, 0.32, 8), M(0xf5f0e0), 1.02, 0.86, sz * 0.12);
    tusk.rotation.z = -1.9;
  }
  put(g, TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(1.05, 1.0, 0), V(1.18, 0.7, 0), V(1.12, 0.38, 0.04), V(1.22, 0.18, 0.1)]), 14, 0.1, 0.04, 8), mat);
  // khăn yên đỏ viền vàng trên lưng
  put(g, new THREE.BoxGeometry(0.8, 0.05, 0.86), M(0xa01a14), 0, backY + 0.02, 0);
  put(g, new THREE.BoxGeometry(0.84, 0.03, 0.9), M(0xd4a537, { metalness: 0.7, roughness: 0.3 }), 0, backY - 0.02, 0);
  return { g, backY: backY + 0.05 };
}

function lionCub() {
  const { g, mat } = quadruped({ len: 0.46, h: 0.24, wid: 0.22, leg: 0.12, legR: 0.03, color: 0xc8902a });
  put(g, new THREE.SphereGeometry(0.14, 12, 10), M(0x8a5a1a, { roughness: 0.9 }), 0.24, 0.32, 0);
  put(g, new THREE.SphereGeometry(0.09, 12, 10), mat, 0.3, 0.34, 0);
  put(g, TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(-0.22, 0.26, 0), V(-0.35, 0.35, 0), V(-0.4, 0.5, 0.05)]), 8, 0.02, 0.015, 5), mat);
  return g;
}

function tiger() {
  const g = new THREE.Group();
  const orange = M(0xd8822a, { roughness: 0.7 });
  const black = M(0x1a120a);
  const body = put(g, new THREE.SphereGeometry(1, 18, 12), orange, 0, 0.17, 0);
  body.scale.set(0.36, 0.15, 0.17);
  // sọc đen quanh mình
  for (let k = 0; k < 6; k++) {
    const x = -0.25 + k * 0.1;
    const r = Math.sqrt(Math.max(0.01, 1 - (x / 0.36) ** 2));
    const band = put(g, new THREE.TorusGeometry(1, 0.06, 4, 18), black, x, 0.17, 0);
    band.rotation.y = Math.PI / 2;
    band.scale.set(0.17 * r, 0.15 * r, 0.17 * r);
  }
  // chân duỗi trước, nằm phục
  for (const sz of [-1, 1]) {
    const paw = put(g, new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), orange, 0.36, 0.05, sz * 0.09);
    paw.rotation.z = Math.PI / 2;
  }
  const head = put(g, new THREE.SphereGeometry(0.12, 14, 10), orange, 0.42, 0.24, 0);
  head.scale.set(1, 0.9, 1.05);
  put(g, new THREE.SphereGeometry(0.05, 10, 8), M(0xf2e6d0), 0.52, 0.2, 0);
  for (const sz of [-1, 1]) {
    put(g, new THREE.SphereGeometry(0.035, 8, 6), orange, 0.4, 0.34, sz * 0.08);
    put(g, new THREE.SphereGeometry(0.014, 6, 5), M(0xe8c040, { emissive: 0x6a4a00, emissiveIntensity: 0.6 }), 0.52, 0.27, sz * 0.045);
  }
  put(g, TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(-0.34, 0.16, 0), V(-0.5, 0.1, 0.1), V(-0.62, 0.15, 0.22), V(-0.62, 0.3, 0.3)]), 12, 0.03, 0.02, 6), orange);
  return g;
}

function dragon(w: TempleWorld) {
  const g = new THREE.Group();
  const scale = M(0x2f7a4a, { metalness: 0.3, roughness: 0.4 });
  const goldM = M(0xd4a537, { metalness: 0.8, roughness: 0.3 });
  const curve = new THREE.CatmullRomCurve3([
    V(-0.55, 0.05, -0.55), V(-0.75, 0.6, -0.45), V(-0.55, 1.25, -0.6), V(-0.05, 1.7, -0.55),
    V(0.45, 1.95, -0.4), V(0.75, 1.7, -0.15), V(0.6, 1.45, 0.12)
  ]);
  put(g, TempleWorld.taperTube(curve, 60, 0.05, 0.1, 10), scale);
  // vây lưng
  const fins = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 0.1, 4), goldM, 26);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let k = 0; k < 26; k++) {
    const t = 0.05 + (k / 26) * 0.85;
    const p = curve.getPoint(t);
    q.setFromUnitVectors(V(0, 1, 0), V(0, 1, 0.3).normalize());
    m.compose(p.add(V(0, 0.08, 0)), q, V(1, 1, 1));
    fins.setMatrixAt(k, m);
  }
  g.add(fins);
  // đầu rồng: mõm dài, sừng, râu, mắt đỏ
  const head = new THREE.Group();
  head.position.copy(curve.getPoint(1));
  head.lookAt(V(0.1, 1.2, 0.5).add(g.position));
  put(head, new THREE.SphereGeometry(1, 14, 10), scale, 0, 0, 0).scale.set(0.11, 0.09, 0.18);
  put(head, new THREE.BoxGeometry(0.12, 0.05, 0.16), scale, 0, -0.03, 0.14);
  for (const sx of [-1, 1]) {
    const horn = put(head, new THREE.ConeGeometry(0.02, 0.18, 6), goldM, sx * 0.05, 0.1, -0.08);
    horn.rotation.x = -0.9;
    put(head, new THREE.SphereGeometry(0.018, 6, 5), M(0xff3a1a, { emissive: 0xaa1a0a, emissiveIntensity: 0.8 }), sx * 0.06, 0.04, 0.08);
    head.add(new THREE.Mesh(TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(sx * 0.05, -0.03, 0.2), V(sx * 0.15, -0.05, 0.25), V(sx * 0.22, -0.12, 0.2)]), 8, 0.006, 0.003, 4), goldM));
  }
  g.add(head);
  void w;
  return g;
}

function bananaTree() {
  const g = new THREE.Group();
  const trunk = M(0x7a8a4a, { roughness: 0.85 });
  const leaf = M(0x4a8a2a, { side: THREE.DoubleSide, roughness: 0.7 });
  put(g, new THREE.CylinderGeometry(0.07, 0.1, 1.7, 10), trunk, 0, 0.85, 0);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const geo = new THREE.PlaneGeometry(0.3, 0.95, 1, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + 0.475;
      pos.setXYZ(i, pos.getX(i), y, -0.22 * (y / 0.95) ** 2);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, leaf);
    m.position.y = 1.6;
    m.rotation.set(-0.9, a, 0, 'YXZ');
    g.add(m);
  }
  return g;
}

function waves() {
  const g = new THREE.Group();
  const water = M(0x3a7ab0, { transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.2 });
  const foam = M(0xdcefff, { roughness: 0.5 });
  put(g, new THREE.CylinderGeometry(0.85, 0.9, 0.06, 24), water, 0, 0.03, 0);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const crest = put(g, new THREE.TorusGeometry(0.16, 0.05, 6, 12, Math.PI), k % 2 ? foam : water, Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62);
    crest.rotation.y = -a + Math.PI / 2;
  }
  // nhánh lau dưới chân
  const reed = put(g, new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), M(0xa8904a), 0, 0.09, 0);
  reed.rotation.z = Math.PI / 2;
  return g;
}

// ---------- 18 pho tượng ----------
const robeOf = (n: number) => ROBES[n % ROBES.length];
const sashOf = (n: number) => SASHES[n % SASHES.length];
type Builder = (g: THREE.Group, w: TempleWorld) => void;
const S = 1.3; // tỉ lệ tượng ngồi

const ARHAT_BUILDERS: Builder[] = [
  // 1. Tọa Lộc: ngồi trên lưng hươu
  (g) => {
    const d = deer();
    d.g.scale.setScalar(1.1);
    g.add(d.g);
    const f = figure({ robe: robeOf(1), sash: sashOf(1), face: 'calm' });
    f.g.scale.setScalar(0.95);
    f.g.position.set(-0.05, d.backY * 1.1 - 0.05, 0);
    g.add(f.g);
  },
  // 2. Khánh Hỷ: cười hoan hỷ, một tay giơ lên vẫy
  (g) => {
    const f = figure({ robe: robeOf(2), sash: sashOf(2), face: 'smile', belly: true, head: { z: 0.12 }, armB: [[-0.42, 0.85, 0.1], [-0.36, 1.12, 0.2]], armA: [[0.34, 0.5, 0.15], [0.14, 0.46, 0.33]] });
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 3. Cử Bát: giơ cao bát khất thực
  (g) => {
    const f = figure({ robe: robeOf(3), sash: sashOf(3), head: { x: -0.25 }, armA: [[0.34, 1.05, 0.05], [0.18, 1.32, 0.1]] });
    const bowl = put(f.g, new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.08, 0.01), new THREE.Vector2(0.12, 0.06), new THREE.Vector2(0.11, 0.1)], 20), M(0x3a2a1a, { side: THREE.DoubleSide, roughness: 0.4 }));
    bowl.position.copy(f.handA).add(V(0, 0.04, 0));
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 4. Thác Tháp: lòng bàn tay nâng bảo tháp nhỏ
  (g) => {
    const f = figure({ robe: robeOf(4), sash: sashOf(4), head: { x: 0.1 }, armA: [[0.32, 0.52, 0.2], [0.08, 0.62, 0.33]] });
    const goldM = M(0xd4a537, { metalness: 0.8, roughness: 0.3 });
    let y = 0.04;
    for (let k = 0; k < 4; k++) {
      const s = 0.09 - k * 0.016;
      put(f.g, new THREE.BoxGeometry(s, 0.05, s), goldM, f.handA.x, f.handA.y + y, f.handA.z);
      put(f.g, new THREE.BoxGeometry(s + 0.03, 0.012, s + 0.03), goldM, f.handA.x, f.handA.y + y + 0.03, f.handA.z);
      y += 0.045;
    }
    put(f.g, new THREE.ConeGeometry(0.015, 0.06, 6), goldM, f.handA.x, f.handA.y + y + 0.03, f.handA.z);
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 5. Tĩnh Tọa: ngồi thiền, hai tay kết ấn trong lòng
  (g) => {
    const f = figure({ robe: robeOf(5), sash: sashOf(5), face: 'closed', head: { x: 0.12 }, armA: LAP_A, armB: LAP_B });
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 6. Quá Giang: đứng trên sóng nước, tay cầm cuộn kinh
  (g) => {
    const wv = waves();
    g.add(wv);
    const f = figure({ pose: 'standing', robe: robeOf(6), sash: sashOf(6), armA: [[0.3, 0.5, 0.12], [0.1, 0.58, 0.3]], armB: [[-0.33, 0.48, 0.06], [-0.3, 0.25, 0.14]] });
    const scroll = put(f.g, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), M(0xe8d8a8), f.handA.x - 0.05, f.handA.y + 0.02, f.handA.z + 0.02);
    scroll.rotation.z = Math.PI / 2;
    f.g.scale.setScalar(1.05);
    f.g.position.y = 0.08;
    g.add(f.g);
  },
  // 7. Kỵ Tượng: ngồi thiền trên lưng voi
  (g) => {
    const e = elephant();
    g.add(e.g);
    const f = figure({ robe: robeOf(7), sash: sashOf(7), face: 'closed', armA: LAP_A, armB: LAP_B });
    f.g.scale.setScalar(0.85);
    f.g.position.set(-0.05, e.backY, 0);
    g.add(f.g);
  },
  // 8. Tiếu Sư: tay vươn xuống đùa với sư tử con
  (g) => {
    const f = figure({ robe: robeOf(8), sash: sashOf(8), face: 'smile', head: { x: 0.2, y: -0.4 }, armB: [[-0.4, 0.45, 0.22], [-0.42, 0.3, 0.44]] });
    f.g.scale.setScalar(S);
    g.add(f.g);
    const cub = lionCub();
    cub.position.set(-0.75, 0, 0.6);
    cub.rotation.y = -0.6;
    g.add(cub);
  },
  // 9. Khai Tâm: hai tay vạch áo, giữa ngực hiện mặt Phật
  (g) => {
    const f = figure({ robe: robeOf(9), sash: sashOf(9), armA: [[0.34, 0.56, 0.15], [0.15, 0.7, 0.24]], armB: [[-0.34, 0.56, 0.15], [-0.15, 0.7, 0.24]] });
    const chest = put(f.g, new THREE.CircleGeometry(0.12, 24), M(SKIN), 0, 0.68, 0.222);
    chest.scale.y = 1.2;
    const goldM = M(0xd4a537, { metalness: 0.85, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.4 });
    const bface = put(f.g, new THREE.SphereGeometry(0.06, 14, 10), goldM, 0, 0.69, 0.225);
    bface.scale.z = 0.4;
    const ring = put(f.g, new THREE.TorusGeometry(0.09, 0.008, 6, 24), goldM, 0, 0.69, 0.226);
    ring.scale.y = 1.1;
    const glow = glowSprite(0xffd27a, 0.35, 0.6);
    glow.position.set(0, 0.69, 0.25);
    f.g.add(glow);
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 10. Thám Thủ: vươn hai tay lên cao, ngáp sau khi xả thiền
  (g) => {
    const f = figure({ robe: robeOf(10), sash: sashOf(10), face: 'yawn', head: { x: -0.22 }, armA: [[0.33, 1.06, 0], [0.17, 1.36, 0.03]], armB: [[-0.33, 1.06, 0], [-0.17, 1.36, 0.03]] });
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 11. Trầm Tư: cúi đầu, tay chống cằm ngẫm nghĩ
  (g) => {
    const f = figure({ robe: robeOf(11), sash: sashOf(11), face: 'closed', head: { x: 0.35 }, armA: [[0.3, 0.38, 0.25], [0.05, 0.84, 0.17]] });
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 12. Khoái Nhĩ: que nhỏ ngoáy tai, nét mặt thư thái
  (g) => {
    const f = figure({ robe: robeOf(12), sash: sashOf(12), face: 'smile', head: { z: -0.18 }, armA: [[0.38, 0.78, 0.12], [0.2, 0.98, 0.05]] });
    put(f.g, TempleWorld.capsuleBetween(f.handA.clone().add(V(0, 0.02, 0)), V(0.11, 0.96, 0.0), 0.006), M(0x8a6a3a));
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 13. Bố Đại: túi vải lớn sau lưng, bụng phệ, cười tươi
  (g) => {
    const f = figure({ robe: robeOf(13), sash: sashOf(13), face: 'smile', belly: true, armB: [[-0.38, 0.62, -0.02], [-0.25, 0.86, -0.08]] });
    const cloth = M(0xd8c8a0, { roughness: 0.95 });
    const sack = put(f.g, new THREE.SphereGeometry(1, 16, 12), cloth, -0.12, 0.72, -0.42);
    sack.scale.set(0.34, 0.4, 0.3);
    put(f.g, new THREE.ConeGeometry(0.08, 0.16, 10), cloth, -0.12, 1.15, -0.42);
    put(f.g, TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(-0.12, 1.1, -0.4), V(-0.25, 0.95, -0.2), V(-0.25, 0.86, -0.08)]), 8, 0.02, 0.02, 5), cloth);
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 14. Ba Tiêu: tĩnh tọa dưới gốc chuối rừng
  (g) => {
    const tree = bananaTree();
    tree.position.set(0.3, 0, -0.42);
    tree.scale.setScalar(0.95);
    g.add(tree);
    const f = figure({ robe: robeOf(14), sash: sashOf(14), face: 'closed', armA: LAP_A, armB: LAP_B });
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 15. Trường Mi: đôi lông mày trắng rất dài rủ xuống
  (g) => {
    const f = figure({ robe: robeOf(15), sash: sashOf(15), face: 'closed', longBrows: true, head: { x: 0.08 } });
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 16. Kháng Môn: cầm tích trượng có vòng khoen
  (g) => {
    const f = figure({ robe: robeOf(16), sash: sashOf(16), armB: [[-0.4, 0.5, 0.08], [-0.34, 0.66, 0.24]] });
    const goldM = M(0xd4a537, { metalness: 0.8, roughness: 0.3 });
    const hx = f.handB.x;
    const hz = f.handB.z;
    put(f.g, new THREE.CylinderGeometry(0.012, 0.012, 1.7, 8), M(0x5a3a1a), hx, 0.85, hz);
    const top = put(f.g, new THREE.TorusGeometry(0.08, 0.009, 6, 20), goldM, hx, 1.75, hz);
    top.scale.y = 1.4;
    for (let k = 0; k < 6; k++) {
      const r = put(f.g, new THREE.TorusGeometry(0.025, 0.005, 5, 10), goldM, hx + (k < 3 ? -0.07 : 0.07), 1.63 + (k % 3) * 0.05, hz);
      r.rotation.y = Math.PI / 2;
    }
    f.g.scale.setScalar(S);
    g.add(f.g);
  },
  // 17. Hàng Long: rồng uốn quanh, tay nâng ngọc thuần phục rồng
  (g, w) => {
    const f = figure({ robe: robeOf(17), sash: sashOf(17), head: { x: -0.15, y: 0.25 }, armA: [[0.36, 1.0, 0.12], [0.24, 1.22, 0.2]] });
    put(f.g, new THREE.SphereGeometry(0.05, 14, 10), M(0xfff6e0, { emissive: 0xffd27a, emissiveIntensity: 1.5 }), f.handA.x, f.handA.y + 0.06, f.handA.z);
    const glow = glowSprite(0xffd27a, 0.35, 0.7);
    glow.position.set(f.handA.x, f.handA.y + 0.06, f.handA.z);
    f.g.add(glow);
    f.g.scale.setScalar(S);
    g.add(f.g);
    const d = dragon(w);
    d.scale.setScalar(1.2);
    g.add(d);
  },
  // 18. Phục Hổ: hổ nằm phục bên cạnh, tay đặt lên đầu hổ
  (g) => {
    const f = figure({ robe: robeOf(18), sash: sashOf(18), face: 'calm', head: { x: 0.18, y: -0.3 }, armB: [[-0.4, 0.45, 0.2], [-0.36, 0.32, 0.46]] });
    f.g.scale.setScalar(S);
    g.add(f.g);
    const t = tiger();
    t.scale.setScalar(1.25);
    t.position.set(0.15, 0, 0.62);
    t.rotation.y = Math.PI;
    g.add(t);
  }
];
