// ĐỊA NGỤC NHÂN QUẢ: hang đá 3 hành lang zig-zag, mỗi hành lang 6 tầng, cuối hang là điện Địa Tạng Bồ Tát.
// Mỗi tầng là một tiểu cảnh mang tính biểu tượng (dụng cụ, đạo cụ, hiệu ứng) - không có cảnh máu me hành hình.
// Toạ độ (khớp src/shared/maps.ts): vách W1 z=11, W2 z=-2, W3 z=-15; khe nối ở x=±30.5; Địa Tạng (0, -29)
import * as THREE from 'three';
import { TempleWorld } from '../templeWorld.js';
import { createHaloTexture, getSmokeSpriteTexture } from '../proceduralTextures.js';
import { HELL_LEVELS } from './infoContent.js';
import { V, std, put, seeded, glowSprite, plaqueTexture, plaqueMesh, rockWall, boulderGeo, chain, groundPlane } from './helpers.js';

type Mats = ReturnType<typeof makeMats>;
interface Fx {
  flames: THREE.Mesh[];
  add: (fn: (d: number, t: number) => void) => void;
}

function makeMats() {
  return {
    rock: std(0x3a2a24, { roughness: 0.96, flatShading: true }),
    rockDark: std(0x241a16, { roughness: 0.98, flatShading: true }),
    dais: std(0x2e2420, { roughness: 0.9, flatShading: true }),
    iron: std(0x34343a, { metalness: 0.85, roughness: 0.42 }),
    steel: std(0xb8c0c8, { metalness: 0.95, roughness: 0.22 }),
    hot: std(0x4a0c04, { emissive: 0xff3a0a, emissiveIntensity: 1.1, metalness: 0.6, roughness: 0.5 }),
    bronze: std(0x7a4a22, { metalness: 0.8, roughness: 0.35 }),
    stone: std(0x5a4e44, { roughness: 0.95, flatShading: true }),
    grey: std(0x6a6e74, { roughness: 0.9, flatShading: true }),
    wood: std(0x4a2a18, { roughness: 0.85 }),
    bamboo: std(0xa8854a, { roughness: 0.8 }),
    ice: std(0xbfe6ff, { transparent: true, opacity: 0.85, roughness: 0.08, metalness: 0.1, emissive: 0x2a6ab0, emissiveIntensity: 0.7 }),
    snow: std(0xe8f2ff, { roughness: 0.9, emissive: 0x3a5a8a, emissiveIntensity: 0.3 }),
    blood: std(0x4a0404, { roughness: 0.12, metalness: 0.2, emissive: 0x4a0202, emissiveIntensity: 0.9 }),
    oil: std(0xffa030, { emissive: 0xff7a10, emissiveIntensity: 1.3, roughness: 0.2 }),
    mirror: std(0x9fc8ff, { metalness: 1, roughness: 0.05, emissive: 0x3a6ad0, emissiveIntensity: 0.6 }),
    coal: std(0x2a0a04, { emissive: 0xff4a0a, emissiveIntensity: 1.4, flatShading: true }),
    earth: std(0x4a3424, { roughness: 1, flatShading: true }),
    flour: std(0xd8d0c0, { roughness: 1 }),
    flameOuter: new THREE.MeshBasicMaterial({ color: 0xff5a12, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    flameInner: new THREE.MeshBasicMaterial({ color: 0xffd04a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
  };
}

// Ngọn lửa: 2 hình nón lồng nhau, lập loè theo thời gian
const flameGeo = new THREE.ConeGeometry(0.22, 0.9, 7, 1, true).translate(0, 0.45, 0);
function flame(parent: THREE.Object3D, M: Mats, fx: Fx, x: number, y: number, z: number, s = 1) {
  const g = new THREE.Group();
  const o = new THREE.Mesh(flameGeo, M.flameOuter);
  const i = new THREE.Mesh(flameGeo, M.flameInner);
  i.scale.set(0.55, 0.65, 0.55);
  g.add(o, i);
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  g.userData.phase = Math.random() * 10;
  parent.add(g);
  fx.flames.push(o);
  return g;
}

// Mặt nền đá bazan tối có vết nứt dung nham phát sáng
function lavaFloorTextures() {
  const rnd = seeded(91);
  const make = (glowOnly: boolean) => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = glowOnly ? '#000' : '#1e1512';
    g.fillRect(0, 0, 512, 512);
    if (!glowOnly) {
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(${40 + rnd() * 30},${26 + rnd() * 16},${20 + rnd() * 12},0.5)`;
        g.beginPath();
        g.arc(rnd() * 512, rnd() * 512, 6 + rnd() * 26, 0, Math.PI * 2);
        g.fill();
      }
    }
    const r2 = seeded(17);
    for (let k = 0; k < 16; k++) {
      let x = r2() * 512;
      let y = r2() * 512;
      g.strokeStyle = glowOnly ? '#ff6a1a' : '#a8320c';
      g.lineWidth = 1 + r2() * 2.5;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 9; s++) {
        x += (r2() - 0.5) * 70;
        y += (r2() - 0.5) * 70;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(7, 6);
    if (!glowOnly) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: make(false), glow: make(true) };
}

export function buildHellMap(w: TempleWorld) {
  w.particleArea = [-33, 33, -33, 24, 6];
  const M = makeMats();
  const flames: THREE.Mesh[] = [];
  const fx: Fx = { flames, add: fn => w.animators.push(fn) };

  // ---------- Nền hang ----------
  const tex = lavaFloorTextures();
  groundPlane(w, 72, 62, 0, -5, new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.glow, emissive: 0xff4a10, emissiveIntensity: 0.55, roughness: 0.9 }), 0.01);
  groundPlane(w, 400, 400, 0, 0, std(0x0c0605, { roughness: 1 }), -0.03);

  // ---------- Vách đá: tường bao + 3 vách ngăn có khe nối zig-zag ----------
  const H = 5.6;
  let sd = 300;
  const walls: [number, number, number, number][] = [
    [-35, 35, -35.2, -34], [-35, 35, 24.5, 25.7], [-35.2, -34, -35, 25.7], [34, 35.2, -35, 25.7],
    [-34, 27, 10.5, 11.5], [-27, 34, -2.5, -1.5], [-34, 27, -15.5, -14.5]
  ];
  for (const [x0, x1, z0, z1] of walls) rockWall(w, x0, x1, z0, z1, H, M.rock, sd++);

  // Nhũ đá ven tường phía nam mỗi hành lang
  const rnd = seeded(77);
  for (const zS of [23.8, 9.8, -3.2]) {
    for (let x = -31; x < 32; x += 4 + rnd() * 3) {
      if (Math.abs(x - 30.5) < 4 || Math.abs(x + 30.5) < 4) continue;
      const h = 0.8 + rnd() * 1.8;
      const m = put(w.root, new THREE.ConeGeometry(0.35 + rnd() * 0.3, h, 6), M.rockDark, x, h / 2, zS + (rnd() - 0.5) * 0.3);
      m.rotation.y = rnd() * 3;
      w.collisionCircles.push({ x, z: zS, r: 0.45 });
    }
  }

  // Lò than (brazier) dọc lối đi
  const brazier = (x: number, z: number) => {
    const g = new THREE.Group();
    put(g, new THREE.CylinderGeometry(0.08, 0.14, 1.0, 6), M.iron, 0, 0.5, 0);
    put(g, new THREE.CylinderGeometry(0.45, 0.25, 0.32, 10, 1, true), M.iron, 0, 1.12, 0);
    for (let k = 0; k < 5; k++) put(g, new THREE.DodecahedronGeometry(0.12), M.coal, (rnd() - 0.5) * 0.4, 1.1, (rnd() - 0.5) * 0.4);
    flame(g, M, fx, 0, 1.15, 0, 0.9);
    g.position.set(x, 0, z);
    w.root.add(g);
    w.collisionCircles.push({ x, z, r: 0.5 });
  };

  // ---------- Quỷ Môn Quan + bia Luật Nhân Quả ở lối vào ----------
  const gate = new THREE.Group();
  for (const z of [12.6, 23.4]) {
    put(gate, new THREE.CylinderGeometry(0.6, 0.75, 5.2, 8), M.stone, 0, 2.6, z - 18);
    w.collisionCircles.push({ x: -26, z, r: 0.8 });
  }
  put(gate, new THREE.BoxGeometry(1.0, 0.9, 12.4), M.stone, 0, 5.5, 0);
  put(gate, new THREE.BoxGeometry(1.4, 0.3, 13.2), M.rockDark, 0, 6.05, 0);
  const gateTex = plaqueTexture([{ text: 'QUỶ MÔN QUAN', size: 54, color: '#ffcf8a' }], { w: 640, h: 140, bg: '#2a0805', border: '#a8320c' });
  const gatePlaque = plaqueMesh(gateTex, 5.2, 1.15, 0.6);
  gatePlaque.position.set(-0.52, 5.5, 0);
  gatePlaque.rotation.y = -Math.PI / 2;
  gate.add(gatePlaque);
  gate.position.set(-26, 0, 18);
  w.root.add(gate);
  brazier(-27.5, 13.6);
  brazier(-27.5, 22.4);

  const intro = new THREE.Group();
  put(intro, new THREE.BoxGeometry(2.4, 0.4, 0.9), M.rockDark, 0, 0.2, 0);
  put(intro, new THREE.BoxGeometry(2.0, 2.6, 0.32), M.stone, 0, 1.7, 0);
  const introTex = plaqueTexture([
    { text: 'LUẬT NHÂN QUẢ', size: 40, color: '#ffcf8a' },
    { text: 'Gieo nhân nào, gặt quả nấy', size: 24, color: '#fde7c7', weight: '600' },
    { text: '18 tầng địa ngục', size: 20, color: '#f5b38a', weight: '600' }
  ], { w: 380, h: 480, bg: '#3a0d08', border: '#a8320c' });
  const introFace = plaqueMesh(introTex, 1.7, 2.15, 0.5);
  introFace.position.set(0, 1.75, 0.17);
  intro.add(introFace);
  intro.position.set(-30.8, 0, 13.4);
  intro.rotation.y = 0.35;
  w.root.add(intro);
  w.collisionCircles.push({ x: -30.8, z: 13.4, r: 1.3 });
  w.infoPoints.push({ id: 'hell-0', x: -30.6, z: 15.6, r: 2.6 });

  // ---------- 18 tầng ----------
  const C1X = [-19, -11, -3, 5, 13, 21];
  const corridors = [
    { zWall: 11.5, xs: C1X },
    { zWall: -1.5, xs: [...C1X].reverse() },
    { zWall: -14.5, xs: C1X }
  ];
  const builders = [lv1, lv2, lv3, lv4, lv5, lv6, lv7, lv8, lv9, lv10, lv11, lv12, lv13, lv14, lv15, lv16, lv17, lv18];
  const coldLevels = new Set([4, 8, 14]);
  HELL_LEVELS.forEach((L, idx) => {
    const c = corridors[Math.floor(idx / 6)];
    const x = c.xs[idx % 6];
    const zc = c.zWall + 1.9;
    // bệ đá của tiểu cảnh (không đi lên được)
    put(w.root, new THREE.BoxGeometry(6.4, 0.3, 3.8), M.dais, x, 0.15, zc);
    const rim = put(w.root, new THREE.BoxGeometry(6.5, 0.06, 0.1), coldLevels.has(L.n) ? M.ice : M.hot, x, 0.3, zc + 1.9);
    rim.castShadow = false;
    w.collisionBoxes.push({ minX: x - 3.2, maxX: x + 3.2, minZ: c.zWall - 0.2, maxZ: zc + 2.0, type: 'impassable' });
    const g = new THREE.Group();
    g.position.set(x, 0.3, zc);
    w.root.add(g);
    builders[idx](g, M, fx, w);
    // biển tên tầng gắn trên vách đá
    const t = plaqueTexture([
      { text: `TẦNG ${L.n}`, size: 30, color: '#f5b38a' },
      { text: `${L.short} ĐỊA NGỤC`, size: 38, color: '#ffe0a8' },
      { text: L.meaning, size: 20, color: '#e8c4a8', weight: '600' }
    ], { w: 560, h: 190, bg: '#240604', border: coldLevels.has(L.n) ? '#4a8ad0' : '#a8320c' });
    const plaque = plaqueMesh(t, 4.4, 1.5, 0.55);
    plaque.position.set(x, 4.1, c.zWall + 0.45);
    w.root.add(plaque);
    const pool = w.addLightPool(x, zc + 1.6, 3.4, 0.4);
    if (coldLevels.has(L.n)) (pool.material as THREE.MeshBasicMaterial).color.setHex(0x5aa0ff);
    else (pool.material as THREE.MeshBasicMaterial).color.setHex(0xff5a1a);
    w.infoPoints.push({ id: `hell-${L.n}`, x, z: c.zWall + 5.4, r: 3.0 });
  });

  // Đèn điểm đỏ rực: 2 ngọn mỗi hành lang (cường độ cố định, không theo ngày/đêm)
  for (const c of corridors) {
    for (const x of [-12, 12]) {
      const l = new THREE.PointLight(0xff5a2a, 9, 22, 1.4);
      l.position.set(x, 3.4, c.zWall + 4);
      w.root.add(l);
    }
  }

  // ---------- Điện Địa Tạng Bồ Tát cuối hang ----------
  const goldFloor = groundPlane(w, 18, 18, 0, -26, new THREE.MeshStandardMaterial({ map: createHaloTexture(), color: 0xffc46a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), 0.04);
  goldFloor.renderOrder = 2;
  const shrine = new THREE.Group();
  put(shrine, new THREE.CylinderGeometry(3.2, 3.5, 0.5, 8), M.stone, 0, 0.25, 0);
  put(shrine, new THREE.CylinderGeometry(2.5, 2.7, 0.5, 8), std(0x7a1c12, { roughness: 0.55 }), 0, 0.75, 0);
  const lotusMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
  put(shrine, TempleWorld.lotusThrone([
    { n: 16, r: 1.5, y: 0, len: 0.8, wid: 0.45, tilt: 0.8, c0: 0xf7d9e4, c1: 0xe0628f },
    { n: 14, r: 1.35, y: 0.2, len: 0.7, wid: 0.42, tilt: 0.45, c0: 0xfbe3ec, c1: 0xe8789f }
  ]), lotusMat, 0, 1.0, 0);
  const ksitigarbha = makeKsitigarbha(w);
  ksitigarbha.scale.setScalar(2.4);
  ksitigarbha.position.y = 1.25;
  shrine.add(ksitigarbha);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: createHaloTexture(), color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.position.set(0, 6.6, -1.2);
  shrine.add(halo);
  fx.add((_d, t) => { (halo.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 1.1) * 0.1; });
  // đèn sen quanh bệ
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const lamp = put(shrine, new THREE.SphereGeometry(0.16, 10, 8), std(0xfff0c8, { emissive: 0xffc46a, emissiveIntensity: 1.6 }), Math.sin(a) * 3.0, 0.62, Math.cos(a) * 3.0);
    lamp.scale.y = 0.7;
  }
  shrine.position.set(0, 0, -29);
  w.root.add(shrine);
  w.collisionCircles.push({ x: 0, z: -29, r: 3.5 });
  const holy = new THREE.PointLight(0xffd08a, 14, 26, 1.3);
  holy.position.set(0, 6, -24.5);
  w.root.add(holy);
  const dtTex = plaqueTexture([
    { text: 'NAM MÔ ĐẠI NGUYỆN', size: 34, color: '#fde68a' },
    { text: 'ĐỊA TẠNG VƯƠNG BỒ TÁT', size: 44, color: '#fff1c1' }
  ], { w: 760, h: 200, bg: '#5c1a12', border: '#d4a537' });
  const dtPlaque = plaqueMesh(dtTex, 7.6, 2.0, 0.55);
  dtPlaque.position.set(0, 4.6, -33.35);
  w.root.add(dtPlaque);

  w.buildGrandBronzeUrn(0, -21);
  for (const cz of [-18.2, -16.8]) for (const cx of [-6, -4.6, -3.2, 3.2, 4.6, 6]) w.createRoundCushion(cx, cz);
  brazier(-9, -22);
  brazier(9, -22);
  w.infoPoints.push({ id: 'hell-19', x: 0, z: -23.6, r: 3.0 });

  // ---------- Hoạt ảnh lửa chung ----------
  fx.add((_d, t) => {
    for (const f of flames) {
      const g = f.parent!;
      const p = g.userData.phase as number;
      g.scale.y = g.scale.x * (0.85 + 0.25 * Math.sin(t * 11 + p) + 0.1 * Math.sin(t * 23 + p * 2));
      g.rotation.y = t * 0.8 + p;
    }
  });
}

// ===================== ĐỊA TẠNG BỒ TÁT =====================
// Tượng Bồ Tát thếp vàng đội mũ Tỳ Lư, tay cầm ngọc minh châu, bên cạnh là tích trượng
function makeKsitigarbha(w: TempleWorld) {
  const fig = w.makeQuanAmFigure('gold', 'lotus');
  fig.rotation.y = 0;
  fig.position.y = 0;
  // đổi đoá sen trên tay thành viên ngọc minh châu toả sáng
  const lotus = fig.children.find(c => c.position.distanceTo(V(0, 1.62, 0.33)) < 1e-3) as THREE.Mesh | undefined;
  if (lotus) {
    lotus.geometry.dispose();
    lotus.geometry = new THREE.SphereGeometry(0.075, 16, 12);
    lotus.material = std(0xfff6e0, { emissive: 0xffd27a, emissiveIntensity: 1.6, roughness: 0.15 });
  }
  const pearlGlow = glowSprite(0xffd27a, 0.5, 0.8);
  pearlGlow.position.set(0, 1.62, 0.36);
  fig.add(pearlGlow);
  // tích trượng: cán dài + vòng khoen trên đỉnh
  const gold = std(0xd8ad45, { metalness: 0.8, roughness: 0.3 });
  put(fig, new THREE.CylinderGeometry(0.014, 0.014, 2.9, 8), gold, 0.46, 1.45, 0.18);
  const top = put(fig, new THREE.TorusGeometry(0.1, 0.01, 6, 20), gold, 0.46, 3.0, 0.18);
  top.scale.y = 1.4;
  for (let k = 0; k < 6; k++) {
    const r = put(fig, new THREE.TorusGeometry(0.03, 0.006, 5, 10), gold, 0.46 + (k < 3 ? -0.08 : 0.08), 2.86 + (k % 3) * 0.06, 0.18);
    r.rotation.y = Math.PI / 2;
  }
  const holder = new THREE.Group();
  holder.add(fig);
  return holder;
}

// ===================== TIỂU CẢNH 18 TẦNG =====================
// Mỗi hàm dựng trong nhóm g (gốc ở giữa bệ, mặt trước hướng +z, bệ sâu từ z=-1.9 tới 1.9)

// 1. Kìm sắt khổng lồ trên đe đá, xích sắt treo
function lv1(g: THREE.Group, M: Mats, fx: Fx) {
  put(g, boulderGeo(0.9, 1), M.stone, 0, 0.5, -0.3).scale.set(1.4, 0.7, 0.9);
  const pivot = new THREE.Group();
  pivot.position.set(0, 1.25, -0.2);
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const a = new THREE.Group();
    put(a, new THREE.BoxGeometry(0.16, 2.3, 0.12).translate(0, 0.35, 0), M.iron);
    const jaw = put(a, new THREE.TorusGeometry(0.28, 0.07, 6, 12, Math.PI * 0.8), M.hot, side * -0.18, 1.55, 0);
    jaw.rotation.z = side > 0 ? Math.PI * 0.6 : -Math.PI * 0.4;
    pivot.add(a);
    a.userData.side = side;
    arms.push(a);
  }
  put(pivot, new THREE.CylinderGeometry(0.11, 0.11, 0.3, 10).rotateX(Math.PI / 2), M.bronze);
  g.add(pivot);
  for (const [x, z] of [[-2.2, -1.2], [2.2, -1.2], [-1.4, -1.6], [1.5, -1.5]]) chain(g, M.iron, x, 4.2, z, 14 + Math.floor(Math.random() * 4));
  fx.add((_d, t) => { for (const a of arms) a.rotation.z = a.userData.side * (0.22 + 0.1 * Math.sin(t * 1.3)); });
}

// 2. Kéo sắt khổng lồ dựng đứng, đóng mở chậm
function lv2(g: THREE.Group, M: Mats, fx: Fx) {
  put(g, new THREE.BoxGeometry(1.8, 0.5, 1.2), M.stone, 0, 0.25, -0.2);
  const shape = new THREE.Shape();
  shape.moveTo(-0.05, 0);
  shape.lineTo(0.2, 0.12);
  shape.lineTo(0.05, 2.1);
  shape.lineTo(-0.06, 1.95);
  shape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
  const pivot = new THREE.Group();
  pivot.position.set(0, 1.5, -0.2);
  const blades: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const b = new THREE.Group();
    const bl = put(b, bladeGeo, M.steel, 0, -0.1, side * 0.03);
    bl.scale.x = side;
    const ring = put(b, new THREE.TorusGeometry(0.24, 0.06, 6, 16), M.hot, side * 0.12, -0.55, side * 0.03);
    ring.scale.y = 1.3;
    put(b, new THREE.BoxGeometry(0.08, 0.3, 0.05), M.iron, side * 0.06, -0.25, side * 0.03);
    b.userData.side = side;
    pivot.add(b);
    blades.push(b);
  }
  put(pivot, new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10).rotateX(Math.PI / 2), M.bronze);
  g.add(pivot);
  fx.add((_d, t) => { for (const b of blades) b.rotation.z = b.userData.side * (0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.9))); });
}

// 3. Cây sắt mọc đầy chông nhọn, đầu chông nung đỏ
function lv3(g: THREE.Group, M: Mats, _fx: Fx, w: TempleWorld) {
  const rnd = seeded(303);
  const base = V(0, 0, -0.4);
  const top = V(0.1, 2.4, -0.4);
  put(g, w.makeLimb(base, top, 0.26, 0.14), M.iron);
  const segs: [THREE.Vector3, THREE.Vector3][] = [[base, top]];
  for (let i = 0; i < 7; i++) {
    const s = base.clone().lerp(top, 0.35 + rnd() * 0.6);
    const a = rnd() * Math.PI * 2;
    const e = s.clone().add(V(Math.cos(a) * (1 + rnd() * 0.8), 0.4 + rnd() * 0.9, Math.sin(a) * 0.7));
    put(g, w.makeLimb(s, e, 0.1, 0.04), M.iron);
    segs.push([s, e]);
  }
  const spike = new THREE.ConeGeometry(0.035, 0.32, 5).translate(0, 0.16, 0);
  const inst = new THREE.InstancedMesh(spike, M.hot, 150);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let k = 0; k < 150; k++) {
    const [a, b] = segs[k % segs.length];
    const p = a.clone().lerp(b, 0.1 + rnd() * 0.9);
    const d = V(rnd() - 0.5, rnd() - 0.2, rnd() - 0.5).normalize();
    q.setFromUnitVectors(V(0, 1, 0), d);
    m.compose(p, q, V(1, 0.7 + rnd() * 0.8, 1));
    inst.setMatrixAt(k, m);
  }
  g.add(inst);
}

// 4. Nghiệt Kính Đài: gương soi tội trên giá đỡ, mặt gương ánh lên
function lv4(g: THREE.Group, M: Mats, fx: Fx) {
  put(g, new THREE.BoxGeometry(3.4, 0.4, 1.0), M.stone, 0, 0.2, -0.6);
  for (const x of [-1.45, 1.45]) put(g, new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), M.wood, x, 1.8, -0.6);
  put(g, new THREE.BoxGeometry(3.4, 0.18, 0.25), M.wood, 0, 3.4, -0.6);
  const frame = put(g, new THREE.TorusGeometry(1.2, 0.1, 8, 40), M.bronze, 0, 1.95, -0.6);
  frame.castShadow = true;
  const mirror = put(g, new THREE.CircleGeometry(1.15, 40), M.mirror, 0, 1.95, -0.58);
  const glow = glowSprite(0x7ab0ff, 3.2, 0.35);
  glow.position.set(0, 1.95, -0.45);
  g.add(glow);
  fx.add((_d, t) => {
    (mirror.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45 + 0.35 * Math.sin(t * 1.4);
    glow.material.opacity = 0.25 + 0.15 * Math.sin(t * 1.4);
  });
}

// 5. Lồng hấp tre chồng tầng trên bếp lửa, hơi nóng bốc lên
function lv5(g: THREE.Group, M: Mats, fx: Fx) {
  put(g, new THREE.BoxGeometry(2.6, 0.85, 2.0), M.stone, 0, 0.42, -0.4);
  put(g, new THREE.PlaneGeometry(1.0, 0.5), std(0x3a0a02, { emissive: 0xff5a10, emissiveIntensity: 1.6 }), 0, 0.35, 0.61);
  flame(g, M, fx, -0.25, 0.1, 0.65, 0.5);
  flame(g, M, fx, 0.25, 0.1, 0.65, 0.45);
  let y = 0.85;
  for (let k = 0; k < 3; k++) {
    put(g, new THREE.CylinderGeometry(0.95, 0.95, 0.48, 24), M.bamboo, 0, y + 0.24, -0.4);
    const band = put(g, new THREE.TorusGeometry(0.96, 0.03, 5, 24), M.wood, 0, y + 0.06, -0.4);
    band.rotation.x = Math.PI / 2;
    y += 0.5;
  }
  put(g, new THREE.ConeGeometry(1.0, 0.4, 24), M.bamboo, 0, y + 0.2, -0.4);
  const steam: THREE.Sprite[] = [];
  for (let k = 0; k < 8; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getSmokeSpriteTexture(), color: 0xf0e0d0, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.phase = k / 8;
    g.add(sp);
    steam.push(sp);
  }
  fx.add((_d, t) => {
    for (const sp of steam) {
      const lt = (sp.userData.phase + t * 0.22) % 1;
      sp.position.set(Math.sin(t + lt * 7) * 0.3, y + 0.4 + lt * 2.2, -0.4 + Math.cos(t * 0.8 + lt * 5) * 0.25);
      sp.scale.setScalar(0.5 + lt * 1.4);
      sp.material.opacity = Math.sin(lt * Math.PI) * 0.4;
    }
  });
}

// 6. Cột đồng nung đỏ, xích quấn quanh, than hồng dưới chân
function lv6(g: THREE.Group, M: Mats, fx: Fx) {
  const hotCopper = std(0x6a2a10, { emissive: 0xff4a10, emissiveIntensity: 1.0, metalness: 0.7, roughness: 0.35 });
  put(g, new THREE.CylinderGeometry(0.9, 1.0, 0.35, 10), M.stone, 0, 0.17, -0.3);
  put(g, new THREE.CylinderGeometry(0.42, 0.42, 3.0, 16), hotCopper, 0, 1.85, -0.3);
  put(g, new THREE.CylinderGeometry(0.55, 0.5, 0.2, 16), M.bronze, 0, 3.4, -0.3);
  for (const y of [0.9, 1.6, 2.3, 3.0]) {
    const r = put(g, new THREE.TorusGeometry(0.46, 0.05, 6, 20), M.iron, 0, y, -0.3);
    r.rotation.x = Math.PI / 2;
  }
  const rnd = seeded(66);
  for (let k = 0; k < 14; k++) {
    const a = rnd() * Math.PI * 2;
    put(g, new THREE.DodecahedronGeometry(0.12 + rnd() * 0.1), M.coal, Math.cos(a) * (0.7 + rnd() * 0.3), 0.4, -0.3 + Math.sin(a) * (0.7 + rnd() * 0.3));
  }
  flame(g, M, fx, -0.8, 0.3, 0.3, 0.6);
  flame(g, M, fx, 0.8, 0.3, 0.2, 0.55);
  fx.add((_d, t) => { hotCopper.emissiveIntensity = 0.9 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.1)); });
}

// 7. Núi đá cắm đầy lưỡi dao
function lv7(g: THREE.Group, M: Mats) {
  const rnd = seeded(707);
  const mountain = put(g, new THREE.ConeGeometry(2.0, 2.8, 9, 3), M.stone, 0, 1.4, -0.3);
  mountain.geometry = boulderGeo(1, 707);
  mountain.scale.set(2.0, 1.5, 1.4);
  mountain.position.y = 1.0;
  const blade = new THREE.BoxGeometry(0.07, 0.55, 0.015).translate(0, 0.27, 0);
  const inst = new THREE.InstancedMesh(blade, M.steel, 80);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let k = 0; k < 80; k++) {
    const a = rnd() * Math.PI * 2;
    const h = rnd();
    const r = 1 - h * 0.85;
    const p = V(Math.cos(a) * r * 1.9, 0.2 + h * 2.3, -0.3 + Math.sin(a) * r * 1.3);
    const d = V(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize();
    q.setFromUnitVectors(V(0, 1, 0), d);
    m.compose(p, q, V(1, 0.8 + rnd() * 0.6, 1));
    inst.setMatrixAt(k, m);
  }
  g.add(inst);
}

// 8. Núi băng: tinh thể băng xanh lạnh, tuyết phủ
function lv8(g: THREE.Group, M: Mats) {
  const rnd = seeded(808);
  const mound = put(g, new THREE.SphereGeometry(2.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.snow, 0, 0, -0.4);
  mound.scale.set(1.3, 0.45, 0.85);
  for (let k = 0; k < 11; k++) {
    const c = put(g, new THREE.OctahedronGeometry(1, 0), M.ice, (rnd() - 0.5) * 3.8, 0, -0.4 + (rnd() - 0.5) * 1.8);
    const h = 0.8 + rnd() * 1.9;
    c.scale.set(0.25 + rnd() * 0.2, h, 0.25 + rnd() * 0.2);
    c.position.y = h * 0.6;
    c.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4);
  }
  const cold = new THREE.PointLight(0x6ab0ff, 4, 7, 1.5);
  cold.position.set(0, 2, 0.5);
  g.add(cold);
}

// 9. Vạc dầu sôi trên lửa
function lv9(g: THREE.Group, M: Mats, fx: Fx) {
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    put(g, new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6), M.iron, Math.cos(a) * 0.9, 0.35, -0.3 + Math.sin(a) * 0.9);
  }
  const pot = put(g, new THREE.LatheGeometry([V(0, 0.6, 0), V(0.8, 0.62, 0), V(1.25, 0.95, 0), V(1.35, 1.35, 0), V(1.25, 1.62, 0), V(1.32, 1.7, 0)].map(v => new THREE.Vector2(v.x, v.y)), 28), M.iron, 0, 0, -0.3);
  (pot.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  put(g, new THREE.CircleGeometry(1.22, 28).rotateX(-Math.PI / 2), M.oil, 0, 1.55, -0.3);
  const bubbles: THREE.Mesh[] = [];
  const rnd = seeded(909);
  for (let k = 0; k < 12; k++) {
    const b = put(g, new THREE.SphereGeometry(0.09, 8, 6), M.oil, (rnd() - 0.5) * 1.8, 1.56, -0.3 + (rnd() - 0.5) * 1.6);
    b.userData.phase = rnd() * 6;
    bubbles.push(b);
  }
  for (let k = 0; k < 5; k++) flame(g, M, fx, (k - 2) * 0.32, 0.05, -0.3 + (k % 2 ? 0.25 : -0.2), 0.7);
  fx.add((_d, t) => {
    for (const b of bubbles) {
      const s = Math.max(0.01, Math.sin(t * 3 + b.userData.phase));
      b.scale.setScalar(s);
    }
  });
}

// 10. Hang trâu: hố đá và đôi trâu đá mắt đỏ lao vào nhau
function lv10(g: THREE.Group, M: Mats) {
  put(g, new THREE.CircleGeometry(2.2, 20).rotateX(-Math.PI / 2), M.rockDark, 0, 0.02, -0.2);
  const rnd = seeded(1010);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    put(g, boulderGeo(0.22 + rnd() * 0.12, 1010 + k), M.stone, Math.cos(a) * 2.35, 0.15, -0.2 + Math.sin(a) * 1.75);
  }
  const eye = std(0x3a0000, { emissive: 0xff2a0a, emissiveIntensity: 2 });
  for (const side of [-1, 1]) {
    const b = new THREE.Group();
    put(b, new THREE.CapsuleGeometry(0.42, 1.0, 6, 12).rotateZ(Math.PI / 2), M.grey, 0, 0.95, 0);
    for (const [lx, lz] of [[-0.45, -0.22], [-0.45, 0.22], [0.45, -0.22], [0.45, 0.22]]) put(b, new THREE.CylinderGeometry(0.09, 0.08, 0.6, 6), M.grey, lx, 0.32, lz);
    const head = put(b, new THREE.BoxGeometry(0.5, 0.42, 0.42), M.grey, 1.0, 0.85, 0);
    head.rotation.z = -0.4;
    for (const hz of [-1, 1]) {
      const horn = put(b, new THREE.TorusGeometry(0.28, 0.05, 6, 12, Math.PI * 0.9), M.flour, 1.05, 1.12, hz * 0.22);
      horn.rotation.set(0, hz * 0.5, Math.PI * 0.1);
      put(b, new THREE.SphereGeometry(0.04, 6, 5), eye, 1.24, 0.92, hz * 0.14);
    }
    b.position.set(-side * 1.05, 0, -0.2);
    b.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(b);
  }
}

// 11. Đá tảng treo lơ lửng trên giá gỗ, đung đưa trên miệng hố
function lv11(g: THREE.Group, M: Mats, fx: Fx) {
  put(g, new THREE.CircleGeometry(1.6, 20).rotateX(-Math.PI / 2), std(0x0a0404), 0, 0.02, -0.2);
  for (const x of [-2.4, 2.4]) put(g, new THREE.CylinderGeometry(0.14, 0.18, 3.8, 8), M.wood, x, 1.9, -0.2);
  put(g, new THREE.BoxGeometry(5.2, 0.24, 0.3), M.wood, 0, 3.75, -0.2);
  const swings: THREE.Group[] = [];
  for (const [x, r, n] of [[-0.9, 0.7, 6], [0.8, 0.6, 8]] as [number, number, number][]) {
    const s = new THREE.Group();
    s.position.set(x, 3.7, -0.2);
    chain(s, M.iron, 0, 0, 0, n);
    put(s, boulderGeo(r, Math.round(x * 100)), M.stone, 0, -n * 0.125 - r * 0.8, 0);
    s.userData.phase = x * 3;
    g.add(s);
    swings.push(s);
  }
  fx.add((_d, t) => { for (const s of swings) s.rotation.z = Math.sin(t * 0.9 + s.userData.phase) * 0.07; });
}

// 12. Cối giã gạo khổng lồ: chày gỗ trên đòn bẩy giã lên xuống
function lv12(g: THREE.Group, M: Mats, fx: Fx) {
  put(g, new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.85, 0), new THREE.Vector2(0.95, 0.5), new THREE.Vector2(0.85, 1.0), new THREE.Vector2(0.55, 1.0), new THREE.Vector2(0.4, 0.45), new THREE.Vector2(0, 0.4)], 20), M.stone, -1.2, 0, -0.2);
  put(g, new THREE.BoxGeometry(0.5, 1.0, 0.5), M.wood, 1.0, 0.5, -0.2);
  const lever = new THREE.Group();
  lever.position.set(1.0, 1.1, -0.2);
  put(lever, new THREE.BoxGeometry(3.6, 0.22, 0.26), M.wood, -0.6, 0, 0);
  put(lever, new THREE.CylinderGeometry(0.18, 0.2, 1.2, 10), M.wood, -2.2, -0.5, 0);
  put(lever, new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8).rotateX(Math.PI / 2), M.iron, 0, 0, 0);
  g.add(lever);
  put(g, new THREE.ConeGeometry(0.4, 0.25, 12), M.flour, -1.2, 1.0, -0.2);
  fx.add((_d, t) => {
    const c = (t * 0.55) % 1;
    const up = c < 0.75 ? Math.sin((c / 0.75) * Math.PI * 0.5) : 1 - (c - 0.75) / 0.25;
    lever.rotation.z = -0.03 - up * 0.32;
  });
}

// 13. Bể máu: hồ nước đỏ thẫm gợn sóng, sương đỏ
function lv13(g: THREE.Group, M: Mats, fx: Fx) {
  const rim = put(g, new THREE.TorusGeometry(2.1, 0.22, 8, 36), M.stone, 0, 0.12, -0.2);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1.25, 0.8, 1);
  const pool = put(g, new THREE.CircleGeometry(2.1, 36).rotateX(-Math.PI / 2), M.blood, 0, 0.1, -0.2);
  pool.scale.set(1.25, 1, 0.8);
  const ripples: THREE.Mesh[] = [];
  for (let k = 0; k < 3; k++) {
    const r = put(g, new THREE.RingGeometry(0.9, 1.0, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xa01010, transparent: true, opacity: 0.4, depthWrite: false }), 0, 0.12, -0.2);
    r.userData.phase = k / 3;
    ripples.push(r);
  }
  const mist: THREE.Sprite[] = [];
  for (let k = 0; k < 5; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getSmokeSpriteTexture(), color: 0xc02020, transparent: true, depthWrite: false, opacity: 0.25 }));
    sp.scale.setScalar(1.6);
    sp.userData.phase = k * 1.3;
    g.add(sp);
    mist.push(sp);
  }
  fx.add((_d, t) => {
    for (const r of ripples) {
      const lt = (r.userData.phase + t * 0.25) % 1;
      r.scale.setScalar(0.2 + lt * 1.9);
      (r.material as THREE.MeshBasicMaterial).opacity = (1 - lt) * 0.45;
    }
    for (const sp of mist) sp.position.set(Math.sin(t * 0.3 + sp.userData.phase) * 1.8, 0.5 + Math.sin(t * 0.5 + sp.userData.phase) * 0.15, -0.2 + Math.cos(t * 0.25 + sp.userData.phase) * 1.0);
  });
}

// 14. Thành Uổng Tử: cổng đá đổ nát, cây khô, hồn ma xanh nhạt trôi lững lờ
function lv14(g: THREE.Group, M: Mats, fx: Fx, w: TempleWorld) {
  const pale = std(0x6a7480, { roughness: 0.95, flatShading: true });
  for (const x of [-1.3, 1.3]) put(g, new THREE.BoxGeometry(0.5, 2.6, 0.5), pale, x, 1.3, -0.8);
  const lintel = put(g, new THREE.BoxGeometry(3.4, 0.4, 0.55), pale, 0.2, 2.75, -0.8);
  lintel.rotation.z = -0.12;
  put(g, boulderGeo(0.35, 141), pale, -2.0, 0.2, -0.2);
  const bark = std(0x3a3a3e, { roughness: 1 });
  const base = V(2.2, 0, -0.9);
  const top = V(2.0, 1.8, -0.9);
  put(g, w.makeLimb(base, top, 0.14, 0.07), bark);
  for (const [dx, dy] of [[0.7, 0.6], [-0.6, 0.5], [0.3, 0.9]]) put(g, w.makeLimb(top, top.clone().add(V(dx, dy, 0.1)), 0.06, 0.02), bark);
  const ghosts: THREE.Sprite[] = [];
  for (let k = 0; k < 7; k++) {
    const sp = glowSprite(0x9ad8ff, 0.5 + Math.random() * 0.3, 0.55);
    sp.userData.phase = k * 0.9;
    g.add(sp);
    ghosts.push(sp);
  }
  fx.add((_d, t) => {
    for (const sp of ghosts) {
      const p = sp.userData.phase;
      sp.position.set(Math.sin(t * 0.35 + p) * 2.4, 0.8 + Math.sin(t * 0.6 + p * 2) * 0.5 + (p % 1.5), -0.3 + Math.cos(t * 0.3 + p) * 1.1);
      sp.material.opacity = 0.3 + 0.25 * Math.sin(t * 1.5 + p);
    }
  });
}

// 15. Mồ mả bị đào bới: bia mộ nghiêng đổ, quan tài bật nắp, ụ đất
function lv15(g: THREE.Group, M: Mats) {
  const tomb = std(0x7a7a72, { roughness: 0.95 });
  for (const [x, z, rz] of [[-2.0, -1.1, 0.25], [-0.9, -1.3, -0.15], [2.1, -1.0, -0.35]]) {
    const t = put(g, new THREE.BoxGeometry(0.7, 1.1, 0.16), tomb, x, 0.5, z);
    t.rotation.set(-0.1, 0, rz);
  }
  for (const [x, z, s] of [[-1.6, 0.4, 0.8], [1.9, 0.3, 0.7]]) {
    const mound = put(g, new THREE.SphereGeometry(s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.earth, x, 0, z);
    mound.scale.y = 0.45;
  }
  const coffin = new THREE.Group();
  put(coffin, new THREE.BoxGeometry(0.9, 0.55, 2.0), M.wood, 0, 0.27, 0);
  put(coffin, new THREE.BoxGeometry(0.8, 0.08, 1.9), std(0x0a0605), 0, 0.53, 0);
  const lid = put(coffin, new THREE.BoxGeometry(0.95, 0.1, 2.05), M.wood, 0.55, 0.75, 0.1);
  lid.rotation.z = -0.55;
  coffin.position.set(0.3, 0, -0.3);
  coffin.rotation.y = 0.35;
  g.add(coffin);
  chain(g, M.iron, -0.4, 0.9, 0.5, 4).rotation.x = Math.PI / 2;
}

// 16. Lò lửa lớn: lò gạch mái vòm, miệng lò rực cháy
function lv16(g: THREE.Group, M: Mats, fx: Fx) {
  const brick = std(0x5a2a1a, { roughness: 0.9, flatShading: true });
  const dome = put(g, new THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), brick, 0, 0, -0.5);
  dome.scale.y = 1.2;
  put(g, new THREE.CylinderGeometry(0.3, 0.36, 1.4, 10), brick, 0.5, 2.3, -0.9);
  const mouth = put(g, new THREE.CircleGeometry(0.7, 20, 0, Math.PI), std(0x3a0a02, { emissive: 0xff6a10, emissiveIntensity: 2.0 }), 0, 0.02, 1.13);
  mouth.rotation.x = 0;
  for (let k = 0; k < 4; k++) flame(g, M, fx, (k - 1.5) * 0.3, 0, 1.05, 0.8);
  flame(g, M, fx, 0, 0, 1.25, 1.1);
  const smoke: THREE.Sprite[] = [];
  for (let k = 0; k < 6; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getSmokeSpriteTexture(), color: 0x3a3030, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.phase = k / 6;
    g.add(sp);
    smoke.push(sp);
  }
  fx.add((_d, t) => {
    for (const sp of smoke) {
      const lt = (sp.userData.phase + t * 0.15) % 1;
      sp.position.set(0.5 + Math.sin(t + lt * 5) * 0.2, 3.0 + lt * 2.4, -0.9);
      sp.scale.setScalar(0.4 + lt * 1.4);
      sp.material.opacity = Math.sin(lt * Math.PI) * 0.5;
    }
  });
}

// 17. Cối đá xay: hai thớt đá, thớt trên quay chậm, ụ bột cám
function lv17(g: THREE.Group, M: Mats, fx: Fx) {
  put(g, new THREE.CylinderGeometry(1.35, 1.45, 0.5, 24), M.grey, 0, 0.25, -0.3);
  const top = new THREE.Group();
  top.position.set(0, 0.5, -0.3);
  put(top, new THREE.CylinderGeometry(1.25, 1.25, 0.42, 24), M.stone, 0, 0.21, 0);
  put(top, new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), std(0x0a0605), 0, 0.43, 0);
  put(top, new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), M.wood, 1.0, 0.75, 0);
  put(top, new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8).rotateZ(Math.PI / 2), M.wood, 1.8, 1.15, 0);
  g.add(top);
  put(g, new THREE.ConeGeometry(0.6, 0.4, 14), M.flour, -1.9, 0.2, 0.6);
  fx.add((_d, t) => { top.rotation.y = t * 0.35; });
}

// 18. Cưa sắt lớn trên giá gỗ kéo qua kéo lại, bên cạnh là cây cân điêu lệch
function lv18(g: THREE.Group, M: Mats, fx: Fx) {
  for (const x of [-1.2, 1.2]) put(g, new THREE.BoxGeometry(0.25, 3.4, 0.25), M.wood, x, 1.7, -0.6);
  put(g, new THREE.BoxGeometry(2.8, 0.25, 0.3), M.wood, 0, 3.4, -0.6);
  const saw = new THREE.Group();
  put(saw, new THREE.BoxGeometry(3.4, 0.32, 0.02), M.steel);
  const tooth = new THREE.ConeGeometry(0.05, 0.1, 3).rotateZ(Math.PI);
  const teeth = new THREE.InstancedMesh(tooth, M.steel, 30);
  const m = new THREE.Matrix4();
  for (let k = 0; k < 30; k++) teeth.setMatrixAt(k, m.makeTranslation(-1.65 + k * 0.114, -0.2, 0));
  saw.add(teeth);
  for (const x of [-1.85, 1.85]) put(saw, new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), M.wood, x, 0, 0);
  saw.position.set(0, 1.8, -0.2);
  g.add(saw);
  // cân điêu: đòn cân lệch hẳn một bên
  const scale = new THREE.Group();
  put(scale, new THREE.CylinderGeometry(0.05, 0.08, 1.6, 8), M.bronze, 0, 0.8, 0);
  const beam = new THREE.Group();
  beam.position.y = 1.6;
  put(beam, new THREE.BoxGeometry(1.3, 0.05, 0.05), M.bronze);
  for (const x of [-0.6, 0.6]) {
    put(beam, new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), M.iron, x, -0.25, 0);
    put(beam, new THREE.CylinderGeometry(0.22, 0.16, 0.05, 14), M.bronze, x, -0.5, 0);
  }
  beam.rotation.z = 0.28;
  scale.add(beam);
  scale.position.set(2.3, 0, 0.3);
  g.add(scale);
  fx.add((_d, t) => { saw.position.x = Math.sin(t * 1.4) * 0.45; });
}
