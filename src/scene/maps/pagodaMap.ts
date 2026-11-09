// CHÙA THÁP THIÊN THỦ: tượng Phật Bà Quan Âm nghìn tay nghìn mắt, bảo tháp 7 tầng, vườn tháp hai bên.
// Toạ độ chính (khớp src/shared/maps.ts): lư hương (0, 6), bàn thờ (0, -0.6), tượng (0, -7), bảo tháp (0, -22)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TempleWorld } from '../templeWorld.js';
import { getGrassTexture, getCourtyardStoneTexture, getMainPathTexture, createHaloTexture } from '../proceduralTextures.js';
import { V, std, put, plaqueTexture, plaqueMesh, themeTree, stupa, groundPlane } from './helpers.js';

export function buildPagodaMap(w: TempleWorld) {
  w.particleArea = [-28, 28, -30, 28, 14];
  w.buildMountainRanges();

  // ---------- Mặt đất: cỏ, sân lát đá, lối đi chính ----------
  const grassMat = new THREE.MeshStandardMaterial({ map: getGrassTexture(), roughness: 0.95 });
  w.themeMats.grass.push(grassMat);
  groundPlane(w, 600, 600, 0, 0, grassMat, -0.04);
  groundPlane(w, 44, 60, 0, -1, new THREE.MeshStandardMaterial({ map: getCourtyardStoneTexture(), roughness: 0.82, metalness: 0.08 }), 0.01);
  groundPlane(w, 6, 24, 0, 16, new THREE.MeshStandardMaterial({
    map: getMainPathTexture(), roughness: 0.72, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  }), 0.03);

  // ---------- Tượng Phật Bà nghìn tay nghìn mắt trên bệ đá bát giác ----------
  const stone = std(0xb8b0a0, { roughness: 0.9 });
  const stoneDark = std(0x8c867a, { roughness: 0.92 });
  const statueBase = new THREE.Group();
  put(statueBase, new THREE.CylinderGeometry(4.6, 5.0, 0.6, 8), stoneDark, 0, 0.3, 0);
  put(statueBase, new THREE.CylinderGeometry(3.6, 3.95, 0.6, 8), stone, 0, 0.9, 0);
  const lotusMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
  const throne = put(statueBase, TempleWorld.lotusThrone([
    { n: 18, r: 2.1, y: 0, len: 0.95, wid: 0.55, tilt: 0.85, c0: 0xf7d9e4, c1: 0xe0628f },
    { n: 16, r: 1.9, y: 0.25, len: 0.85, wid: 0.5, tilt: 0.5, c0: 0xfbe3ec, c1: 0xe8789f }
  ]), lotusMat, 0, 1.2, 0);
  throne.castShadow = true;
  const guanyin = makeThousandArmGuanyin(w);
  guanyin.scale.setScalar(2.5);
  guanyin.position.y = 1.55;
  statueBase.add(guanyin);
  const statueLight = new THREE.PointLight(0xfff1c1, 1.0, 14);
  statueLight.position.set(0, 7, 4);
  statueBase.add(statueLight);
  w.nightLights.push(statueLight);
  statueBase.position.set(0, 0, -7);
  w.root.add(statueBase);
  w.collisionCircles.push({ x: 0, z: -7, r: 5.0 });

  // ---------- Bàn thờ trước tượng (dâng hoa) ----------
  const altar = new THREE.Group();
  put(altar, new THREE.BoxGeometry(3.4, 1.05, 1.2), std(0x4a120e, { roughness: 0.5, metalness: 0.2 }), 0, 0.525, 0);
  put(altar, new THREE.BoxGeometry(3.3, 0.05, 1.15), std(0x991b1b), 0, 1.075, 0);
  for (const cx of [-1.5, 1.5]) {
    put(altar, new THREE.CylinderGeometry(0.06, 0.1, 0.35), std(0xd4af37, { metalness: 0.85, roughness: 0.25 }), cx, 1.27, -0.3);
    put(altar, new THREE.CylinderGeometry(0.04, 0.04, 0.32), std(0xb91c1c), cx, 1.6, -0.3);
    put(altar, new THREE.ConeGeometry(0.04, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0xffd54f }), cx, 1.82, -0.3);
    const candle = new THREE.PointLight(0xffa726, 0.8, 4);
    candle.position.set(cx, 1.9, -0.3);
    altar.add(candle);
    w.nightLights.push(candle);
  }
  altar.position.set(0, 0, -0.6);
  w.root.add(altar);
  w.altarGroup = altar;
  w.collisionBoxes.push({ minX: -1.8, maxX: 1.8, minZ: -1.3, maxZ: 0.1, type: 'impassable' });

  // ---------- Lư hương, bồ đoàn, đèn đá ----------
  w.buildGrandBronzeUrn(0, 6);
  for (const cz of [2.2, 3.8]) {
    for (const cx of [-7.2, -6.0, -4.8, 4.8, 6.0, 7.2]) w.createRoundCushion(cx, cz);
  }
  for (const [x, z] of [[-3.5, 20], [3.5, 20], [-3.5, 13], [3.5, 13]]) {
    w.createAuthenticStoneLantern(x, z);
    w.addLightPool(x, z, 2.4, 0.3);
  }

  // ---------- Bảo tháp 7 tầng phía sau và 2 tháp nhỏ hai bên ----------
  const addPagoda = (x: number, z: number, tiers: number, scale: number) => {
    const idx = w.collisionCircles.length;
    const p = w.buildPagoda(x, z, tiers);
    p.scale.setScalar(scale);
    w.collisionCircles[idx].r = 2.6 * scale;
    w.root.add(p);
  };
  addPagoda(0, -22, 7, 1.7);
  addPagoda(-14, -15, 5, 1.0);
  addPagoda(14, -15, 5, 1.0);

  // ---------- Vườn tháp: 2 hàng tháp mộ cổ dọc hai bên sân ----------
  let seed = 7;
  for (let z = -24; z <= 21; z += 6.4) {
    stupa(w, -23, z, seed++);
    stupa(w, 23, z, seed++);
  }

  // ---------- Cây xanh đổi màu theo mùa ----------
  for (const [x, z, s] of [[-12, 4, 1.2], [12, 4, 1.2], [-12, 16, 1.15], [12, 16, 1.15], [-8, -27, 1.3], [8, -27, 1.3], [-18, 26, 1.1], [18, 26, 1.1]] as [number, number, number][]) {
    themeTree(w, x, z, s, Math.round(x * 13 + z * 7 + 500));
  }
  w.buildCloudPine(-17, -6, 1.1, 31);
  w.buildCloudPine(17, -6, 1.1, 47);

  // ---------- Tường thấp bao quanh (ngoài giới hạn đi lại) ----------
  const wallMat = std(0x948b81, { roughness: 0.95 });
  const capMat = std(0x7a2a1c, { roughness: 0.7 });
  const walls: [number, number, number, number][] = [[0, -32.6, 60, 0.6], [-29.8, -1, 0.6, 63], [29.8, -1, 0.6, 63], [-16.5, 30.4, 27, 0.6], [16.5, 30.4, 27, 0.6]];
  for (const [x, z, sx, sz] of walls) {
    put(w.root, new THREE.BoxGeometry(sx, 1.6, sz), wallMat, x, 0.8, z);
    put(w.root, new THREE.BoxGeometry(sx + 0.3, 0.16, sz + 0.3), capMat, x, 1.68, z);
  }

  // ---------- Bia giới thiệu (đứng gần thì hiện bảng thông tin) ----------
  const stele = (x: number, z: number, lines: string[], id: string) => {
    const g = new THREE.Group();
    put(g, new THREE.BoxGeometry(1.5, 0.35, 0.7), stoneDark, 0, 0.17, 0);
    put(g, new THREE.BoxGeometry(1.2, 1.9, 0.22), stone, 0, 1.3, 0);
    const tex = plaqueTexture(
      [{ text: lines[0], size: 30, color: '#fde68a' }, { text: lines[1], size: 20, color: '#fef3c7', weight: '600' }],
      { w: 300, h: 460, bg: '#5c1a12', border: '#d4a537' }
    );
    const face = plaqueMesh(tex, 1.0, 1.55, 0.25);
    face.position.set(0, 1.32, 0.115);
    g.add(face);
    g.position.set(x, 0, z);
    w.root.add(g);
    w.collisionCircles.push({ x, z, r: 0.75 });
    w.infoPoints.push({ id, x, z: z + 1.6, r: 2.2 });
  };
  stele(-4.6, 0.2, ['THIÊN THỦ THIÊN NHÃN', 'Quán Thế Âm Bồ Tát'], 'pagoda-guanyin');
  stele(4.6, 0.2, ['BẢO THÁP', 'Tháp thờ Xá Lợi bảy tầng'], 'pagoda-tower');
}

