// THIỀN ĐƯỜNG: chánh điện trong nhà thờ Đức Phật Thích Ca trên bệ cao, 30 bồ đoàn ngồi thiền,
// nắng sớm xuyên qua song cửa. Ngoài cửa chính là sân sỏi nhỏ có đèn đá, cây cảnh.
// Toạ độ (khớp src/shared/maps.ts): trong điện x ±13, z -24..12; cửa z = 12.3; bàn thờ (0, -16.2); tượng (0, -21.5)
import * as THREE from 'three';
import { TempleWorld, makeRoofGroup } from '../templeWorld.js';
import { getGrassTexture, getVietnameseCurvedRoofTexture } from '../proceduralTextures.js';
import { std, put, plaqueTexture, plaqueMesh, groundPlane, glowTexture } from './helpers.js';

// Sàn gỗ ván dài
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
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = 'rgba(70,35,12,0.18)';
        g.beginPath();
        g.moveTo(x, y + 10 + k * 11);
        g.bezierCurveTo(x + len * 0.3, y + 6 + k * 11, x + len * 0.7, y + 16 + k * 11, x + len, y + 10 + k * 11);
        g.stroke();
      }
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

// Sân sỏi cào vân
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
  g.strokeStyle = 'rgba(120,105,80,0.35)';
  g.lineWidth = 2;
  for (let y = 8; y < 256; y += 16) {
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 40) * 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
}

// Tia nắng: dải sáng mờ nhạt dần theo chiều dài
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

