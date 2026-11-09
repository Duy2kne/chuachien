// Hàm dựng hình dùng chung cho các bản đồ riêng (chùa tháp, địa ngục, thiền đường)
import * as THREE from 'three';
import type { TempleWorld } from '../templeWorld.js';

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Số ngẫu nhiên có hạt giống: mọi người chơi thấy cảnh giống hệt nhau
export function seeded(seed: number) {
  let v = seed % 2147483647;
  if (v <= 0) v += 2147483646;
  return () => {
    v = (v * 16807) % 2147483647;
    return (v - 1) / 2147483646;
  };
}

export function std(color: number, o: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
}

export function put(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Quầng sáng tròn mờ (dùng cho sprite lửa, hồn ma, ánh hào quang)
let _glow: THREE.CanvasTexture | null = null;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}

export function glowSprite(color: number, size: number, opacity = 0.8) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  sp.scale.set(size, size, 1);
  return sp;
}

// Bảng chữ (bia, hoành phi, biển tầng địa ngục): nhiều dòng, tự xuống dòng, có viền
export interface PlaqueLine { text: string; size: number; color?: string; weight?: string; font?: string }
export function plaqueTexture(lines: PlaqueLine[], opts: { w: number; h: number; bg: string; border?: string; vertical?: boolean }) {
  const scale = 2;
  const c = document.createElement('canvas');
  c.width = opts.w * scale;
  c.height = opts.h * scale;
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.fillStyle = opts.bg;
  g.fillRect(0, 0, opts.w, opts.h);
  if (opts.border) {
    g.strokeStyle = opts.border;
    g.lineWidth = 6;
    g.strokeRect(6, 6, opts.w - 12, opts.h - 12);
    g.lineWidth = 2;
    g.strokeRect(14, 14, opts.w - 28, opts.h - 28);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Đo trước tổng chiều cao để canh giữa theo chiều dọc
  const rows: { line: PlaqueLine; text: string }[] = [];
  const maxW = opts.w - 44;
  for (const line of lines) {
    g.font = `${line.weight || 'bold'} ${line.size}px ${line.font || '"Noto Serif", Georgia, serif'}`;
    if (opts.vertical) {
      for (const word of line.text.split(' ')) rows.push({ line, text: word });
      continue;
    }
    let cur = '';
    for (const word of line.text.split(' ')) {
      const t = cur ? `${cur} ${word}` : word;
      if (g.measureText(t).width > maxW && cur) {
        rows.push({ line, text: cur });
        cur = word;
      } else cur = t;
    }
    rows.push({ line, text: cur });
  }
  const gap = 1.3;
  const total = rows.reduce((a, r) => a + r.line.size * gap, 0);
  let y = (opts.h - total) / 2;
  for (const r of rows) {
    g.font = `${r.line.weight || 'bold'} ${r.line.size}px ${r.line.font || '"Noto Serif", Georgia, serif'}`;
    g.fillStyle = r.line.color || '#fde68a';
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 4;
    g.fillText(r.text, opts.w / 2, y + (r.line.size * gap) / 2);
    y += r.line.size * gap;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Tấm bảng phẳng (mặt trước hướng +z), phát sáng nhẹ để đọc được trong tối
export function plaqueMesh(tex: THREE.Texture, w: number, h: number, glow = 0.35) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, roughness: 0.7 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

// Vách đá gồ ghề: khối hộp chia lưới, đỉnh lởm chởm, cạnh lồi lõm (va chạm theo đúng khối hộp)
export function rockWall(w: TempleWorld, x0: number, x1: number, z0: number, z1: number, h: number, mat: THREE.Material, seed: number) {
  const rnd = seeded(seed);
  const sx = x1 - x0;
  const sz = z1 - z0;
  const geo = new THREE.BoxGeometry(sx, h, sz, Math.max(1, Math.ceil(sx / 1.6)), 3, Math.max(1, Math.ceil(sz / 1.6)));
  const pos = geo.attributes.position;
  const offs = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`;
    if (!offs.has(key)) {
      const top = pos.getY(i) > h / 2 - 0.01;
      const bottom = pos.getY(i) < -h / 2 + 0.01;
      offs.set(key, [(rnd() - 0.5) * 0.55, bottom ? 0 : top ? rnd() * 1.4 - 0.3 : (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.55]);
    }
    const o = offs.get(key)!;
    pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
  }
  geo.computeVertexNormals();
  const m = put(w.root, geo, mat, (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  w.collisionBoxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, type: 'impassable' });
  return m;
}

// Đá tảng méo (dodecahedron bóp méo)
export function boulderGeo(r: number, seed: number) {
  const rnd = seeded(seed);
  const geo = new THREE.DodecahedronGeometry(r, 1);
  const pos = geo.attributes.position;
  const offs = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!offs.has(key)) offs.set(key, 0.8 + rnd() * 0.35);
    const k = offs.get(key)!;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// Dây xích treo thẳng đứng từ yTop xuống n mắt xích
export function chain(parent: THREE.Object3D, mat: THREE.Material, x: number, yTop: number, z: number, n: number, link = 0.16) {
  const g = new THREE.Group();
  const geo = new THREE.TorusGeometry(link * 0.42, link * 0.12, 5, 10);
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(geo, mat);
    l.position.y = -i * link * 0.78;
    l.rotation.set(Math.PI / 2, 0, 0);
    l.rotation.y = i % 2 ? Math.PI / 2 : 0;
    l.scale.set(1, 1.35, 1);
    g.add(l);
  }
  g.position.set(x, yTop, z);
  parent.add(g);
  return g;
}

// Cây tán tròn đổi màu theo mùa (dùng vật liệu tán lá chung của cảnh)
const foliageCache = new WeakMap<TempleWorld, { bark: THREE.MeshStandardMaterial; leaves: THREE.MeshStandardMaterial[]; blossom: THREE.MeshStandardMaterial }>();
export function themeTree(w: TempleWorld, x: number, z: number, scale: number, seed: number) {
  let mats = foliageCache.get(w);
  if (!mats) {
    const leaves = Array.from({ length: 5 }, () => new THREE.MeshStandardMaterial({ color: 0x40916c, roughness: 0.85, flatShading: true }));
    leaves.forEach(m => w.themeMats.foliage.push(m));
    const blossom = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7, flatShading: true });
    w.themeMats.blossom.push(blossom);
    mats = { bark: new THREE.MeshStandardMaterial({ color: 0x4a3328, roughness: 0.92, flatShading: true }), leaves, blossom };
    foliageCache.set(w, mats);
  }
  const rnd = seeded(seed);
  const g = new THREE.Group();
  const top = V((rnd() - 0.5) * 0.6, 2.4, (rnd() - 0.5) * 0.6);
  g.add(new THREE.Mesh(w.makeLimb(V(0, 0, 0), top, 0.32, 0.2), mats.bark));
  const leafMat = mats.leaves[Math.floor(rnd() * mats.leaves.length)];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const r = i === 0 ? 0 : 0.9 + rnd() * 0.7;
    const c = V(top.x + Math.cos(a) * r, top.y + 0.9 + rnd() * 0.9 - (i === 0 ? 0 : 0.3), top.z + Math.sin(a) * r);
    if (i > 0 && i < 4) g.add(new THREE.Mesh(w.makeLimb(top, c, 0.12, 0.07), mats.bark));
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(i === 0 ? 1.5 : 0.95 + rnd() * 0.35, 1), i === 6 ? mats.blossom : leafMat);
    puff.scale.y = 0.8;
    puff.position.copy(c);
    g.add(puff);
  }
  g.scale.setScalar(scale);
  g.position.set(x, 0, z);
  g.rotation.y = rnd() * Math.PI * 2;
  w.root.add(g);
  w.collisionCircles.push({ x, z, r: 0.5 * scale });
  return g;
}

// Tháp mộ nhỏ (vườn tháp): bệ vuông, 3-5 tầng thu nhỏ dần, chóp búp sen
export function stupa(w: TempleWorld, x: number, z: number, seed: number) {
  const rnd = seeded(seed);
  const tone = [0x8f8574, 0x9a8f7c, 0x7f7a6c, 0xa39880][Math.floor(rnd() * 4)];
  const mat = std(tone, { roughness: 0.95 });
  const moss = std(0x5f6b4a, { roughness: 1 });
  const g = new THREE.Group();
  put(g, new THREE.BoxGeometry(1.7, 0.45, 1.7), moss, 0, 0.22, 0);
  let y = 0.45;
  const tiers = 3 + Math.floor(rnd() * 3);
  for (let t = 0; t < tiers; t++) {
    const s = 1.2 - t * 0.17;
    const h = t === 0 ? 0.9 : 0.5;
    put(g, new THREE.BoxGeometry(s, h, s), mat, 0, y + h / 2, 0);
    y += h;
    put(g, new THREE.BoxGeometry(s + 0.36, 0.1, s + 0.36), moss, 0, y + 0.05, 0);
    y += 0.1;
  }
  put(g, new THREE.SphereGeometry(0.22, 10, 8), mat, 0, y + 0.18, 0);
  put(g, new THREE.ConeGeometry(0.12, 0.5, 8), mat, 0, y + 0.6, 0);
  g.position.set(x, 0, z);
  g.rotation.y = (rnd() - 0.5) * 0.1;
  w.root.add(g);
  w.collisionCircles.push({ x, z, r: 0.95 });
  return g;
}

// Mặt nền phẳng lớn
export function groundPlane(w: TempleWorld, sx: number, sz: number, x: number, z: number, mat: THREE.Material, y = 0.01) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  w.root.add(m);
  return m;
}