// ===================== PHẬT BÀ NGHÌN TAY NGHÌN MẮT =====================
// Thân tượng dùng lại tượng Quan Âm thếp vàng; phía sau xoè 1000 cánh tay thành vầng hào quang,
// mỗi lòng bàn tay có một con mắt; 42 tay trong cùng cầm pháp khí; trên đầu xếp tầng các khuôn mặt nhỏ.
function makeThousandArmGuanyin(w: TempleWorld): THREE.Group {
  const fig = w.makeQuanAmFigure('gold', 'lotus');
  fig.rotation.y = 0; // nhìn thẳng ra lối đi (+z)
  fig.position.y = 0;

  const gold = new THREE.MeshStandardMaterial({ color: 0xd8ad45, metalness: 0.78, roughness: 0.32 });
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const C = V(0, 1.72, 0);
  const up = V(0, 1, 0);
  const fwd = V(0, 0, 1);
  // 5 lớp tay, lớp trong to và vươn ra trước, lớp ngoài nhỏ dần và lùi về sau: tổng 1000 tay
  const layers = [
    { n: 42, r0: 0.22, len: 0.62, z: -0.42, rad: 0.042, tilt: 0.55, span: 0.8 },
    { n: 120, r0: 0.34, len: 0.68, z: -0.5, rad: 0.032, tilt: 0.34, span: 0.84 },
    { n: 200, r0: 0.44, len: 0.74, z: -0.56, rad: 0.027, tilt: 0.22, span: 0.86 },
    { n: 280, r0: 0.54, len: 0.78, z: -0.61, rad: 0.023, tilt: 0.14, span: 0.88 },
    { n: 358, r0: 0.62, len: 0.82, z: -0.66, rad: 0.02, tilt: 0.08, span: 0.9 }
  ];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = V(1, 1, 1);
  const holdMats: THREE.Matrix4[] = [];

  layers.forEach((L, li) => {
    // cánh tay (ống thon) + bàn tay dẹt
    const arm = new THREE.CylinderGeometry(L.rad * 0.8, L.rad, L.len, 5, 1, true);
    arm.translate(0, L.len / 2, 0);
    const palm = new THREE.SphereGeometry(1, 6, 4);
    palm.scale(L.rad * 1.25, L.rad * 1.75, L.rad * 0.5);
    palm.translate(0, L.len + L.rad * 1.3, 0);
    const armGeo = mergeGeometries([arm, palm])!;
    arm.dispose();
    palm.dispose();
    const eyeGeo = w.mergeColoredParts([
      { geo: new THREE.SphereGeometry(1, 6, 4).scale(L.rad * 0.62, L.rad * 0.34, L.rad * 0.18), color: 0xffffff, matrix: new THREE.Matrix4().makeTranslation(0, L.len + L.rad * 1.3, L.rad * 0.42) },
      { geo: new THREE.SphereGeometry(L.rad * 0.2, 4, 3), color: 0x1a1208, matrix: new THREE.Matrix4().makeTranslation(0, L.len + L.rad * 1.3, L.rad * 0.55) }
    ]);
    const arms = new THREE.InstancedMesh(armGeo, gold, L.n);
    const eyes = new THREE.InstancedMesh(eyeGeo, eyeMat, L.n);
    for (let k = 0; k < L.n; k++) {
      const a = -L.span * Math.PI + ((k + (li % 2 ? 0.5 : 0.25)) / L.n) * 2 * L.span * Math.PI;
      const dir = V(Math.sin(a), Math.cos(a), 0);
      // tay phía dưới hơi chúc ra trước nhiều hơn để ôm lấy thân tượng
      const tilt = L.tilt * (1 + 0.4 * Math.max(0, -dir.y));
      const d = dir.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(fwd, Math.sin(tilt)).normalize();
      q.setFromUnitVectors(up, d);
      const p = C.clone().addScaledVector(dir, L.r0);
      p.z += L.z;
      m.compose(p, q, one);
      arms.setMatrixAt(k, m);
      eyes.setMatrixAt(k, m);
      if (li === 0) holdMats.push(m.clone().multiply(new THREE.Matrix4().makeTranslation(0, L.len + 0.1, 0.03)));
    }
    arms.castShadow = true;
    fig.add(arms, eyes);
  });

  // Pháp khí trên 42 tay lớn: bánh xe pháp, búp sen, chày kim cang, chuông, ngọc minh châu, kiếm
  const pink = std(0xf29bbd, { roughness: 0.5 });
  const pearl = std(0xf8f4ff, { emissive: 0xfff2c0, emissiveIntensity: 0.8, roughness: 0.2 });
  const tools: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [
    { geo: mergeGeometries([new THREE.TorusGeometry(0.045, 0.009, 5, 14), new THREE.SphereGeometry(0.014, 6, 5)])!, mat: gold },
    { geo: new THREE.ConeGeometry(0.03, 0.09, 6), mat: pink },
    { geo: mergeGeometries([new THREE.ConeGeometry(0.018, 0.06, 5).translate(0, 0.03, 0), new THREE.ConeGeometry(0.018, 0.06, 5).rotateX(Math.PI).translate(0, -0.03, 0)])!, mat: gold },
    { geo: new THREE.ConeGeometry(0.032, 0.06, 10, 1, true), mat: gold },
    { geo: new THREE.SphereGeometry(0.028, 10, 8), mat: pearl },
    { geo: mergeGeometries([new THREE.BoxGeometry(0.012, 0.16, 0.004).translate(0, 0.08, 0), new THREE.BoxGeometry(0.05, 0.01, 0.01)])!, mat: gold }
  ];
  tools.forEach((imp, t) => {
    const list = holdMats.filter((_, k) => k % tools.length === t);
    const inst = new THREE.InstancedMesh(imp.geo, imp.mat, list.length);
    list.forEach((mm, k) => inst.setMatrixAt(k, mm));
    fig.add(inst);
  });

  // Tầng các khuôn mặt nhỏ trên đỉnh đầu (3 + 3 + 1) và tượng A Di Đà trên cùng
  const heads: [number, number, number, number, number][] = [
    [-0.11, 2.74, -0.02, 0.62, 0.5], [0, 2.76, 0.03, 0.66, 0], [0.11, 2.74, -0.02, 0.62, -0.5],
    [-0.075, 2.93, -0.02, 0.5, 0.4], [0, 2.95, 0.01, 0.54, 0], [0.075, 2.93, -0.02, 0.5, -0.4],
    [0, 3.1, 0, 0.5, 0]
  ];
  for (const [x, y, z, s, ry] of heads) {
    const h = new THREE.Group();
    const face = put(h, new THREE.SphereGeometry(1, 16, 12), gold);
    face.scale.set(0.17 * s, 0.2 * s, 0.18 * s);
    const band = put(h, new THREE.TorusGeometry(0.17 * s, 0.014 * s, 5, 18), gold, 0, 0.11 * s, 0);
    band.rotation.x = Math.PI / 2;
    h.position.set(x, y, z);
    h.rotation.y = -ry;
    fig.add(h);
  }
  const amida = put(fig, new THREE.SphereGeometry(0.05, 12, 10), gold, 0, 3.24, 0.01);
  amida.scale.y = 1.2;

  // Vầng hào quang vàng lớn sau lưng
  const ring = put(fig, new THREE.TorusGeometry(1.52, 0.03, 8, 80), gold, C.x, C.y, -0.72);
  ring.scale.y = 1.05;
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.8),
    new THREE.MeshBasicMaterial({ map: createHaloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32 })
  );
  halo.position.set(C.x, C.y, -0.74);
  fig.add(halo);
  w.animators.push((_d, t) => {
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(t * 1.2) * 0.06;
  });

  const holder = new THREE.Group();
  holder.add(fig);
  return holder;
}