export function buildZenMap(w: TempleWorld) {
  w.particleArea = [-12, 12, -22, 11, 9];
  w.buildMountainRanges();
  const HALL_H = 11;
  const shell = (m: THREE.Mesh) => { m.userData.noCastShadow = true; return m; };

  // ---------- Nền: cỏ ngoài, sàn gỗ trong điện, sân sỏi trước cửa, thảm đỏ lối giữa ----------
  const grassMat = new THREE.MeshStandardMaterial({ map: getGrassTexture(), roughness: 0.95 });
  w.themeMats.grass.push(grassMat);
  groundPlane(w, 400, 400, 0, 0, grassMat, -0.03);
  groundPlane(w, 26.4, 36.8, 0, -6, new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.55, metalness: 0.05 }), 0.01);
  groundPlane(w, 16.6, 8.2, 0, 16.6, new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 0.95 }), 0.01);
  groundPlane(w, 2.6, 27, 0, -1.6, std(0x8a1a14, { roughness: 0.9 }), 0.02);

  // ---------- Vỏ điện: tường, cửa chính, trần, xà ----------
  const wallMat = std(0xcfa878, { roughness: 0.9 });
  const lacquer = std(0x8a1c14, { roughness: 0.45, metalness: 0.1 });
  const darkWood = std(0x3a2012, { roughness: 0.7 });
  const gold = std(0xd4a537, { metalness: 0.8, roughness: 0.3 });
  const wall = (x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = HALL_H, collide = true) => {
    shell(put(w.root, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), wallMat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    if (collide) w.collisionBoxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, type: 'impassable' });
  };
  wall(-13.6, 13.6, -24.6, -24.0);         // tường hậu
  wall(-13.6, -13.0, -24.6, 12.6);         // tường trái
  wall(13.0, 13.6, -24.6, 12.6);           // tường phải
  wall(-13.6, -2.5, 12.0, 12.6);           // tường tiền (hai bên cửa)
  wall(2.5, 13.6, 12.0, 12.6);
  wall(-2.5, 2.5, 12.0, 12.6, 4.2, HALL_H, false); // phần tường trên cửa
  // khung cửa sơn son
  for (const x of [-2.6, 2.6]) put(w.root, new THREE.BoxGeometry(0.3, 4.3, 0.8), lacquer, x, 2.15, 12.3);
  put(w.root, new THREE.BoxGeometry(5.5, 0.35, 0.8), lacquer, 0, 4.3, 12.3);
  // trần + xà ngang, xà dọc
  shell(put(w.root, new THREE.BoxGeometry(27.2, 0.4, 37.2), darkWood, 0, HALL_H + 0.2, -6));
  for (const z of [-21, -15, -9, -3, 3, 9]) put(w.root, new THREE.BoxGeometry(26, 0.5, 0.45), lacquer, 0, HALL_H - 0.3, z);
  for (const x of [-9.5, 9.5]) put(w.root, new THREE.BoxGeometry(0.45, 0.5, 36.4), lacquer, x, HALL_H - 0.3, -6);
  // chân tường gỗ
  for (const x of [-12.97, 12.97]) put(w.root, new THREE.BoxGeometry(0.06, 1.2, 36.4), darkWood, x, 0.6, -6);

  // ---------- Mái ngói cong (nhìn thấy từ sân trước) ----------
  const roof = makeRoofGroup(30, 40, 5.5, 1.3, new THREE.MeshStandardMaterial({ map: getVietnameseCurvedRoofTexture(), side: THREE.DoubleSide, roughness: 0.6 }));
  roof.position.set(0, HALL_H + 0.35, -6);
  roof.traverse(o => { o.userData.noCastShadow = true; });
  w.root.add(roof);
  const doorTex = plaqueTexture([{ text: 'THIỀN ĐƯỜNG', size: 52, color: '#fde68a' }], { w: 520, h: 130, bg: '#7a1c12', border: '#d4a537' });
  const doorPlaque = plaqueMesh(doorTex, 4.2, 1.05, 0.25);
  doorPlaque.position.set(0, 5.4, 12.63);
  w.root.add(doorPlaque);

  // ---------- Hàng cột sơn son ----------
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

  // ---------- Cửa sổ song gỗ + tia nắng (nắng chiếu từ phía tây) ----------
  const paneMat = std(0xfff4dc, { emissive: 0xffe2b0, emissiveIntensity: 0.9, roughness: 0.6 });
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    for (const z of [-17, -11, -5, 1, 7]) {
      const x = side * 12.96;
      const pane = put(w.root, new THREE.PlaneGeometry(3.0, 4.2), paneMat, x, 5.4, z);
      pane.rotation.y = side * -Math.PI / 2;
      for (let k = -1; k <= 1; k++) put(w.root, new THREE.BoxGeometry(0.08, 4.2, 0.08), darkWood, x - side * 0.04, 5.4, z + k * 0.75);
      for (let k = -1; k <= 2; k++) put(w.root, new THREE.BoxGeometry(0.08, 0.08, 3.0), darkWood, x - side * 0.04, 5.4 - 1.6 + k * 1.05, z);
      put(w.root, new THREE.BoxGeometry(0.3, 0.2, 3.4), lacquer, x - side * 0.1, 3.2, z);
      if (side > 0) continue;
      // tia nắng chéo từ cửa sổ xuống sàn
      const dx = 7.5;
      const dy = 5.4;
      const len = Math.hypot(dx, dy);
      const tilt = -Math.atan2(dy, dx);
      for (const vertical of [false, true]) {
        const geo = new THREE.PlaneGeometry(len, 2.8);
        if (!vertical) geo.rotateX(Math.PI / 2);
        geo.translate(len / 2, 0, 0);
        geo.rotateZ(tilt);
        const shaft = new THREE.Mesh(geo, shaftMat);
        shaft.position.set(x + 0.05, 5.4, z);
        shaft.renderOrder = 3;
        w.root.add(shaft);
      }
    }
  }

  // ---------- Bệ thờ, tượng Phật Thích Ca, Bồ Tát hai bên, bàn thờ ----------
  put(w.root, new THREE.BoxGeometry(14, 0.8, 6.5), lacquer, 0, 0.4, -20.75);
  put(w.root, new THREE.BoxGeometry(14.05, 0.08, 0.06), gold, 0, 0.72, -17.5);
  for (let k = 0; k < 2; k++) put(w.root, new THREE.BoxGeometry(6, 0.27 * (k + 1), 0.4), darkWood, 0, 0.135 * (k + 1), -17.1 + (1 - k) * 0.4 - 0.4);
  w.collisionBoxes.push({ minX: -7, maxX: 7, minZ: -24, maxZ: -17.4, type: 'impassable' });

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
  // hai vị Bồ Tát đứng chầu trên bệ (dời lên bệ cao, bỏ va chạm cũ vì đã có bệ)
  const before = parent.children.length;
  w.buildAttendantBodhisattvas(parent);
  w.collisionBoxes.splice(-2, 2);
  parent.children.slice(before).forEach((grp, i) => {
    grp.position.set(i === 0 ? -5.2 : 5.2, 1.7, -18.2);
    grp.scale.setScalar(1.25);
  });
  w.collisionBoxes.push({ minX: -2.7, maxX: 2.7, minZ: -17.2, maxZ: -15.2, type: 'impassable' });

  // hoành phi + câu đối
  const hp = plaqueMesh(plaqueTexture([{ text: 'ĐẠI HÙNG BẢO ĐIỆN', size: 56, color: '#fde68a' }], { w: 760, h: 150, bg: '#5c1a12', border: '#d4a537' }), 6.4, 1.26, 0.3);
  hp.position.set(0, 9.9, -23.95);
  w.root.add(hp);
  for (const [x, text] of [[-7.8, 'Từ Bi Hỷ Xả'], [7.8, 'Tâm Tịnh Thân An']] as [number, string][]) {
    const cd = plaqueMesh(plaqueTexture([{ text, size: 54, color: '#fde68a' }], { w: 130, h: 620, bg: '#1a1208', border: '#d4a537', vertical: true }), 1.0, 4.8, 0.3);
    cd.position.set(x, 5.6, -23.95);
    w.root.add(cd);
  }

  // ---------- Mõ lớn và chuông gia trì hai bên bàn thờ ----------
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    put(g, new THREE.BoxGeometry(1.0, 0.5, 1.0), lacquer, 0, 0.25, 0);
    put(g, new THREE.CylinderGeometry(0.42, 0.45, 0.14, 20), std(0xc9952a, { roughness: 0.9 }), 0, 0.57, 0);
    if (side < 0) {
      const mo = put(g, new THREE.SphereGeometry(1, 20, 14), std(0x9a5420, { roughness: 0.45 }), 0, 0.92, 0);
      mo.scale.set(0.42, 0.33, 0.36);
      const slit = put(g, new THREE.TorusGeometry(0.3, 0.025, 6, 20, Math.PI), darkWood, 0, 0.92, 0.2);
      slit.rotation.z = Math.PI;
    } else {
      const bowl = put(g, new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0.02), new THREE.Vector2(0.42, 0.25), new THREE.Vector2(0.44, 0.45), new THREE.Vector2(0.41, 0.46)], 28), std(0x8a5a22, { metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }), 0, 0.64, 0);
      bowl.castShadow = true;
    }
    g.position.set(side * 4.6, 0, -15.4);
    w.root.add(g);
    w.collisionCircles.push({ x: side * 4.6, z: -15.4, r: 0.75 });
  }

  // ---------- Lư hương nhỏ giữa điện ----------
  const circles = w.collisionCircles.length;
  w.buildGrandBronzeUrn(0, -12.2);
  w.incenseUrnGroup?.scale.setScalar(0.7);
  w.collisionCircles[circles].r = 0.95;
  w.smokeY = 1.2;

  // ---------- 30 bồ đoàn trên chiếu, chia hai bên lối giữa ----------
  const mat = std(0xc8b27a, { roughness: 0.95 });
  for (const sx of [-1, 1]) groundPlane(w, 5.4, 11.2, sx * 5.8, -3.8, mat, 0.025);
  for (const z of [-8.4, -6.1, -3.8, -1.5, 0.8]) for (const x of [-7.6, -5.8, -4.0, 4.0, 5.8, 7.6]) w.createRoundCushion(x, z);

  // ---------- Đèn lồng, phướn ngũ sắc, đèn điểm ấm ----------
  for (const x of [-5.5, 5.5]) for (const z of [-14, -8, -2, 4]) w.createHangingLantern(x, HALL_H - 0.6, z, w.root);
  const flagColors = [0x2563eb, 0xfacc15, 0xdc2626, 0xf8fafc, 0xf97316];
  const flags: THREE.Mesh[] = [];
  let fi = 0;
  for (const x of [-2.2, 2.2]) {
    for (const z of [-12, -6, 0, 6]) {
      const geo = new THREE.PlaneGeometry(0.55, 3.6).translate(0, -1.8, 0);
      const f = new THREE.Mesh(geo, std(flagColors[fi++ % 5], { side: THREE.DoubleSide, roughness: 0.8 }));
      f.position.set(x, HALL_H - 0.55, z);
      f.userData.phase = fi;
      w.root.add(f);
      flags.push(f);
    }
  }
  w.animators.push((_d, t) => { for (const f of flags) f.rotation.x = Math.sin(t * 0.7 + f.userData.phase) * 0.04; });
  for (const z of [-12, 2]) {
    const l = new THREE.PointLight(0xffc98a, 10, 26, 1.5);
    l.position.set(0, 7, z);
    w.root.add(l);
  }
  const altarGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  altarGlow.scale.set(9, 9, 1);
  altarGlow.position.set(0, 5.5, -22.6);
  w.root.add(altarGlow);

  // ---------- Bảng hướng dẫn ngồi thiền gần cửa ----------
  const sign = new THREE.Group();
  for (const x of [-0.5, 0.5]) put(sign, new THREE.BoxGeometry(0.08, 1.5, 0.08), darkWood, x, 0.75, 0);
  const signFace = plaqueMesh(plaqueTexture([
    { text: 'HƯỚNG DẪN', size: 30, color: '#fde68a' },
    { text: 'NGỒI THIỀN', size: 30, color: '#fde68a' },
    { text: 'Hít vào tâm an', size: 20, color: '#fef3c7', weight: '600' },
    { text: 'Thở ra mỉm cười', size: 20, color: '#fef3c7', weight: '600' }
  ], { w: 280, h: 300, bg: '#3a2012', border: '#d4a537' }), 1.15, 1.2, 0.2);
  signFace.position.set(0, 1.45, 0.05);
  sign.add(signFace);
  sign.position.set(-3.0, 0, 7.2);
  sign.rotation.y = 0.35;
  w.root.add(sign);
  w.collisionCircles.push({ x: -3.0, z: 7.2, r: 0.6 });
  w.infoPoints.push({ id: 'zen-guide', x: -2.4, z: 8.6, r: 2.0 });

  // ---------- Sân trước: đèn đá, bonsai, hàng rào cây, tùng ----------
  w.createAuthenticStoneLantern(-3.6, 16.8);
  w.createAuthenticStoneLantern(3.6, 16.8);
  w.createPedestalBonsai(-6.2, 14.2, 'green_foliage');
  w.createPedestalBonsai(6.2, 14.2, 'yellow_blossom');
  const hedge = std(0x3a6a3a, { roughness: 0.95, flatShading: true });
  for (const [x0, x1, z0, z1] of [[-8.6, -8.0, 12.6, 20.6], [8.0, 8.6, 12.6, 20.6], [-8.6, 8.6, 20.0, 20.6]] as [number, number, number, number][]) {
    put(w.root, new THREE.BoxGeometry(x1 - x0, 1.1, z1 - z0), hedge, (x0 + x1) / 2, 0.55, (z0 + z1) / 2);
    w.collisionBoxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, type: 'impassable' });
  }
  w.buildCloudPine(-10.8, 17, 1.1, 61);
  w.buildCloudPine(10.8, 17, 1.1, 83);
}
