import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  getCourtyardStoneTexture,
  getMainPathTexture,
  getVietnameseCurvedRoofTexture,
  getLacqueredWoodTexture,
  getSmokeSpriteTexture,
  createPlaqueTexture,
  createBonsaiPotTexture,
  getGrassTexture,
  createHaloTexture
} from './proceduralTextures.js';
import type { IncenseItem, FlowerItem, LanternItem, LeafPile, WishItem } from '../types.js';
import { DEFAULT_THEME, type TempleTheme } from './themes.js';
import { DINING, traySlot, type TrayItem } from '../shared/dining.js';
import { getMapSpec, type MapId, type MapSpec } from '../shared/maps.js';

// Số ngẫu nhiên có hạt giống: mọi người chơi thấy cây giống hệt nhau
function seeded(seed: number) {
  let v = seed % 2147483647;
  if (v <= 0) v += 2147483646;
  return () => {
    v = (v * 16807) % 2147483647;
    return (v - 1) / 2147483646;
  };
}

let _warmGlowTex: THREE.CanvasTexture | null = null;
function warmGlowTexture() {
  if (_warmGlowTex) return _warmGlowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,150,1)');
  gr.addColorStop(0.3, 'rgba(255,170,90,0.5)');
  gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  _warmGlowTex = new THREE.CanvasTexture(c);
  return _warmGlowTex;
}

let _petalCarpetTex: THREE.CanvasTexture | null = null;
function petalCarpetTexture() {
  if (_petalCarpetTex) return _petalCarpetTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const rnd = seeded(77);
  const cols = ['#f7b6cf', '#f29bbd', '#fbd3e2', '#e98aae', '#ffe4ee'];
  for (let i = 0; i < 520; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.75) * 118;
    g.save();
    g.translate(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    g.rotate(rnd() * Math.PI);
    g.globalAlpha = 0.95 - (r / 118) * 0.6;
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.ellipse(0, 0, 3.4, 2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  _petalCarpetTex = new THREE.CanvasTexture(c);
  _petalCarpetTex.colorSpace = THREE.SRGBColorSpace;
  return _petalCarpetTex;
}

export interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  type?: 'impassable' | 'step';
  height?: number;
}

// =========================================================================
// HÀM TẠO MÁI CHÙA VIỆT NAM CONG VÚT (MAKE CURVED ROOF)
// Mái chái 4 mặt dựng theo từng "vòng" từ diềm mái (t = 0) lên bờ nóc (t = 1).
// Mặt mái võng xuống: y = h * (0.35t + 0.65t^2)
// 4 góc mái vểnh cong lên (đầu đao): độ nâng = curl * (|u|*|v|)^4 * (1 - t)^2.5
// =========================================================================
function roofRingPoint(
  hw: number, hd: number, rw: number, height: number, curl: number,
  t: number, s: number
): THREE.Vector3 {
  const a = hw + (rw - hw) * t;
  const b = hd * (1 - t);
  const side = Math.min(3, Math.floor(s));
  const f = s - side;
  // Thứ tự góc: trước-phải -> trước-trái -> sau-trái -> sau-phải
  const corners = [[a, b], [-a, b], [-a, -b], [a, -b]];
  const p0 = corners[side];
  const p1 = corners[(side + 1) % 4];
  const x = p0[0] + (p1[0] - p0[0]) * f;
  const z = p0[1] + (p1[1] - p0[1]) * f;
  const u = a > 1e-4 ? x / a : 0;
  const v = b > 1e-4 ? z / b : 0;
  const corner = Math.pow(Math.abs(u * v), 4);
  const fall = Math.pow(1 - t, 2.5);
  const flare = 1 + 0.07 * corner * fall;
  const y = height * (0.35 * t + 0.65 * t * t) + curl * corner * fall;
  return new THREE.Vector3(x * flare, y, z * flare);
}

export function makeCurvedRoofGeometry(
  width: number,
  depth: number,
  height: number,
  curl = 1.45,
  segments = 16
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const rw = Math.max(hw * 0.12, hw - hd); // Nửa chiều dài bờ nóc
  const rows = segments;
  const perSide = segments;
  const cols = perSide * 4;
  const sideLen = [2 * hw, 2 * hd, 2 * hw, 2 * hd];
  const slopeLen = Math.hypot(hd, height);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    let dist = 0;
    for (let c = 0; c <= cols; c++) {
      const s = (c / perSide) % 4;
      const p = roofRingPoint(hw, hd, rw, height, curl, t, c === cols ? 3.9999 : s);
      positions.push(p.x, p.y, p.z);
      const side = Math.min(3, Math.floor(c / perSide));
      dist = sideLen.slice(0, side).reduce((acc, l) => acc + l, 0) + (c / perSide - side) * sideLen[side];
      uvs.push(dist / 20, (t * slopeLen) / 20);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i0 = r * (cols + 1) + c;
      const i1 = i0 + 1;
      const i2 = i0 + (cols + 1);
      const i3 = i2 + 1;
      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// Mái hoàn chỉnh: mặt ngói + viền diềm mái vàng + bờ nóc + bờ chảy + đầu đao + đầu kìm
const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9962c, metalness: 0.6, roughness: 0.35 });
const roofRidgeMat = new THREE.MeshStandardMaterial({ color: 0x5b1d12, roughness: 0.6 });

export function makeRoofGroup(
  width: number,
  depth: number,
  height: number,
  curl: number,
  roofMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const rw = Math.max(hw * 0.12, hw - hd);
  const scale = Math.min(width, depth);

  const roof = new THREE.Mesh(makeCurvedRoofGeometry(width, depth, height, curl), roofMat);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Viền diềm mái (chạy vòng quanh mép mái)
  const eave: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) eave.push(roofRingPoint(hw, hd, rw, height, curl, 0, (i / 64) * 4));
  const eaveTube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eave, true), 160, Math.max(0.06, scale * 0.012), 6, true),
    roofTrimMat
  );
  group.add(eaveTube);

  // 4 bờ chảy từ đỉnh xuống góc mái + đầu đao cong vút ở cuối
  for (let corner = 0; corner < 4; corner++) {
    const pts: THREE.Vector3[] = [];
    for (let r = 10; r >= 0; r--) pts.push(roofRingPoint(hw, hd, rw, height, curl, r / 10, corner));
    const hip = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, Math.max(0.08, scale * 0.016), 6, false),
      roofRidgeMat
    );
    hip.castShadow = true;
    group.add(hip);

    const tip = pts[pts.length - 1];
    const out = new THREE.Vector3(tip.x, 0, tip.z).normalize();
    const lift = Math.max(0.35, curl * 0.45);
    const curlCurve = new THREE.QuadraticBezierCurve3(
      tip.clone(),
      tip.clone().add(out.clone().multiplyScalar(lift * 0.9)),
      tip.clone().add(out.clone().multiplyScalar(lift * 0.7)).add(new THREE.Vector3(0, lift * 1.1, 0))
    );
    const dau = new THREE.Mesh(new THREE.TubeGeometry(curlCurve, 12, Math.max(0.06, scale * 0.014), 6, false), roofTrimMat);
    group.add(dau);
  }

  // Bờ nóc chính + 2 đầu kìm cuộn lên ở hai đầu
  const ridgeR = Math.max(0.12, scale * 0.022);
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(ridgeR, ridgeR, rw * 2 + ridgeR * 2, 8), roofRidgeMat);
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = height + ridgeR * 0.4;
  ridge.castShadow = true;
  group.add(ridge);

  for (const side of [-1, 1]) {
    const endX = side * (rw + ridgeR);
    const kim = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(endX, height + ridgeR * 0.4, 0),
      new THREE.Vector3(endX + side * scale * 0.08, height + ridgeR, 0),
      new THREE.Vector3(endX + side * scale * 0.03, height + scale * 0.12, 0)
    );
    const kimMesh = new THREE.Mesh(new THREE.TubeGeometry(kim, 12, ridgeR * 0.9, 6, false), roofTrimMat);
    group.add(kimMesh);
  }

  return group;
}

// Một chiếc bánh bao: vỏ trắng ngà, nếp xoắn trên đỉnh, chấm đỏ
const bunMat = new THREE.MeshStandardMaterial({ color: 0xfaf1df, roughness: 0.85 });
const bunDotMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
export function makeBunMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), bunMat);
  body.scale.set(1, 0.72, 1);
  body.position.y = 0.045;
  g.add(body);
  const twist = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.03, 10), bunMat);
  twist.position.y = 0.098;
  g.add(twist);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), bunDotMat);
  dot.position.y = 0.112;
  g.add(dot);
  return g;
}

// Đĩa sứ trắng viền lam, có thể bày 0-3 bánh bao
const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
const plateRimMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.3 });
export function makeBunPlateMesh(buns = 3): THREE.Group {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.03, 28), plateMat);
  plate.position.y = 0.015;
  g.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.008, 6, 32), plateRimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.03;
  g.add(rim);
  const spots: [number, number][] = [[-0.07, 0.04], [0.07, 0.04], [0, -0.075]];
  for (let i = 0; i < Math.min(buns, 3); i++) {
    const bun = makeBunMesh();
    bun.position.set(spots[i][0], 0.025, spots[i][1]);
    bun.rotation.y = i * 1.7;
    g.add(bun);
  }
  return g;
}

export class TempleWorld {
  public scene: THREE.Scene;
  public collisionBoxes: CollisionBox[] = [];
  // Vật cản hình tròn (hồ sen, gốc bồ đề, lư hương)
  public collisionCircles: { x: number; z: number; r: number }[] = [];
  // Vị trí các bồ đoàn để nhân vật đến quỳ lạy
  public cushionSpots: { x: number; z: number }[] = [];
  // Khối che khuất camera (raycast để camera không xuyên qua vật thể)
  public cameraBlockers: THREE.Object3D[] = [];

  // Tương tác
  public bellMesh: THREE.Group | null = null;
  public strikerMesh: THREE.Group | null = null;
  public drumMesh: THREE.Group | null = null;
  public incenseUrnGroup: THREE.Group | null = null;
  public altarGroup: THREE.Group | null = null;
  public pondGroup: THREE.Group | null = null;
  // Nhóm chứa đèn hoa đăng (dùng để raycast khi chạm/bấm vào đèn)
  public lanternLayer = new THREE.Group();

  // Đồ vật đồng bộ
  private incenseMeshMap = new Map<string, THREE.Group>();
  private flowerMeshMap = new Map<string, THREE.Group>();
  private lanternMeshMap = new Map<string, THREE.Group>();

  // Vật liệu & hình khối dùng chung cho nhang/hoa/đèn hoa đăng (tránh tạo mới mỗi lần thao tác -> đỡ lag khi nhiều action)
  private readonly offeringMat = {
    incenseWood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    incenseTip: new THREE.MeshBasicMaterial({ color: 0xff5a1f }),
    incenseGlow: new THREE.SpriteMaterial({ map: getSmokeSpriteTexture(), color: 0xff7a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    lotus: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }),
    lanternPetal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xf7a8d4, emissiveIntensity: 0.3 }),
    lanternBase: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
    lanternFlame: new THREE.MeshBasicMaterial({ color: 0xffc14d }),
    lanternGlow: new THREE.SpriteMaterial({ map: getSmokeSpriteTexture(), color: 0xffa94d, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })
  };

  // Chiếu sáng & Bầu trời
  public sunLight: THREE.DirectionalLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;
  public nightLights: THREE.PointLight[] = [];
  public lanternsGlow: THREE.PointLight[] = [];
  // Vật liệu phát sáng (đèn đá, đèn lồng) sáng rực hơn về đêm
  public glowMaterials: THREE.MeshStandardMaterial[] = [];
  public isNight = false;

  private skyMesh: THREE.Mesh | null = null;
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private cloudsGroup: THREE.Group | null = null;
  private starsPoints: THREE.Points | null = null;
  private moonGroup: THREE.Group | null = null;
  // Đèn trời (đèn khổng minh) bay lơ lửng ban đêm
  private skyLanternMesh: THREE.InstancedMesh | null = null;
  private skyLanternGlow: THREE.Points | null = null;
  private skyLanternData: { a: number; r: number; y: number; speed: number; sway: number; phase: number; s: number }[] = [];
  private skyLanternDummy = new THREE.Object3D();
  // Chi tiết trang trí chỉ hiện ban đêm (vũng sáng dưới đèn, quầng đèn lồng)
  public nightOnly: THREE.Object3D[] = [];
  // Mặt nước hồ: ban đêm bớt bóng để ánh trăng phản chiếu không loá
  private waterMats: THREE.MeshStandardMaterial[] = [];
  public waterMat(m: THREE.MeshStandardMaterial) {
    this.waterMats.push(m);
    m.roughness = this.isNight ? 0.38 : 0.1;
    return m;
  }
  public buddhaHalo: THREE.Mesh | null = null;

  // Khói hương tròn mờ
  private smokeSprites: THREE.Sprite[] = [];
  private smokeLifetimes: number[] = [];

  // Cánh hoa rơi
  private fallingPetals: THREE.InstancedMesh | null = null;
  private petalDummy = new THREE.Object3D();
  private petalCount = 450;
  private petalData: { x: number; y: number; z: number; rx: number; ry: number; speed: number; rotSpeed: number }[] = [];

  // Vật liệu đổi màu theo cảnh của phòng (mùa xuân, thu, đông...)
  public themeMats: Record<'mountains' | 'grass' | 'grassBlade' | 'blossom' | 'foliage' | 'treeFlower' | 'palm', THREE.MeshStandardMaterial[]> = {
    mountains: [], grass: [], grassBlade: [], blossom: [], foliage: [], treeFlower: [], palm: []
  };
  public theme: TempleTheme = DEFAULT_THEME;
  private particleKind: TempleTheme['particles']['kind'] = 'petal';
  private particleSize = 1;
  private particleSpeed = 1;
  private readonly maxParticles = 450;

  // Bia công đức và các công trình cúng dường chung đã xây
  private steleMat: THREE.MeshStandardMaterial | null = null;
  private builtProjects = new Map<string, { group: THREE.Group; grow: number }>();

  // Nhà ăn: mái ẩn khi người chơi vào trong, mâm cơm trên bàn
  private diningRoof: THREE.Group | null = null;
  private trayLayer = new THREE.Group();
  private trayMeshes = new Map<string, THREE.Group>();
  private steamSprites: THREE.Sprite[] = [];
  private counterPlate: THREE.Group | null = null;

  // Đống lá đa rụng trên sân (đồng bộ từ server)
  public leafLayer = new THREE.Group();
  private leafPiles = new Map<string, { data: LeafPile; group: THREE.Group; falling: number; sweptAt: number }>();
  private leafGeo: THREE.ShapeGeometry | null = null;
  private leafMats: THREE.MeshStandardMaterial[] = [];

  // Bụi cỏ & Hoa nhỏ InstancedMesh ngoài sân
  private grassMesh: THREE.InstancedMesh | null = null;

  private bellRingingTimer = 0;
  private drumBeatingTimer = 0;

  // ===================== BẢN ĐỒ =====================
  // Mọi vật thể của cảnh nằm trong `root` để đổi phòng (đổi bản đồ) thì gỡ ra một lượt
  public readonly mapId: MapId;
  public readonly root = new THREE.Group();
  public readonly spec: MapSpec;
  // Độ cao mặt nền của các bản đồ khác chùa chính (mặc định phẳng)
  public groundFn: ((x: number, z: number) => number) | null = null;
  // Hoạt ảnh riêng của từng bản đồ (gọi mỗi khung hình)
  public animators: ((delta: number, elapsed: number) => void)[] = [];
  // Điểm xem thông tin: đứng gần thì hiện bảng nội dung (các tầng địa ngục, hướng dẫn ngồi thiền...)
  public infoPoints: { id: string; x: number; z: number; r: number }[] = [];
  // Bản đồ nhỏ: các khối vẽ lên (vách, bệ, tượng) và điểm đánh số (tầng địa ngục, tượng La Hán)
  public minimap: {
    rects: { x0: number; x1: number; z0: number; z1: number; kind: 'wall' | 'dais' | 'altar' | 'statue' }[];
    marks: { x: number; z: number; label: string; id?: string }[];
  } = { rects: [], marks: [] };
  // Vùng hạt bay (cánh hoa, tuyết, tàn lửa...): [minX, maxX, minZ, maxZ, độ cao tối đa]
  public particleArea: [number, number, number, number, number] = [-35, 35, -30, 40, 15];
  // Độ cao miệng lư hương (khói bốc lên từ đây)
  public smokeY = 1.75;

  constructor(scene: THREE.Scene, mapId: MapId = 'main', builder?: (w: TempleWorld) => void) {
    this.scene = scene;
    this.mapId = builder ? mapId : 'main';
    this.spec = getMapSpec(this.mapId);
    this.buildWorld(builder);
    this.applyTheme(DEFAULT_THEME);
  }

  private buildWorld(builder?: (w: TempleWorld) => void) {
    this.scene.add(this.root);
    this.root.add(this.lanternLayer);
    this.root.add(this.leafLayer);
    this.setupLighting();
    this.buildSkyDome();
    if (this.mapId !== 'main' && builder) {
      builder(this);
      this.setupSmokeAndPetals();
      this.enableShadows();
      return;
    }
    this.buildMountainRanges();
    this.buildGroundAndFlora();
    this.buildMainHall();
    this.buildThreeArchGate();
    this.buildBellAndDrumPavilion();
    this.buildLotusPond();
    this.buildBodhiTree();
    this.buildPerimeterWalls();
    this.buildDecorationsAndBonsai();
    this.buildMeritStele();
    this.buildBeautyDetails();
    this.setupSmokeAndPetals();
    this.enableShadows();
    this.buildDiningHall();
  }

  // Gỡ toàn bộ cảnh khỏi scene và giải phóng bộ nhớ GPU (khi chuyển sang phòng có bản đồ khác)
  public dispose() {
    this.scene.remove(this.root);
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const texs = new Set<THREE.Texture>();
    this.root.traverse(obj => {
      const m = obj as THREE.Mesh;
      if (m.geometry) geos.add(m.geometry);
      const mm = (m as any).material as THREE.Material | THREE.Material[] | undefined;
      if (mm) (Array.isArray(mm) ? mm : [mm]).forEach(x => mats.add(x));
      const light = obj as THREE.DirectionalLight;
      if (light.isLight && light.shadow?.map) light.shadow.map.dispose();
    });
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) texs.add(v as THREE.Texture);
      mat.dispose();
    }
    geos.forEach(g => g.dispose());
    texs.forEach(t => t.dispose());
    this.animators = [];
  }

  private enableShadows() {
    const worldPos = new THREE.Vector3();
    this.root.updateMatrixWorld(true);
    this.root.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || (obj as THREE.InstancedMesh).isInstancedMesh) return;
      const mat = mesh.material as THREE.Material;
      if (!mat || (mat as THREE.ShaderMaterial).isShaderMaterial || mat.transparent) return;
      const geoType = mesh.geometry.type;
      if (geoType === 'PlaneGeometry' || geoType === 'CircleGeometry') {
        mesh.receiveShadow = true;
        return;
      }
      mesh.getWorldPosition(worldPos);
      if (Math.hypot(worldPos.x, worldPos.z - 8) > 70) return;
      // Vỏ nhà (tường, trần thiền đường): nhận bóng nhưng không chặn nắng, vẫn chặn camera
      mesh.castShadow = !mesh.userData.noCastShadow;
      mesh.receiveShadow = true;
      mesh.geometry.computeBoundingSphere();
      const r = (mesh.geometry.boundingSphere?.radius || 0) * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
      if (r > 0.45 && geoType !== 'TubeGeometry') this.cameraBlockers.push(mesh);
    });
  }

  // ===================== 1. ÁNH SÁNG BAN NGÀY & ĐÊM =====================
  private setupLighting() {
    // HemisphereLight: trời #fff1d6, đất #7a6a4a, cường độ 0.9
    this.hemiLight = new THREE.HemisphereLight(0xfff1d6, 0x6b5a3a, 0.55);
    // Ánh sáng môi trường (RoomEnvironment) chỉ để kim loại phản chiếu, không làm cảnh bị chói
    this.scene.environmentIntensity = 0.35;
    this.root.add(this.hemiLight);

    // DirectionalLight: nắng chiều vàng ấm #ffd9a0, cường độ 2.5, từ góc thấp phía tây để tạo bóng dài
    this.sunLight = new THREE.DirectionalLight(0xffd9a0, 2.2);
    this.sunLight.position.set(-38, 34, 30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 160;

    // Camera bóng ôm vừa khuôn viên chùa
    const d = 42;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02; // Chống sọc bóng trên bề mặt cong
    this.root.add(this.sunLight);

    // Fog: màu trùng màu chân trời (#ffe3b3 ban ngày), near 60, far 250
    this.scene.fog = new THREE.Fog(0xdfe6df, 90, 520);
  }

  // ===================== 2. BẦU TRỜI GRADIENT (SHADER MATERIAL) =====================
  private buildSkyDome() {
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x6fa8dc) },    // Xanh thiên thanh
        bottomColor: { value: new THREE.Color(0xf3e6cc) }, // Chân trời vàng nhạt pha sương
        offset: { value: 20.0 },
        exponent: { value: 0.65 },
        glowColor: { value: new THREE.Color(0xe7a3c0) },
        glowStrength: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        uniform vec3 glowColor;
        uniform float glowStrength;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          vec3 col = mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
          // dải hồng tím sát chân trời
          float band = pow(1.0 - clamp(abs(h - 0.04) * 2.6, 0.0, 1.0), 3.0);
          col = mix(col, glowColor, band * glowStrength);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.root.add(this.skyMesh);

    // Mây low-poly trắng trôi chậm trên bầu trời
    this.cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
      transparent: true,
      opacity: 0.85
    });

    const cloudCoords = [
      { x: -50, y: 75, z: -80, s: 12 },
      { x: 30, y: 85, z: -100, s: 15 },
      { x: 70, y: 80, z: -50, s: 14 },
      { x: -65, y: 70, z: 20, s: 11 },
      { x: 45, y: 78, z: 60, s: 13 }
    ];

    for (const c of cloudCoords) {
      const cloud = new THREE.Group();
      for (let p = 0; p < 5; p++) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(c.s * (0.5 + Math.random() * 0.4), 1), cloudMat);
        puff.position.set((p - 2) * (c.s * 0.5), (Math.random() - 0.5) * (c.s * 0.25), (Math.random() - 0.5) * (c.s * 0.3));
        cloud.add(puff);
      }
      cloud.position.set(c.x, c.y, c.z);
      this.cloudsGroup.add(cloud);
    }
    this.root.add(this.cloudsGroup);

    // Mặt trời phát sáng ấm buổi chiều
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 128;
    sunCanvas.height = 128;
    const sctx = sunCanvas.getContext('2d')!;
    const sgrad = sctx.createRadialGradient(64, 64, 0, 64, 64, 60);
    sgrad.addColorStop(0, 'rgba(255, 245, 210, 1.0)');
    sgrad.addColorStop(0.3, 'rgba(255, 215, 140, 0.75)');
    sgrad.addColorStop(0.8, 'rgba(255, 185, 90, 0.2)');
    sgrad.addColorStop(1, 'rgba(255, 180, 80, 0.0)');
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 128, 128);

    const sunTex = new THREE.CanvasTexture(sunCanvas);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, depthWrite: false }));
    sunSprite.position.set(-150, 95, 120);
    sunSprite.scale.set(30, 30, 1);
    this.root.add(sunSprite);

    // Mặt trăng rằm và ngàn sao ban đêm
    this.moonGroup = new THREE.Group();
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(9, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfffae6, fog: false })
    );
    this.moonGroup.add(moonMesh);

    // Hào quang trăng
    const moonAura = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: 0xc7d2fe, depthWrite: false }));
    moonAura.scale.set(48, 48, 1);
    this.moonGroup.add(moonAura);

    this.moonGroup.position.set(-110, 140, -220);
    this.moonGroup.visible = false;
    this.root.add(this.moonGroup);

    // 800 Ngôi sao trên bầu trời đêm
    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45; // Nửa cầu trên
      const r = 380;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) + 15;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.9, fog: false })
    );
    this.starsPoints.visible = false;
    this.root.add(this.starsPoints);

    this.buildSkyLanterns();
  }

  // Đèn trời: vài chục chiếc đèn giấy cam bay chậm lên quanh chùa, chỉ hiện ban đêm
  private buildSkyLanterns() {
    const count = 60;
    const body = new THREE.CylinderGeometry(0.62, 0.46, 1.25, 8, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb35c, fog: false });
    this.skyLanternMesh = new THREE.InstancedMesh(body, mat, count);
    this.skyLanternMesh.frustumCulled = false;
    const colors = [0xffb35c, 0xffc46e, 0xff9f4a, 0xffd08a];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const near = i < 22; // một nhóm bay gần sân chùa cho dễ thấy
      this.skyLanternData.push({
        a: Math.random() * Math.PI * 2,
        r: near ? 20 + Math.random() * 28 : 50 + Math.random() * 90,
        y: 6 + Math.random() * 70,
        speed: 0.4 + Math.random() * 0.6,
        sway: 0.6 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        s: near ? 0.75 + Math.random() * 0.35 : 1.1 + Math.random() * 0.8
      });
      this.skyLanternMesh.setColorAt(i, c.setHex(colors[i % colors.length]));
    }
    this.skyLanternMesh.visible = false;
    this.root.add(this.skyLanternMesh);

    // quầng sáng cam quanh mỗi đèn
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const gc = document.createElement('canvas');
    gc.width = gc.height = 64;
    const g = gc.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,220,150,1)');
    gr.addColorStop(0.25, 'rgba(255,170,80,0.55)');
    gr.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    this.skyLanternGlow = new THREE.Points(
      glowGeo,
      new THREE.PointsMaterial({
        map: new THREE.CanvasTexture(gc),
        size: 10,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false
      })
    );
    this.skyLanternGlow.frustumCulled = false;
    this.skyLanternGlow.visible = false;
    this.root.add(this.skyLanternGlow);
    this.updateSkyLanterns(0, 0);
  }

  private updateSkyLanterns(delta: number, elapsed: number) {
    if (!this.skyLanternMesh || !this.skyLanternGlow || !this.skyLanternMesh.visible) return;
    const d = this.skyLanternDummy;
    const pos = this.skyLanternGlow.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.skyLanternData.length; i++) {
      const L = this.skyLanternData[i];
      L.y += delta * L.speed;
      if (L.y > 85) {
        L.y = 6;
        L.a = Math.random() * Math.PI * 2;
      }
      const x = Math.cos(L.a) * L.r + Math.sin(elapsed * 0.25 + L.phase) * L.sway;
      const z = Math.sin(L.a) * L.r + Math.cos(elapsed * 0.2 + L.phase) * L.sway;
      // lên cao thì nhỏ dần như đèn bay xa
      const fade = L.y > 70 ? Math.max(0.05, (85 - L.y) / 15) : 1;
      d.position.set(x, L.y, z);
      d.rotation.set(Math.sin(elapsed * 0.8 + L.phase) * 0.08, elapsed * 0.1 + L.phase, 0);
      d.scale.setScalar(L.s * fade);
      d.updateMatrix();
      this.skyLanternMesh.setMatrixAt(i, d.matrix);
      pos.setXYZ(i, x, L.y + 0.05, z);
    }
    this.skyLanternMesh.instanceMatrix.needsUpdate = true;
    pos.needsUpdate = true;
  }

  // ===================== 3. NÚI NON LOW-POLY HÒA VÀO SƯƠNG =====================
  public buildMountainRanges() {
    // 3 lớp đồi núi tròn nhấp nhô ở xa, xanh nhạt dần theo khoảng cách để hòa vào sương
    const layers = [
      { dist: 150, count: 10, radius: 34, height: 26, color: 0x6f8f72 },
      { dist: 205, count: 12, radius: 46, height: 40, color: 0x7f9ea0 },
      { dist: 265, count: 14, radius: 58, height: 58, color: 0x9fb4c0 }
    ];

    for (const lyr of layers) {
      const mat = new THREE.MeshStandardMaterial({ color: lyr.color, roughness: 1, flatShading: true });
      this.themeMats.mountains.push(mat);

      for (let i = 0; i < lyr.count; i++) {
        // Bao quanh phía bắc, đông, tây (phía nam là cổng chùa nên để thoáng hơn)
        const angle = -Math.PI * 0.9 + (i / (lyr.count - 1)) * Math.PI * 1.8 + (Math.random() - 0.5) * 0.12;
        const x = Math.sin(angle) * lyr.dist;
        const z = -Math.cos(angle) * lyr.dist + 10;

        const geo = new THREE.IcosahedronGeometry(1, 2);
        const pos = geo.attributes.position;
        const noise = new Map<string, number>();
        for (let v = 0; v < pos.count; v++) {
          const key = `${pos.getX(v).toFixed(3)},${pos.getY(v).toFixed(3)},${pos.getZ(v).toFixed(3)}`;
          if (!noise.has(key)) noise.set(key, 0.84 + Math.random() * 0.28);
          const n = noise.get(key)!;
          pos.setXYZ(v, pos.getX(v) * n, pos.getY(v) * n, pos.getZ(v) * n);
        }
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, mat);
        const r = lyr.radius * (0.75 + Math.random() * 0.5);
        mesh.scale.set(r * 1.4, lyr.height * (0.7 + Math.random() * 0.5), r);
        mesh.rotation.y = angle;
        mesh.position.set(x, -lyr.height * 0.12, z);
        this.root.add(mesh);
      }
    }
  }

  // ===================== 4. MẶT ĐẤT, SÂN CHÙA & BỤI CỎ INSTANCED =====================
  private buildGroundAndFlora() {
    // 1. Mặt cỏ xanh (#6f9a4a) rộng lớn bao bọc
    const grassGroundGeo = new THREE.PlaneGeometry(700, 700, 1, 1);
    const grassGroundMat = new THREE.MeshStandardMaterial({
      map: getGrassTexture(),
      roughness: 0.95
    });
    this.themeMats.grass.push(grassGroundMat);
    const grassGround = new THREE.Mesh(grassGroundGeo, grassGroundMat);
    grassGround.rotation.x = -Math.PI / 2;
    grassGround.position.y = -0.04;
    grassGround.receiveShadow = true;
    this.root.add(grassGround);

    // 2. Sân chùa gạch đá vuông be ấm (#cfc6b4 xen #bdb3a0)
    const courtyardGeo = new THREE.PlaneGeometry(64, 72);
    const courtyardMat = new THREE.MeshStandardMaterial({
      map: getCourtyardStoneTexture(),
      roughness: 0.82,
      metalness: 0.08
    });
    const courtyard = new THREE.Mesh(courtyardGeo, courtyardMat);
    courtyard.rotation.x = -Math.PI / 2;
    courtyard.position.set(0, 0.01, 10);
    courtyard.receiveShadow = true;
    this.root.add(courtyard);

    // Viền đá bó vỉa giữa sân chùa và bãi cỏ
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x9e988a, roughness: 0.85 });
    const curbSegments = [
      { x: 0, z: -26, w: 64.6, d: 0.6 },
      { x: 0, z: 46, w: 64.6, d: 0.6 },
      { x: -32, z: 10, w: 0.6, d: 72.6 },
      { x: 32, z: 10, w: 0.6, d: 72.6 }
    ];
    for (const cb of curbSegments) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(cb.w, 0.12, cb.d), curbMat);
      curb.position.set(cb.x, 0.06, cb.z);
      this.root.add(curb);
    }

    // 3. Lối đi chính từ cổng tam quan vào chính điện: phiến đá lớn sáng màu, rộng 6 đơn vị
    const pathGeo = new THREE.PlaneGeometry(6.0, 37.5);
    const pathMat = new THREE.MeshStandardMaterial({
      map: getMainPathTexture(),
      roughness: 0.72,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const mainPath = new THREE.Mesh(pathGeo, pathMat);
    mainPath.rotation.x = -Math.PI / 2;
    mainPath.position.set(0, 0.03, 17.5);
    mainPath.receiveShadow = true;
    this.root.add(mainPath);

    // 4. InstancedMesh: 2000 Bụi cỏ và hoa nhỏ ngoài sân
    const grassBladeGeo = new THREE.ConeGeometry(0.08, 0.45, 4);
    const grassBladeMat = new THREE.MeshStandardMaterial({
      color: 0x5b8a3e,
      roughness: 0.85,
      flatShading: true
    });
    this.themeMats.grassBlade.push(grassBladeMat);
    this.grassMesh = new THREE.InstancedMesh(grassBladeGeo, grassBladeMat, 2000);

    const dummy = new THREE.Object3D();
    let idx = 0;
    while (idx < 2000) {
      const gx = (Math.random() - 0.5) * 160;
      const gz = (Math.random() - 0.5) * 160;

      // Không mọc trên sân gạch chính (x: ±32, z: -26 đến 46)
      if (Math.abs(gx) < 32.5 && gz > -26.5 && gz < 46.5) continue;
      // Không mọc trong lòng hồ sen
      if (Math.hypot(gx - (-18), gz - 24) < 7.5) continue;

      dummy.position.set(gx, 0.2, gz);
      dummy.scale.set(
        0.8 + Math.random() * 0.6,
        0.7 + Math.random() * 0.8,
        0.8 + Math.random() * 0.6
      );
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.3
      );
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
    this.grassMesh.instanceMatrix.needsUpdate = true;
    this.grassMesh.computeBoundingSphere();
    this.root.add(this.grassMesh);

    // Hàng đèn đá chùa và bệ bonsai men lam đối xứng dọc hai bên lối đi chính (như trong ảnh mẫu)
    // Cặp 1 (tiền cảnh z=24): Đèn đá búp sen hai bên
    this.createAuthenticStoneLantern(-3.8, 24);
    this.createAuthenticStoneLantern(3.8, 24);

    // Cặp 2 (trung cảnh z=16): Bệ đá cao với chậu men lam
    // Bên phải: Cây hoa mai vàng cành gập khúc khuỷu hoa nở rực rỡ như trong ảnh mẫu!
    this.createPedestalBonsai(3.8, 16, 'yellow_blossom');
    // Bên trái: Cây cảnh bonsai tán tròn xanh mướt
    this.createPedestalBonsai(-3.8, 16, 'green_foliage');

    // Cặp 3 (hậu cảnh z=8): Đèn đá búp sen hai bên
    this.createAuthenticStoneLantern(-3.8, 8);
    this.createAuthenticStoneLantern(3.8, 8);

    // Cặp 4 (trước bậc tam cấp z=0): Bệ đá bonsai chầu hai bên
    this.createPedestalBonsai(-3.8, 0, 'yellow_blossom');
    this.createPedestalBonsai(3.8, 0, 'green_foliage');

    // Bồ đoàn tròn màu vàng nghệ xếp hàng ô vuông trang nghiêm hai bên sân (như trong ảnh mẫu)
    // Góc phải: 3 hàng x 4 cột = 12 bồ đoàn vàng
    for (const cz of [6.2, 8.4, 10.6]) {
      for (const cx of [4.8, 6.0, 7.2, 8.4]) {
        this.createRoundCushion(cx, cz);
      }
    }

    // Góc trái: 2 hàng x 3 cột = 6 bồ đoàn vàng
    for (const cz of [7.2, 9.4]) {
      for (const cx of [-7.2, -6.0, -4.8]) {
        this.createRoundCushion(cx, cz);
      }
    }

    // Lư hương đồng lớn ba chân quỳ đặt trước bậc thềm chính điện (x=0, z=0.4)
    this.buildGrandBronzeUrn(0, 0.4);
  }

  // Bồ đoàn tròn màu vàng nghệ may gờ nổi và rốn bồ đoàn (đúng chuẩn ảnh mẫu)
  public createRoundCushion(x: number, z: number) {
    const group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.46, 0.5, 0.16, 28);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc98f2a, // Vàng nghệ trầm
      roughness: 0.9
    });
    const cushion = new THREE.Mesh(geo, mat);
    cushion.position.y = 0.08;
    cushion.receiveShadow = true;
    group.add(cushion);

    // Điểm nhấn rốn bồ đoàn ở tâm
    const button = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 })
    );
    button.position.y = 0.165;
    group.add(button);

    // Đường gờ viền may bo tròn
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.045, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0xa8741f, roughness: 0.9 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.155;
    group.add(rim);

    group.position.set(x, 0, z);
    this.root.add(group);
    this.cushionSpots.push({ x, z });
  }

  // Đèn đá chùa đích thực: đế cánh sen nở, thân trụ đá, lồng đèn tròn sáng vàng, mái chóp nón búp sen
  public createAuthenticStoneLantern(x: number, z: number) {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x8c867a, // Xám đá ấm tự nhiên
      roughness: 0.88
    });

    // 1. Đế đá 2 tầng có cánh sen nở
    const baseLow = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.18, 16), stoneMat);
    baseLow.position.y = 0.09;
    group.add(baseLow);

    // Bệ sen nở ở chân đế
    for (let p = 0; p < 8; p++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), stoneMat);
      petal.scale.set(1, 0.6, 1.4);
      const pa = (p * Math.PI * 2) / 8;
      petal.position.set(Math.cos(pa) * 0.52, 0.22, Math.sin(pa) * 0.52);
      petal.rotation.z = Math.cos(pa) * 0.45;
      petal.rotation.x = Math.sin(pa) * -0.45;
      group.add(petal);
    }

    // 2. Thân trụ đá tròn chạm nổi gờ
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.85, 12), stoneMat);
    pillar.position.y = 0.72;
    group.add(pillar);

    // Vành đỡ lồng đèn
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.32, 0.16, 12), stoneMat);
    shelf.position.y = 1.22;
    group.add(shelf);

    // 3. Lồng đèn tròn phát ánh sáng vàng ấm áp như trong ảnh mẫu
    const lampLightCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffe082,
        emissive: 0xffb74d,
        emissiveIntensity: 0.95,
        roughness: 0.2
      })
    );
    lampLightCore.position.y = 1.58;
    group.add(lampLightCore);

    // 4. Mái chóp nón đá cong nhẹ
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.42, 16), stoneMat);
    roof.position.y = 2.02;
    roof.castShadow = true;
    group.add(roof);

    // Đỉnh búp sen thanh khiết
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), stoneMat);
    finial.position.y = 2.28;
    group.add(finial);

    this.glowMaterials.push(lampLightCore.material as THREE.MeshStandardMaterial);

    group.position.set(x, 0, z);
    this.root.add(group);

    this.collisionBoxes.push({
      minX: x - 0.45,
      maxX: x + 0.45,
      minZ: z - 0.45,
      maxZ: z + 0.45,
      type: 'impassable'
    });
  }

  // Tán lá dạng cụm nhiều khối nhỏ lệch tâm, xoay ngẫu nhiên (thay cho 1 khối cầu/đa diện đơn to)
  // để trông xù tự nhiên như lá cây thật, đỡ giống "viên bi láng" phẳng lì.
  public createFoliageClump(mats: THREE.Material[], radius: number, count = 5): THREE.Group {
    const clump = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const isCore = i === 0;
      const s = radius * (isCore ? 1.05 : 0.5 + Math.random() * 0.35);
      const mat = mats[Math.floor(Math.random() * mats.length)];
      const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), mat);
      const a = Math.random() * Math.PI * 2;
      const r = isCore ? 0 : radius * (0.3 + Math.random() * 0.3);
      lump.position.set(Math.cos(a) * r, (Math.random() - 0.5) * radius * 0.3, Math.sin(a) * r);
      lump.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      lump.castShadow = true;
      clump.add(lump);
    }
    return clump;
  }

  // Bệ đá cao với chậu men lam và cây cảnh hoa mai vàng rực rỡ / tán xanh (như trong ảnh mẫu)
  public createPedestalBonsai(x: number, z: number, type: 'yellow_blossom' | 'green_foliage') {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8c867a, roughness: 0.9 });
    const potTex = createBonsaiPotTexture();
    const potMat = new THREE.MeshStandardMaterial({ map: potTex, roughness: 0.35, metalness: 0.1 });
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x543d2b, roughness: 0.95 });

    // 1. Trụ đá / Bệ đá cao đỡ chậu bonsai (như trong ảnh mẫu)
    const baseLow = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.85), stoneMat);
    baseLow.position.y = 0.09;
    group.add(baseLow);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.8, 12), stoneMat);
    pillar.position.y = 0.58;
    group.add(pillar);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.15, 12), stoneMat);
    topCap.position.y = 1.05;
    group.add(topCap);

    // 2. Chậu gốm men lam cao cấp
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.32, 0.36, 16), potMat);
    pot.position.y = 1.31;
    group.add(pot);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 8, 16), potMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.49;
    group.add(rim);

    // Đất trồng cây
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshStandardMaterial({ color: 0x3f2e22, roughness: 1.0 }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 1.48;
    group.add(soil);

    // 3. Cây cảnh bonsai
    if (type === 'yellow_blossom') {
      // Cây hoa mai vàng / hoa sứ cành khúc khuỷu hoa nở vàng rực rỡ như góc phải ảnh mẫu!
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.48, 0),
        new THREE.Vector3(0.12, 1.75, 0.05),
        new THREE.Vector3(-0.15, 2.1, -0.05),
        new THREE.Vector3(0.1, 2.45, 0.1)
      ]);
      const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 12, 0.075, 8, false), barkMat);
      trunk.castShadow = true;
      group.add(trunk);

      // Cành con xòe ra
      const branchMat = barkMat;
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.65), branchMat);
      b1.position.set(0.28, 2.15, 0.15);
      b1.rotation.z = -0.7;
      b1.rotation.y = 0.4;
      group.add(b1);

      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.55), branchMat);
      b2.position.set(-0.25, 2.3, -0.1);
      b2.rotation.z = 0.8;
      b2.rotation.y = -0.5;
      group.add(b2);

      // Những cụm hoa vàng rực rỡ nở rộ (hoa mai vàng)
      const flowerMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        flatShading: true
      });
      this.themeMats.blossom.push(flowerMat);

      const clusterOffsets = [
        { x: 0.12, y: 2.55, z: 0.12, s: 0.22 },
        { x: 0.48, y: 2.25, z: 0.25, s: 0.18 },
        { x: 0.38, y: 2.4, z: -0.1, s: 0.16 },
        { x: -0.38, y: 2.45, z: -0.15, s: 0.2 },
        { x: -0.1, y: 2.65, z: -0.05, s: 0.18 },
        { x: -0.22, y: 2.25, z: 0.2, s: 0.16 }
      ];

      for (const cl of clusterOffsets) {
        const blossomCluster = new THREE.Mesh(new THREE.DodecahedronGeometry(cl.s, 1), flowerMat);
        blossomCluster.position.set(cl.x, cl.y, cl.z);
        group.add(blossomCluster);
      }
    } else {
      // Cây cảnh bonsai uốn thế tán tròn xanh mướt (như góc trái ảnh mẫu)
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 8), barkMat);
      trunk.position.set(0, 1.83, 0);
      trunk.rotation.z = 0.15;
      group.add(trunk);

      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85, flatShading: true });
      this.themeMats.foliage.push(foliageMat);
      const foliage = this.createFoliageClump([foliageMat], 0.4, 4);
      foliage.scale.set(1.2, 0.85, 1.2);
      foliage.position.set(0.08, 2.2, 0);
      group.add(foliage);
    }

    group.position.set(x, 0, z);
    this.root.add(group);

    this.collisionBoxes.push({
      minX: x - 0.45,
      maxX: x + 0.45,
      minZ: z - 0.45,
      maxZ: z + 0.45,
      type: 'impassable'
    });
  }

  // ===================== 5. LƯ HƯƠNG ĐỒNG LỚN (ĐỒNG #6b4a2b, KIM LOẠI 0.8) =====================
  public buildGrandBronzeUrn(x: number, z: number) {
    this.incenseUrnGroup = new THREE.Group();
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a2b,
      metalness: 0.82,
      roughness: 0.28
    });

    // 3 Chân quỳ đầu lân vững chắc
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.55, 8), bronzeMat);
      const angle = (i * Math.PI * 2) / 3;
      leg.position.set(Math.cos(angle) * 0.82, 0.28, Math.sin(angle) * 0.82);
      leg.rotation.z = Math.cos(angle) * 0.2;
      this.incenseUrnGroup.add(leg);
    }

    // Thân lư tròn phình bụng, miệng mở để thấy lòng tro và nén hương
    const bodyProfile = [
      new THREE.Vector2(0.0, 0.45),
      new THREE.Vector2(0.7, 0.47),
      new THREE.Vector2(1.12, 0.75),
      new THREE.Vector2(1.28, 1.08),
      new THREE.Vector2(1.18, 1.38),
      new THREE.Vector2(1.0, 1.52),
      new THREE.Vector2(1.06, 1.64)
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 36), bronzeMat);
    body.castShadow = true;
    this.incenseUrnGroup.add(body);

    // Đai hoa văn vàng quanh bụng lư
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(1.27, 0.035, 6, 48),
      new THREE.MeshStandardMaterial({ color: 0xd4a537, metalness: 0.85, roughness: 0.3 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.1;
    this.incenseUrnGroup.add(band);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.07, 8, 36), bronzeMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.65;
    this.incenseUrnGroup.add(rim);

    // Hai quai rồng uốn lượn hai bên sườn
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 8, 16, Math.PI * 1.2), bronzeMat);
      handle.rotation.y = Math.PI / 2;
      handle.rotation.z = side * (Math.PI / 2.2);
      handle.position.set(side * 1.32, 1.3, 0);
      this.incenseUrnGroup.add(handle);
    }

    // Lòng tro cát cắm hương
    const ash = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 0.06, 32),
      new THREE.MeshStandardMaterial({ color: 0x8f877c, roughness: 1.0 })
    );
    ash.position.y = 1.6;
    this.incenseUrnGroup.add(ash);

    // Đốm lửa than hồng le lói
    const emberLight = new THREE.PointLight(0xff6a2a, 0.25, 2.5);
    emberLight.position.set(0, 2.1, 0);
    this.incenseUrnGroup.add(emberLight);

    this.incenseUrnGroup.position.set(x, 0, z);
    this.root.add(this.incenseUrnGroup);

    this.collisionCircles.push({ x, z, r: 1.35 });
  }

  // ===================== 6. CỔNG TAM QUAN MÁI CONG =====================
  private buildThreeArchGate() {
    const gate = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({
      map: getLacqueredWoodTexture(),
      roughness: 0.65,
      metalness: 0.15
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: getVietnameseCurvedRoofTexture(),
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.1
    });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x87888a, roughness: 0.9 });

    // 4 Trụ đá cổng
    const pillarX = [-5.6, -2.4, 2.4, 5.6];
    for (const px of pillarX) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), stoneMat);
      base.position.set(px, 0.3, 0);
      gate.add(base);

      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 5.2, 16), woodMat);
      col.position.set(px, 3.2, 0);
      col.castShadow = true;
      gate.add(col);
    }

    // Xà ngang đỏ son
    const beam = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.5, 0.9), woodMat);
    beam.position.set(0, 5.5, 0);
    gate.add(beam);

    // Bảng tên "TÂM AN TỰ"
    const plaqueMat = new THREE.MeshStandardMaterial({ map: createPlaqueTexture('TÂM AN TỰ', 'Cổng Tam Quan'), roughness: 0.45 });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.15, 0.15), plaqueMat);
    plaque.position.set(0, 4.4, 0.5);
    gate.add(plaque);

    // MÁI CONG CỔNG TAM QUAN (Dùng makeCurvedRoofGeometry)
    const gateRoof = makeRoofGroup(15.2, 4.2, 1.8, 1.6, roofMat);
    gateRoof.position.set(0, 5.8, 0);
    gateRoof.castShadow = true;
    gate.add(gateRoof);


    gate.position.set(0, 0, 36);
    this.root.add(gate);

    this.collisionBoxes.push(
      { minX: -6.2, maxX: -5.0, minZ: 35.4, maxZ: 36.6, type: 'impassable' },
      { minX: -3.0, maxX: -1.8, minZ: 35.4, maxZ: 36.6, type: 'impassable' },
      { minX: 1.8, maxX: 3.0, minZ: 35.4, maxZ: 36.6, type: 'impassable' },
      { minX: 5.0, maxX: 6.2, minZ: 35.4, maxZ: 36.6, type: 'impassable' }
    );
  }

  // ===================== 7. CHÍNH ĐIỆN 2 TẦNG MÁI CONG & LƯỠNG LONG CHẦU NGUYỆT =====================
  private buildMainHall() {
    const hall = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({
      map: getLacqueredWoodTexture(),
      roughness: 0.65,
      metalness: 0.15
    });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d9092, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({
      map: getVietnameseCurvedRoofTexture(),
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.1
    });

    // 1. Nền cao 0.9m ốp đá
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(22, 0.9, 16), stoneMat);
    terrace.position.set(0, 0.45, -12);
    terrace.receiveShadow = true;
    hall.add(terrace);

    // 5 Bậc thềm đá rộng ở giữa
    for (let s = 1; s <= 5; s++) {
      const stepH = 0.9 / 5;
      const step = new THREE.Mesh(new THREE.BoxGeometry(7.6, stepH * s, 0.5), stoneMat);
      step.position.set(0, (stepH * s) / 2, -4 + (5 - s) * 0.45);
      step.receiveShadow = true;
      hall.add(step);
    }

    // 2. Hệ cột đỏ son (#9b1c12) có chân tảng đá và đầu cột viền vàng
    const colZ = [-6.5, -11.5, -16.5];
    const colX = [-9.5, -5.5, 0, 5.5, 9.5];
    const goldRimMat = new THREE.MeshStandardMaterial({ color: 0xdeb841, metalness: 0.8, roughness: 0.25 });

    for (const z of colZ) {
      for (const x of colX) {
        if (z === -11.5 && Math.abs(x) < 4) continue; // Cửa chính thông thoáng
        if (x === 0) continue; // không đặt cột giữa: chắn lối đi và che tượng Phật

        // Chân tảng đá
        const colBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 0.35, 12), stoneMat);
        colBase.position.set(x, 1.05, z);
        hall.add(colBase);

        // Cột gỗ tròn
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 5.2, 16), woodMat);
        col.position.set(x, 3.8, z);
        col.castShadow = true;
        hall.add(col);

        // Đầu cột viền vàng kim
        const colCap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.36, 0.2, 12), goldRimMat);
        colCap.position.set(x, 6.4, z);
        hall.add(colCap);

        this.collisionBoxes.push({
          minX: x - 0.45,
          maxX: x + 0.45,
          minZ: z - 0.45,
          maxZ: z + 0.45,
          type: 'impassable'
        });
      }
    }

    // Tường gỗ và vách ngăn hoa văn
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6e1a14, roughness: 0.85 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 5.4, 0.5), wallMat);
    backWall.position.set(0, 3.6, -18.5);
    hall.add(backWall);

    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 12), wallMat);
      sideWall.position.set(side * 10, 3.6, -12.5);
      hall.add(sideWall);
    }

    // 3. CHÍNH ĐIỆN 2 TẦNG MÁI CHỒNG DIÊM CONG VÚT
    // Tầng mái 1 (Mái hạ dưới rộng 26 x 20m)
    const lowerRoof = makeRoofGroup(26.5, 20.5, 2.6, 1.8, roofMat);
    lowerRoof.position.set(0, 6.5, -12);
    lowerRoof.castShadow = true;
    hall.add(lowerRoof);

    // Cổ diêm giữa 2 tầng mái (dải tường gỗ đỏ)
    const clerestory = new THREE.Mesh(new THREE.BoxGeometry(16.5, 1.6, 12.5), woodMat);
    clerestory.position.set(0, 8.2, -12);
    hall.add(clerestory);

    // Hoành phi "ĐẠI HÙNG BẢO ĐIỆN" chữ vàng nền đỏ son (ngay trên cửa chính tiền đường như trong ảnh mẫu)
    const hpMat = new THREE.MeshStandardMaterial({ map: createPlaqueTexture('ĐẠI HÙNG BẢO ĐIỆN', 'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật'), roughness: 0.45 });
    const hp = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.35, 0.18), hpMat);
    hp.position.set(0, 5.8, -5.6);
    hall.add(hp);

    // Tầng mái 2 (Mái thượng trên 19.5 x 15m)
    const upperRoof = makeRoofGroup(20.0, 15.5, 2.8, 2.2, roofMat);
    upperRoof.position.set(0, 9.2, -12);
    upperRoof.castShadow = true;
    hall.add(upperRoof);

    // 4. "LƯỠNG LONG CHẦU NGUYỆT" TRÊN ĐỈNH NÓC
    this.buildTwinDragonsAndMoon(0, 12.0, -12, hall);

    // Đèn lồng đỏ đung đưa dọc hiên
    for (const lx of [-6.5, -3.2, 3.2, 6.5]) {
      this.createHangingLantern(lx, 6.2, -6.1, hall);
    }

    // Đôi Hạc cưỡi rùa bằng đồng vàng uy nghi chầu hai bên cửa chính điện (như trong ảnh mẫu)
    this.buildGoldenCraneOnTurtle(-4.6, 0.9, -5.6, 0.15, hall);
    this.buildGoldenCraneOnTurtle(4.6, 0.9, -5.6, -0.15, hall);

    // Tràng phan (dải lụa vàng) buông dài hai bên hiên chính điện (như trong ảnh mẫu)
    this.buildCeremonialBanners(hall);

    // 5. NỘI ĐIỆN: TƯỢNG PHẬT THÍCH CA THIỀN ĐỊNH VÀ BÀN THỜ
    this.buildAuthenticBuddhaAndAltar(hall);
    this.buildAttendantBodhisattvas(hall);

    this.root.add(hall);

    this.collisionBoxes.push(
      { minX: -3.8, maxX: 3.8, minZ: -16.8, maxZ: -12.5, type: 'impassable' },
      { minX: -11, maxX: 11, minZ: -19, maxZ: -18, type: 'impassable' },
      { minX: -10.5, maxX: -9.5, minZ: -19, maxZ: -6, type: 'impassable' },
      { minX: 9.5, maxX: 10.5, minZ: -19, maxZ: -6, type: 'impassable' }
    );
  }

  // "Lưỡng long chầu nguyệt": 2 rồng uốn lượn hướng vào viên ngọc phát sáng
  private buildTwinDragonsAndMoon(x: number, y: number, z: number, parent: THREE.Group) {
    const dragonGroup = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xdeb841,
      metalness: 0.85,
      roughness: 0.25
    });

    // Viên ngọc phát sáng ở giữa
    const pearl = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffe082,
        emissiveIntensity: 1.0,
        roughness: 0.2
      })
    );
    dragonGroup.add(pearl);

    // Ngọn lửa bao quanh viên ngọc (Châu Nguyệt)
    const flameGeo = new THREE.TorusGeometry(0.65, 0.08, 8, 16);
    const flame = new THREE.Mesh(flameGeo, goldMat);
    dragonGroup.add(flame);

    // 2 Rồng uốn lượn hai bên (uốn bằng Curve & TubeGeometry)
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.8, -0.2, 0),
        new THREE.Vector3(side * 2.2, 0.4, 0),
        new THREE.Vector3(side * 3.8, -0.1, 0),
        new THREE.Vector3(side * 5.2, 0.6, 0)
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.16, 8, false);
      const dragonBody = new THREE.Mesh(tubeGeo, goldMat);
      dragonGroup.add(dragonBody);

      // Đầu rồng ngoảnh về viên ngọc
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 6), goldMat);
      head.rotation.z = side * (Math.PI / 2.3);
      head.position.set(side * 0.9, 0.05, 0);
      dragonGroup.add(head);
    }

    dragonGroup.position.set(x, y, z);
    parent.add(dragonGroup);
  }

  // Đèn lồng đỏ treo hiên
  public createHangingLantern(x: number, y: number, z: number, parent: THREE.Group) {
    const group = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), new THREE.MeshBasicMaterial({ color: 0x1c1917 }));
    cord.position.y = -0.25;
    group.add(cord);

    const lanternMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xd91e18,
        emissive: 0x8a100c,
        emissiveIntensity: 0.6,
        roughness: 0.6
      })
    );
    lanternMesh.scale.set(1, 1.25, 1);
    lanternMesh.position.y = -0.7;
    group.add(lanternMesh);

    const capMat = new THREE.MeshStandardMaterial({ color: 0xd4a537, metalness: 0.7, roughness: 0.3 });
    for (const cy of [-0.27, -1.13]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), capMat);
      cap.position.y = cy;
      group.add(cap);
    }

    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.35), new THREE.MeshBasicMaterial({ color: 0xffd54f }));
    tassel.position.y = -1.15;
    group.add(tassel);

    this.glowMaterials.push(lanternMesh.material as THREE.MeshStandardMaterial);

    group.position.set(x, y, z);
    parent.add(group);
  }

  // Đôi Hạc cưỡi quy (Hạc đứng trên lưng rùa) bằng đồng vàng uy nghi chầu hai bên cửa chính điện (như trong ảnh mẫu)
  // ===================== HÌNH KHỐI DÙNG CHUNG CHO TƯỢNG =====================
  // Tô màu (có thể chuyển sắc theo trục Y) rồi đặt hình vào vị trí; trả về hình không index để gộp
  public static paint(geo: THREE.BufferGeometry, c0: number, c1?: number, yMin = 0, yMax = 1, matrix?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const pos = g.attributes.position;
    const a = new THREE.Color(c0);
    const b = new THREE.Color(c1 ?? c0);
    const tmp = new THREE.Color();
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) - yMin) / (yMax - yMin || 1)));
      tmp.copy(a).lerp(b, t);
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (matrix) g.applyMatrix4(matrix);
    return g;
  }

  public static mergeAll(list: THREE.BufferGeometry[]) {
    const m = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    return m;
  }

  // Cánh sen / lông vũ: hình lá nhọn đùn dày, dài theo +Y, mặt ngoài hướng +Z, đầu cong ra ngoài
  public static leafBlade(len: number, wid: number, thick: number, bend = 0.25) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(wid, len * 0.42, 0, len);
    sh.quadraticCurveTo(-wid, len * 0.42, 0, 0);
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: thick,
      bevelEnabled: true,
      bevelThickness: thick * 0.6,
      bevelSize: wid * 0.12,
      bevelSegments: 2,
      curveSegments: 10
    });
    g.translate(0, 0, -thick / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / len;
      p.setZ(i, p.getZ(i) + bend * len * t * t);
    }
    g.computeVertexNormals();
    return g;
  }

  // Ma trận đặt 1 cánh: nghiêng ra ngoài (tilt) rồi xoay quanh trục đứng tới góc a, cách tâm r
  public static ringMatrix(a: number, r: number, y: number, tilt: number, scale = 1) {
    const e = new THREE.Euler(tilt, a, 0, 'YXZ');
    return new THREE.Matrix4().compose(
      new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r),
      new THREE.Quaternion().setFromEuler(e),
      new THREE.Vector3(scale, scale, scale)
    );
  }

  // Đài sen nhiều tầng cánh nhọn, chuyển sắc từ gốc tới đầu cánh
  public static lotusThrone(tiers: { n: number; r: number; y: number; len: number; wid: number; tilt: number; c0: number; c1: number }[]) {
    const parts: THREE.BufferGeometry[] = [];
    tiers.forEach((t, ti) => {
      for (let i = 0; i < t.n; i++) {
        const a = (i / t.n) * Math.PI * 2 + (ti % 2) * (Math.PI / t.n);
        const g = TempleWorld.leafBlade(t.len, t.wid, t.len * 0.06, 0.3);
        parts.push(TempleWorld.paint(g, t.c0, t.c1, 0, t.len, TempleWorld.ringMatrix(a, t.r, t.y, t.tilt)));
      }
    });
    return TempleWorld.mergeAll(parts);
  }

  // Ống thon dần theo đường cong (cổ hạc, dải lụa…)
  public static taperTube(curve: THREE.Curve<THREE.Vector3>, seg: number, r0: number, r1: number, radial = 10) {
    const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
    const pos = g.attributes.position;
    const P = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      curve.getPointAt(t, P);
      const r = r0 + (r1 - r0) * t;
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(P).multiplyScalar(r).add(P);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    return g;
  }

  // Khối tròn nối 2 điểm (tay, chân, cành)
  public static capsuleBetween(a: THREE.Vector3, b: THREE.Vector3, r: number) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CapsuleGeometry(r, Math.max(0.01, dir.length()), 4, 12);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  }

  // Áo tiện tròn có nếp gấp dọc ở phần dưới (pleats)
  public static pleatedLathe(profile: THREE.Vector2[], seg: number, folds: number, depth: number, foldTop: number, phiStart = 0, phiLength = Math.PI * 2) {
    const g = new THREE.LatheGeometry(profile, seg, phiStart, phiLength);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y >= foldTop) continue;
      const x = p.getX(i);
      const z = p.getZ(i);
      const phi = Math.atan2(x, z);
      const k = 1 + depth * Math.sin(phi * folds) * ((foldTop - y) / foldTop);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    g.computeVertexNormals();
    return g;
  }

  // Hạc đồng đứng trên lưng rùa: rùa mai vảy lục giác, hạc cổ thon chữ S, cánh xếp nhiều lớp lông, mào đỏ, ngậm hoa sen
  private buildGoldenCraneOnTurtle(x: number, y: number, z: number, ry: number, parent: THREE.Group) {
    const group = new THREE.Group();
    const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
    const bronze = new THREE.MeshStandardMaterial({ color: 0x9b7a3e, metalness: 0.8, roughness: 0.32 });
    const bronzeDark = new THREE.MeshStandardMaterial({ color: 0x5e4422, metalness: 0.75, roughness: 0.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8b04c, metalness: 0.85, roughness: 0.25 });
    const featherMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.72, roughness: 0.34, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      group.add(m);
      return m;
    };

    // ---- Bệ đá ----
    const plinth = add(new THREE.CylinderGeometry(0.92, 1.02, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x8d8a83, roughness: 0.85 }));
    plinth.position.y = 0.08;

    // ---- Rùa ----
    const belly = add(new THREE.CylinderGeometry(0.6, 0.62, 0.12, 24), bronzeDark);
    belly.scale.z = 1.22;
    belly.position.y = 0.22;
    const R = V(0.62, 0.4, 0.84);
    const C = V(0, 0.26, 0);
    const shell = add(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), bronzeDark);
    shell.scale.copy(R);
    shell.position.copy(C);
    const rim = add(new THREE.TorusGeometry(1, 0.06, 8, 40), goldMat);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(R.x, R.z, 1);
    rim.position.set(0, 0.27, 0);
    // vảy mai lục giác bám theo mặt cong
    const scuteGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.04, 6);
    const dirs = [V(0, 1, -0.55), V(0, 1, 0), V(0, 1, 0.55), V(0.62, 0.85, -0.35), V(-0.62, 0.85, -0.35), V(0.62, 0.85, 0.35), V(-0.62, 0.85, 0.35),
      V(0.95, 0.35, 0), V(-0.95, 0.35, 0), V(0.55, 0.4, 0.8), V(-0.55, 0.4, 0.8), V(0.55, 0.4, -0.8), V(-0.55, 0.4, -0.8)];
    const scutes = new THREE.InstancedMesh(scuteGeo, bronze, dirs.length);
    const sd = new THREE.Object3D();
    dirs.forEach((d0, i) => {
      const d = d0.clone().normalize();
      const p = V(C.x + d.x * R.x, C.y + d.y * R.y, C.z + d.z * R.z);
      const n = V(d.x / R.x, d.y / R.y, d.z / R.z).normalize();
      sd.position.copy(p).addScaledVector(n, 0.005);
      sd.quaternion.setFromUnitVectors(V(0, 1, 0), n);
      sd.scale.set(i < 3 ? 1.1 : 0.9, 1, i < 3 ? 1.1 : 0.9);
      sd.updateMatrix();
      scutes.setMatrixAt(i, sd.matrix);
    });
    scutes.castShadow = true;
    group.add(scutes);
    // đầu rùa ngẩng, mắt, chân chèo, đuôi
    add(TempleWorld.capsuleBetween(V(0, 0.3, 0.78), V(0, 0.52, 1.04), 0.095), bronzeDark);
    const tHead = add(new THREE.SphereGeometry(1, 18, 14), bronzeDark);
    tHead.scale.set(0.12, 0.1, 0.17);
    tHead.position.set(0, 0.6, 1.12);
    for (const s of [-1, 1]) {
      const e = add(new THREE.SphereGeometry(0.02, 8, 6), eyeMat);
      e.position.set(s * 0.085, 0.64, 1.18);
      for (const fz of [0.55, -0.55]) {
        const tip = V(s * 0.76, 0.07, fz + Math.sign(fz) * 0.22);
        add(TempleWorld.capsuleBetween(V(s * 0.45, 0.22, fz), tip, 0.085), bronzeDark);
        const foot = add(new THREE.SphereGeometry(1, 12, 8), bronzeDark);
        foot.scale.set(0.13, 0.05, 0.1);
        foot.position.copy(tip);
      }
    }
    const tail = add(new THREE.ConeGeometry(0.07, 0.28, 10), bronzeDark);
    tail.rotation.x = -Math.PI / 2 - 0.3;
    tail.position.set(0, 0.22, -1.0);

    // ---- Hạc ----
    const top = C.y + R.y; // mặt mai
    // chân: ngón bám mai -> ống chân mảnh -> khớp gối -> đùi lông
    for (const s of [-1, 1]) {
      const foot = V(s * 0.14, top + 0.01, 0.05);
      for (const a of [-0.45, 0, 0.45]) add(TempleWorld.capsuleBetween(foot, foot.clone().add(V(Math.sin(a) * 0.17, -0.01, Math.cos(a) * 0.17)), 0.018), goldMat);
      add(TempleWorld.capsuleBetween(foot, foot.clone().add(V(0, -0.01, -0.12)), 0.016), goldMat);
      const knee = V(s * 0.12, 1.3, -0.04);
      add(TempleWorld.capsuleBetween(foot, knee, 0.026), goldMat);
      const kj = add(new THREE.SphereGeometry(0.042, 10, 8), goldMat);
      kj.position.copy(knee);
      add(TempleWorld.capsuleBetween(knee, V(s * 0.1, 1.62, 0.02), 0.065), bronze);
    }
    // thân giọt nước nghiêng về trước
    const body = add(new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.14, 0.05), new THREE.Vector2(0.25, 0.25),
      new THREE.Vector2(0.27, 0.45), new THREE.Vector2(0.21, 0.72), new THREE.Vector2(0.11, 0.9), new THREE.Vector2(0, 0.96)
    ], 28), bronze);
    body.scale.x = 0.92;
    body.rotation.x = 1.15;
    body.position.set(0, 1.56, -0.44);
    // cổ cong chữ S thon dần
    const neckCurve = new THREE.CatmullRomCurve3([V(0, 1.9, 0.33), V(0, 2.18, 0.5), V(0, 2.52, 0.36), V(0, 2.84, 0.4), V(0, 3.0, 0.5)]);
    add(TempleWorld.taperTube(neckCurve, 32, 0.095, 0.05, 12), bronze);
    // đầu, mào đỏ, mắt, mỏ dài
    const head = add(new THREE.SphereGeometry(1, 20, 16), bronze);
    head.scale.set(0.075, 0.08, 0.115);
    head.position.set(0, 3.02, 0.54);
    const crest = add(new THREE.SphereGeometry(0.055, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc0261c, roughness: 0.35, metalness: 0.2 }));
    crest.scale.set(1, 0.6, 1.2);
    crest.position.set(0, 3.075, 0.53);
    for (const s of [-1, 1]) {
      const e = add(new THREE.SphereGeometry(0.016, 8, 6), eyeMat);
      e.position.set(s * 0.06, 3.045, 0.59);
    }
    const beakDir = V(0, -0.3, 1).normalize();
    const beak = add(new THREE.ConeGeometry(0.032, 0.42, 12), goldMat);
    beak.quaternion.setFromUnitVectors(V(0, 1, 0), beakDir);
    beak.position.set(0, 3.0, 0.62).addScaledVector(beakDir, 0.21);
    // cành sen ngậm ở mỏ
    add(TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(0, 2.94, 0.8), V(0.02, 3.12, 0.86), V(0.04, 3.36, 0.84)]), 10, 0.014, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0x5f8a2c, roughness: 0.6 }));
    const bud = add(TempleWorld.lotusThrone([
      { n: 6, r: 0.02, y: 0, len: 0.16, wid: 0.07, tilt: 0.35, c0: 0xfff0f5, c1: 0xe8789f },
      { n: 5, r: 0.01, y: 0.01, len: 0.14, wid: 0.06, tilt: 0.1, c0: 0xffffff, c1: 0xef93b4 }
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }));
    bud.position.set(0.04, 3.35, 0.84);

    // cánh xếp: 3 lớp lông (lông bay đầu đen, lông phụ, lông bao) + đuôi xoè
    const feathers: THREE.BufferGeometry[] = [];
    const placeFeather = (root: THREE.Vector3, dir: THREE.Vector3, out: THREE.Vector3, len: number, wid: number, c0: number, c1: number) => {
      const yA = dir.clone().normalize();
      const zA = out.clone().addScaledVector(yA, -out.dot(yA)).normalize();
      const xA = new THREE.Vector3().crossVectors(yA, zA);
      const m = new THREE.Matrix4().makeBasis(xA, yA, zA).setPosition(root);
      feathers.push(TempleWorld.paint(TempleWorld.leafBlade(len, wid, 0.014, -0.12), c0, c1, 0, len, m));
    };
    for (const s of [-1, 1]) {
      const out = V(s, 0.3, 0);
      const rows = [
        { n: 7, len: 0.86, wid: 0.075, off: 0.0, dy: -0.04, c0: 0x9b7a3e, c1: 0x2e2114 },
        { n: 6, len: 0.58, wid: 0.075, off: 0.025, dy: 0.04, c0: 0xa98640, c1: 0xd9b45a },
        { n: 5, len: 0.34, wid: 0.07, off: 0.05, dy: 0.1, c0: 0xc9a24a, c1: 0xe8c66c }
      ];
      rows.forEach((r) => {
        for (let i = 0; i < r.n; i++) {
          const t = i / (r.n - 1);
          const root = V(s * (0.245 + r.off), 1.9 - t * 0.2 + r.dy, 0.22 - t * 0.5);
          const dir = V(s * 0.06, -0.32 - t * 0.12, -1);
          placeFeather(root, dir, out, r.len * (1 - t * 0.15), r.wid, r.c0, r.c1);
        }
      });
    }
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.16;
      placeFeather(V(Math.sin(a) * 0.08, 1.6, -0.42), V(Math.sin(a) * 0.5, -0.6, -1), V(0, 1, 0), 0.5, 0.08, 0x5a4222, 0x24190e);
    }
    add(TempleWorld.mergeAll(feathers), featherMat);

    group.position.set(x, y, z);
    group.rotation.y = ry;
    parent.add(group);
  }

  // Tràng phan (dải lụa vàng treo trang nghiêm hai bên cửa chính điện như trong ảnh mẫu)
  private buildCeremonialBanners(parent: THREE.Group) {
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Lụa vàng hoàng y
      roughness: 0.6,
      side: THREE.DoubleSide
    });
    const redBorderMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.7
    });

    for (const bx of [-5.8, 5.8]) {
      const bannerGroup = new THREE.Group();

      // Dải lụa chính buông dài 3.8m
      const silk = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 3.8), bannerMat);
      silk.position.y = -1.9;
      bannerGroup.add(silk);

      // Viền đỏ hai bên mép lụa
      for (const side of [-0.275, 0.275]) {
        const border = new THREE.Mesh(new THREE.BoxGeometry(0.035, 3.8, 0.02), redBorderMat);
        border.position.set(side, -1.9, 0.01);
        bannerGroup.add(border);
      }

      // Đỉnh treo xà ngang gỗ
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72), new THREE.MeshStandardMaterial({ color: 0xdeb841 }));
      rod.rotation.z = Math.PI / 2;
      bannerGroup.add(rod);

      // Tua rua đỏ ở đuôi tràng phan
      for (let t = -2; t <= 2; t++) {
        const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.4), redBorderMat);
        tassel.position.set(t * 0.1, -3.95, 0);
        bannerGroup.add(tassel);
      }

      bannerGroup.position.set(bx, 6.8, -5.6);
      parent.add(bannerGroup);
    }
  }

  // ===================== 8. TƯỢNG PHẬT THÍCH CA THIỀN ĐỊNH ĐÍCH THỰC =====================
  // Đài sen 2 tầng cánh, chân xếp bằng, tay đặt trong lòng (ấn thiền định), nhục kế, tai dài, vàng kim (#d4a537, metalness 0.85)
  public buildAuthenticBuddhaAndAltar(parent: THREE.Group) {
    const altar = new THREE.Group();
    altar.position.set(0, 0.9, -14.5);
    // Tượng + đài sen gom thành một nhóm (thiền đường phóng to tượng, đặt lên bệ cao)
    const statue = new THREE.Group();
    altar.add(statue);
    altar.userData.statue = statue;

    // Bàn thờ gỗ chạm trổ sơn then
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x4a120e, roughness: 0.5, metalness: 0.2 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 1.8), tableMat);
    table.position.set(0, 0.6, 0.9);
    table.castShadow = true;
    altar.add(table);

    const cloth = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.05, 1.7), new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }));
    cloth.position.set(0, 1.22, 0.9);
    altar.add(cloth);

    // Nến đôi lung linh trên bàn thờ
    for (const cx of [-1.8, 1.8]) {
      const candlestick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.5), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 }));
      candlestick.position.set(cx, 1.48, 0.9);
      altar.add(candlestick);

      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.45), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
      wax.position.set(cx, 1.9, 0.9);
      altar.add(wax);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), new THREE.MeshBasicMaterial({ color: 0xffd54f }));
      flame.position.set(cx, 2.18, 0.9);
      altar.add(flame);

      const candleLight = new THREE.PointLight(0xffa726, 0.9, 4.5);
      candleLight.position.set(cx, 2.22, 0.9);
      altar.add(candleLight);
      this.nightLights.push(candleLight);
    }

    // ĐÀI SEN 3 TẦNG CÁNH NHỌN (hồng phấn chuyển hồng sen, viền vàng)
    const goldBuddhaMat = new THREE.MeshStandardMaterial({
      color: 0xd4a537,
      metalness: 0.8,
      roughness: 0.32
    });
    const goldDoubleMat = goldBuddhaMat.clone();
    goldDoubleMat.side = THREE.DoubleSide;
    const lotusMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 });

    const throne = new THREE.Mesh(
      TempleWorld.lotusThrone([
        { n: 16, r: 1.4, y: 1.18, len: 0.7, wid: 0.42, tilt: 0.78, c0: 0xf7d9e4, c1: 0xe0628f },
        { n: 14, r: 1.3, y: 1.4, len: 0.66, wid: 0.4, tilt: 0.5, c0: 0xfbe3ec, c1: 0xe8789f },
        { n: 12, r: 1.2, y: 1.6, len: 0.56, wid: 0.38, tilt: 0.28, c0: 0xfff0f5, c1: 0xef93b4 }
      ]),
      lotusMat
    );
    throne.position.z = -0.6;
    throne.castShadow = true;
    statue.add(throne);

    // Đế đài sen: bệ bát giác vàng + mặt đài
    const pedestalBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.55, 8), goldBuddhaMat);
    pedestalBase.position.set(0, 1.45, -0.6);
    statue.add(pedestalBase);
    const pedestalBand = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.05, 8, 48), goldBuddhaMat);
    pedestalBand.rotation.x = Math.PI / 2;
    pedestalBand.position.set(0, 1.22, -0.6);
    statue.add(pedestalBand);
    const pedestalTop = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.22, 0.16, 40), goldBuddhaMat);
    pedestalTop.position.set(0, 1.95, -0.6);
    statue.add(pedestalTop);
    // Gương sen (đài nhuỵ) viền hạt
    const seedRing = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), goldBuddhaMat, 40);
    const sd = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      sd.position.set(Math.sin(a) * 1.27, 2.03, Math.cos(a) * 1.27 - 0.6);
      sd.updateMatrix();
      seedRing.setMatrixAt(i, sd.matrix);
    }
    statue.add(seedRing);

    // TƯỢNG PHẬT NGỒI KIẾT GIÀ, THỦ ẤN THIỀN ĐỊNH
    const buddha = new THREE.Group();
    buddha.position.set(0, 2.04, -0.6);
    const addG = (g: THREE.BufferGeometry, mat: THREE.Material = goldBuddhaMat) => {
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      buddha.add(m);
      return m;
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

    // 1. Chân xếp bằng + y phủ đài sen (vạt áo buông xuống trước đài)
    const lap = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.3, 8, 24), goldBuddhaMat);
    lap.rotation.z = Math.PI / 2;
    lap.scale.set(1, 1, 1.4);
    lap.position.set(0, 0.36, 0.14);
    buddha.add(lap);
    for (const side of [-1, 1]) {
      const sole = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), goldBuddhaMat);
      sole.scale.set(1.35, 0.42, 0.75);
      sole.position.set(side * 0.4, 0.7, 0.44);
      sole.rotation.y = side * 0.5;
      buddha.add(sole);
    }
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 1.05, 0.46, 32, 1, true, -0.95, 1.9),
      goldDoubleMat
    );
    apron.position.set(0, 0.06, 0.08);
    buddha.add(apron);
    // 2. Thân trên: vai xuôi, ngực đầy, eo thon
    const torsoProfile = [
      V(0, 0, 0), V(0.78, 0, 0), V(0.8, 0.3, 0), V(0.7, 0.85, 0), V(0.72, 1.25, 0),
      V(0.62, 1.52, 0), V(0.36, 1.68, 0), V(0.2, 1.72, 0), V(0, 1.73, 0)
    ].map((v) => new THREE.Vector2(v.x, v.y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 40), goldBuddhaMat);
    torso.scale.set(1, 1, 0.66);
    torso.position.y = 0.42;
    torso.castShadow = true;
    buddha.add(torso);

    // Y cà sa vắt vai trái: dải vải chéo ngực + mép áo + nếp gấp ngực
    addG(TempleWorld.taperTube(new THREE.CatmullRomCurve3([
      V(0.55, 2.0, -0.12), V(0.3, 1.78, 0.42), V(-0.15, 1.42, 0.5), V(-0.55, 1.05, 0.42), V(-0.72, 0.72, 0.3)
    ]), 24, 0.075, 0.06, 8));
    addG(TempleWorld.taperTube(new THREE.CatmullRomCurve3([
      V(0.66, 1.98, 0.05), V(0.78, 1.5, 0.22), V(0.8, 1.0, 0.25)
    ]), 12, 0.05, 0.04, 6));
    for (let i = 0; i < 3; i++) {
      const y = 1.25 - i * 0.18;
      addG(TempleWorld.taperTube(new THREE.CatmullRomCurve3([
        V(-0.45, y + 0.12, 0.43), V(-0.1, y, 0.47), V(0.25, y - 0.12, 0.42)
      ]), 10, 0.022, 0.012, 6));
    }

    // 3. Hai tay: vai -> khuỷu -> bàn tay chồng nhau trong lòng (thiền định ấn), ống tay áo rộng
    for (const side of [-1, 1]) {
      const shoulder = V(side * 0.64, 1.9, 0.0);
      const elbow = V(side * 0.84, 1.12, 0.2);
      const wrist = V(side * 0.26, 0.86, 0.56);
      addG(TempleWorld.capsuleBetween(shoulder, elbow, 0.2));
      addG(TempleWorld.capsuleBetween(elbow, wrist, 0.155));
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), goldBuddhaMat);
      cuff.position.copy(wrist).lerp(elbow, 0.22);
      cuff.quaternion.setFromUnitVectors(V(0, 0, 1), elbow.clone().sub(wrist).normalize());
      buddha.add(cuff);
    }
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), goldBuddhaMat);
    handL.scale.set(1.05, 0.32, 0.7);
    handL.position.set(0, 0.84, 0.6);
    buddha.add(handL);
    const handR = handL.clone();
    handR.scale.set(0.95, 0.3, 0.62);
    handR.position.set(0, 0.92, 0.62);
    buddha.add(handR);
    for (const side of [-1, 1]) {
      // hai đầu ngón cái chạm nhau
      addG(TempleWorld.capsuleBetween(V(side * 0.24, 0.96, 0.66), V(side * 0.02, 1.02, 0.7), 0.04));
    }

    // 4. Cổ ba ngấn, đầu, khuôn mặt hiền từ
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.32, 20), goldBuddhaMat);
    neck.position.y = 2.22;
    buddha.add(neck);
    for (const ny of [2.14, 2.22]) {
      const fold = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.012, 6, 28), goldBuddhaMat);
      fold.rotation.x = Math.PI / 2;
      fold.position.y = ny;
      buddha.add(fold);
    }
    const headC = V(0, 2.68, 0);
    const headR = V(0.46, 0.54, 0.47);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), goldBuddhaMat);
    head.scale.copy(headR);
    head.position.copy(headC);
    head.castShadow = true;
    buddha.add(head);

    const faceMat = new THREE.MeshStandardMaterial({ color: 0x6b4514, roughness: 0.55, metalness: 0.4 });
    for (const side of [-1, 1]) {
      // mắt khép hờ nhìn xuống, mày cong lá liễu
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.009, 6, 16, Math.PI * 0.8), faceMat);
      eye.position.set(side * 0.16, 2.67, 0.43);
      eye.rotation.set(-0.2, side * 0.25, Math.PI + Math.PI * 0.1);
      buddha.add(eye);
      const brow = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 18, Math.PI * 0.75), goldBuddhaMat);
      brow.position.set(side * 0.16, 2.7, 0.425);
      brow.rotation.set(-0.25, side * 0.3, Math.PI * 0.125);
      buddha.add(brow);
      // tai dài chạm vai
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), goldBuddhaMat);
      ear.scale.set(0.06, 0.19, 0.13);
      ear.position.set(side * 0.455, 2.56, -0.02);
      buddha.add(ear);
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), goldBuddhaMat);
      lobe.scale.set(0.8, 1.4, 1);
      lobe.position.set(side * 0.46, 2.38, 0.0);
      buddha.add(lobe);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), goldBuddhaMat);
    nose.scale.set(0.055, 0.1, 0.07);
    nose.position.set(0, 2.56, 0.46);
    buddha.add(nose);
    const urna = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), faceMat);
    urna.position.set(0, 2.82, 0.455);
    buddha.add(urna);
    const lips = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 14, Math.PI), faceMat);
    lips.position.set(0, 2.44, 0.44);
    lips.rotation.set(-0.15, 0, Math.PI);
    buddha.add(lips);

    // Tóc xoắn ốc phủ kín đầu (chân tóc cao ở trán, thấp dần ra sau gáy) + nhục kế
    const curlGeo = new THREE.SphereGeometry(0.045, 7, 5);
    const curlPts: THREE.Vector3[] = [];
    const N = 420;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rr = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      const d = V(Math.cos(a) * rr, y, Math.sin(a) * rr);
      if (d.y > 0.08 + 0.34 * Math.max(0, d.z)) curlPts.push(d);
    }
    const ushC = V(0, 3.2, -0.02);
    const ushR = 0.25;
    const ushN = 70;
    const curls = new THREE.InstancedMesh(curlGeo, goldBuddhaMat, curlPts.length + ushN);
    const cd = new THREE.Object3D();
    curlPts.forEach((d, i) => {
      cd.position.set(headC.x + d.x * headR.x, headC.y + d.y * headR.y, headC.z + d.z * headR.z);
      cd.updateMatrix();
      curls.setMatrixAt(i, cd.matrix);
    });
    for (let i = 0; i < ushN; i++) {
      const y = 1 - (i / (ushN - 1)) * 1.3;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * 2.39996;
      cd.position.set(ushC.x + Math.cos(a) * rr * ushR, ushC.y + y * ushR, ushC.z + Math.sin(a) * rr * ushR);
      cd.updateMatrix();
      curls.setMatrixAt(curlPts.length + i, cd.matrix);
    }
    buddha.add(curls);
    const ushnisha = new THREE.Mesh(new THREE.SphereGeometry(ushR * 0.95, 20, 14), goldBuddhaMat);
    ushnisha.position.copy(ushC);
    buddha.add(ushnisha);
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.25, metalness: 0.3, emissive: 0x5a0808, emissiveIntensity: 0.4 }));
    jewel.position.set(0, 3.47, 0);
    jewel.scale.set(1, 1.3, 1);
    buddha.add(jewel);

    // 5. HÀO QUANG HÌNH LÁ ĐỀ phía sau: khung vàng, lòng đỏ son, viền ngọn lửa
    const leafShape = (w: number, h: number) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.bezierCurveTo(w * 0.75, 0, w, h * 0.35, w * 0.72, h * 0.62);
      s.bezierCurveTo(w * 0.45, h * 0.85, w * 0.12, h * 0.9, 0, h);
      s.bezierCurveTo(-w * 0.12, h * 0.9, -w * 0.45, h * 0.85, -w * 0.72, h * 0.62);
      s.bezierCurveTo(-w, h * 0.35, -w * 0.75, 0, 0, 0);
      return s;
    };
    const mandorla = new THREE.Mesh(
      new THREE.ExtrudeGeometry(leafShape(1.55, 3.7), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 2, curveSegments: 24 }),
      goldBuddhaMat
    );
    mandorla.position.set(0, -0.1, -0.86);
    buddha.add(mandorla);
    const inner = new THREE.Mesh(
      new THREE.ExtrudeGeometry(leafShape(1.32, 3.3), { depth: 0.04, bevelEnabled: false, curveSegments: 24 }),
      new THREE.MeshStandardMaterial({ color: 0x7c1712, roughness: 0.6, metalness: 0.15 })
    );
    inner.position.set(0, 0.12, -0.76);
    buddha.add(inner);
    // ngọn lửa vàng dọc viền
    const flamePts = leafShape(1.6, 3.78).getSpacedPoints(42);
    const flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.22, 6), goldBuddhaMat, flamePts.length);
    const fd = new THREE.Object3D();
    flamePts.forEach((pt, i) => {
      fd.position.set(pt.x, pt.y - 0.12, -0.8);
      fd.rotation.set(0, 0, -Math.atan2(pt.x, pt.y - 1.7));
      fd.updateMatrix();
      flames.setMatrixAt(i, fd.matrix);
    });
    buddha.add(flames);
    // vầng hào quang đầu: đĩa vàng + 2 vòng
    for (const [r, tube] of [[0.95, 0.04], [0.72, 0.025]] as [number, number][]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 64), goldBuddhaMat);
      ring.position.set(0, 2.72, -0.68);
      buddha.add(ring);
    }

    // Ánh hào quang phát sáng nhẹ (đã giảm để không chói)
    const haloTex = createHaloTexture();
    const headHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 })
    );
    headHalo.position.set(0, 2.72, -0.62);
    buddha.add(headHalo);
    this.buddhaHalo = headHalo;

    const bodyHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 3.8),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.22 })
    );
    bodyHalo.position.set(0, 1.45, -0.66);
    buddha.add(bodyHalo);

    const haloLight = new THREE.PointLight(0xffd54f, 1.1, 9);
    haloLight.position.set(0, 2.4, 1.2);
    buddha.add(haloLight);

    // Mâm quả & bình hoa sen trên bàn thờ
    const fruitColors = [0xf59e0b, 0xdc2626, 0x84cc16, 0xfacc15, 0xf97316];
    for (const fx of [-1.0, 1.0]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 }));
      plate.position.set(fx, 1.31, 0.95);
      altar.add(plate);
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI * 2;
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshStandardMaterial({ color: fruitColors[i % fruitColors.length], roughness: 0.5 }));
        if (i === 6) fruit.position.set(fx, 1.56, 0.95);
        else fruit.position.set(fx + Math.cos(a) * 0.17, 1.44, 0.95 + Math.sin(a) * 0.17);
        altar.add(fruit);
      }
    }
    for (const vx of [-2.35, 2.35]) {
      const vase = new THREE.Mesh(
        new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.14, 0.02), new THREE.Vector2(0.18, 0.18), new THREE.Vector2(0.08, 0.38), new THREE.Vector2(0.11, 0.48)], 20),
        new THREE.MeshStandardMaterial({ color: 0x2b5ea8, roughness: 0.25, metalness: 0.1 })
      );
      vase.position.set(vx, 1.25, 0.6);
      altar.add(vase);
      const bud = new THREE.Mesh(
        TempleWorld.lotusThrone([
          { n: 6, r: 0.03, y: 0, len: 0.2, wid: 0.09, tilt: 0.45, c0: 0xffe4ee, c1: 0xe8789f },
          { n: 5, r: 0.02, y: 0.02, len: 0.18, wid: 0.08, tilt: 0.15, c0: 0xffeef4, c1: 0xef93b4 }
        ]),
        lotusMat
      );
      bud.position.set(vx, 2.15, 0.6);
      altar.add(bud);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45), new THREE.MeshStandardMaterial({ color: 0x4d7c0f }));
      stem.position.set(vx, 1.92, 0.6);
      altar.add(stem);
    }

    statue.add(buddha);
    this.altarGroup = altar;
    parent.add(altar);
  }

  // ===================== 9. LẦU CHUÔNG & TRỐNG 2 TẦNG MÁI CONG (ĐÚNG THEO ẢNH MẪU) =====================
  private buildBellAndDrumPavilion() {
    const pavilion = new THREE.Group();
    pavilion.position.set(18, 0, 8);

    const woodMat = new THREE.MeshStandardMaterial({ map: getLacqueredWoodTexture(), roughness: 0.65 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x828486, roughness: 0.88 });
    const roofMat = new THREE.MeshStandardMaterial({ map: getVietnameseCurvedRoofTexture(),
      side: THREE.DoubleSide, roughness: 0.55 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xdeb841, metalness: 0.85, roughness: 0.25 });

    // 1. Nền đá 2 tầng kiên cố
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, 0.6, 8), stoneMat);
    base.position.y = 0.3;
    base.receiveShadow = true;
    pavilion.add(base);

    // 2. TẦNG 1: TRỐNG BÁT NHÃ VÀ HỆ CỘT GỖ ĐỎ
    const colOffsets = [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]];
    for (const [cx, cz] of colOffsets) {
      // Chân tảng đá
      const colBase = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.25, 8), stoneMat);
      colBase.position.set(cx, 0.72, cz);
      pavilion.add(colBase);

      // Cột gỗ đỏ tầng 1
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 4.2, 12), woodMat);
      col.position.set(cx, 2.8, cz);
      col.castShadow = true;
      pavilion.add(col);
    }

    // Xà gồ tầng 1
    const beamLow = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 5.2), woodMat);
    beamLow.position.y = 4.9;
    pavilion.add(beamLow);

    // Mái tầng 1 cong vút
    const lowerRoof = makeRoofGroup(7.2, 7.2, 2.2, 1.8, roofMat);
    lowerRoof.position.set(0, 5.1, 0);
    lowerRoof.castShadow = true;
    pavilion.add(lowerRoof);

    // TRỐNG BÁT NHÃ TREO DƯỚI XÀ (TẦNG 1): treo bằng dây thừng, không chạm đất
    const drumGroup = new THREE.Group();
    const drumR = 0.82;
    const drumBody = new THREE.Mesh(new THREE.CylinderGeometry(drumR, drumR, 1.2, 28), new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55 }));
    drumBody.rotation.x = Math.PI / 2;
    drumGroup.add(drumBody);

    // Đai nẹp vàng kim + đinh tán quanh hai mặt trống
    for (const dz of [-0.6, -0.3, 0.3, 0.6]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(drumR + 0.01, Math.abs(dz) > 0.5 ? 0.05 : 0.03, 8, 32), goldMat);
      hoop.position.z = dz;
      drumGroup.add(hoop);
    }
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc2, roughness: 0.9 });
    for (const dir of [-0.61, 0.61]) {
      const skin = new THREE.Mesh(new THREE.CircleGeometry(drumR - 0.03, 32), skinMat);
      skin.position.z = dir;
      if (dir < 0) skin.rotation.y = Math.PI;
      drumGroup.add(skin);
      // Vòng âm dương đỏ giữa mặt trống
      const mark = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 24), new THREE.MeshStandardMaterial({ color: 0xb91c1c, side: THREE.DoubleSide }));
      mark.position.z = dir * 1.002;
      drumGroup.add(mark);
    }
    // Khoen đồng 2 bên để buộc dây treo
    for (const sx of [-0.55, 0.55]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12), goldMat);
      ring.position.set(sx, drumR - 0.05, 0);
      ring.rotation.y = Math.PI / 2;
      drumGroup.add(ring);
    }

    // Trống đung đưa quanh điểm treo (pivot) dưới xà
    const drumPivot = new THREE.Group();
    drumPivot.position.set(0, 4.7, 0);
    drumGroup.position.set(0, 2.25 - 4.7, 0);
    drumPivot.add(drumGroup);
    const drumRopeMat = new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.95 });
    for (const sx of [-0.55, 0.55]) {
      const ropeLen = 4.7 - (2.25 + drumR - 0.05);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, ropeLen, 6), drumRopeMat);
      rope.position.set(sx * 1.25, -ropeLen / 2, 0);
      rope.rotation.z = sx > 0 ? -0.18 : 0.18;
      drumPivot.add(rope);
    }
    pavilion.add(drumPivot);
    this.drumMesh = drumPivot;

    // Giá treo dùi trống cạnh cột
    const malletMat = new THREE.MeshStandardMaterial({ color: 0x5b2c12, roughness: 0.6 });
    for (const dx of [-0.08, 0.08]) {
      const mallet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.7, 6), malletMat);
      mallet.position.set(1.9 + dx, 1.5, 2.0);
      mallet.rotation.z = 0.2;
      pavilion.add(mallet);
    }

    // 3. TẦNG 2: ĐẠI HỒNG CHUNG TREO DƯỚI MÁI THƯỢNG
    const colOffsetsUpper = [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]];
    for (const [cx, cz] of colOffsetsUpper) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 3.6, 12), woodMat);
      col.position.set(cx, 7.0, cz);
      col.castShadow = true;
      pavilion.add(col);
    }

    // Lan can tầng 2
    const railingMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 });
    for (const side of [-1.7, 1.7]) {
      const railX = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.75, 0.1), railingMat);
      railX.position.set(0, 5.6, side);
      pavilion.add(railX);

      const railZ = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 3.4), railingMat);
      railZ.position.set(side, 5.6, 0);
      pavilion.add(railZ);
    }

    // Xà thượng
    const beamUpper = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.35, 4.0), woodMat);
    beamUpper.position.y = 8.8;
    pavilion.add(beamUpper);

    // Mái thượng tầng 2 cong vút
    const upperRoof = makeRoofGroup(5.8, 5.8, 2.4, 2.0, roofMat);
    upperRoof.position.set(0, 9.0, 0);
    upperRoof.castShadow = true;
    pavilion.add(upperRoof);

    // Đỉnh chóp nón vàng kim
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), goldMat);
    finial.position.y = 11.5;
    pavilion.add(finial);

    // ĐẠI HỒNG CHUNG BẰNG ĐỒNG VÀNG TREO LƠ LỬNG
    const bellGroup = new THREE.Group();
    const bellMat = new THREE.MeshStandardMaterial({ color: 0xdeb841, metalness: 0.88, roughness: 0.22 });

    // Quai chuông hình bồ lao 2 đầu rồng
    const bellHanger = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), bellMat);
    bellHanger.position.y = 0.3;
    bellGroup.add(bellHanger);

    // Thân chuông đồng đúc
    const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 1.6, 20), bellMat);
    bellBody.position.y = -0.75;
    bellGroup.add(bellBody);

    // Vành chuông loe rộng
    const bellRim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.1, 8, 20), bellMat);
    bellRim.rotation.x = Math.PI / 2;
    bellRim.position.y = -1.55;
    bellGroup.add(bellRim);

    // 4 Núm gõ chuông
    for (let b = 0; b < 4; b++) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bellMat);
      const ba = (b * Math.PI * 2) / 4;
      knob.position.set(Math.cos(ba) * 0.78, -0.85, Math.sin(ba) * 0.78);
      bellGroup.add(knob);
    }

    bellGroup.position.set(0, 8.4, 0);
    pavilion.add(bellGroup);
    this.bellMesh = bellGroup;

    // Chày gỗ thỉnh chuông
    const striker = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0x3d170e }));
    striker.rotation.z = Math.PI / 2;
    const strikerGroup = new THREE.Group();
    strikerGroup.add(striker);
    strikerGroup.position.set(1.4, 7.5, 0);
    pavilion.add(strikerGroup);
    this.strikerMesh = strikerGroup;

    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xc2a26b, roughness: 0.95 });
    const ropeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.9, 7.45, 0),
      new THREE.Vector3(2.15, 4.5, 0),
      new THREE.Vector3(2.2, 1.6, 0)
    ]);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(ropeCurve, 16, 0.03, 6, false), ropeMat);
    pavilion.add(rope);
    const ropeKnot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), ropeMat);
    ropeKnot.position.set(2.2, 1.55, 0);
    pavilion.add(ropeKnot);

    this.root.add(pavilion);

    // Trống bát nhã giữa lầu (trục trống nằm theo trục z)
    this.collisionBoxes.push({ minX: 16.9, maxX: 19.1, minZ: 7.2, maxZ: 8.8, type: 'impassable' });
  }

  // ===================== 10. HỒ SEN, CÁ KOI & TƯỢNG QUAN ÂM BẠCH NGỌC =====================
  private buildLotusPond() {
    const pond = new THREE.Group();
    pond.position.set(-18, 0, 24);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 7.5, 0.4, 24),
      this.waterMat(new THREE.MeshStandardMaterial({ color: 0x1d5d6e, roughness: 0.1, metalness: 0.65, transparent: true, opacity: 0.88 }))
    );
    water.position.y = -0.15;
    pond.add(water);

    // Viền đá tự nhiên
    const rimStoneMat = new THREE.MeshStandardMaterial({ color: 0x6e7072, roughness: 0.95 });
    const rimStoneMat2 = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 46; i++) {
      const angle = (i / 46) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
      const size = 0.45 + Math.random() * 0.35;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), i % 3 === 0 ? rimStoneMat2 : rimStoneMat);
      const r = 7.7 + (Math.random() - 0.5) * 0.4;
      rock.position.set(Math.cos(angle) * r, 0.05, Math.sin(angle) * r);
      rock.scale.set(1.3, 0.45 + Math.random() * 0.25, 1);
      rock.rotation.y = -angle + Math.random() * 0.4;
      pond.add(rock);
    }

    // Lá sen & Hoa sen nở
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7 });
    const flowerPinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });
    const flowerCenterMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });

    for (let l = 0; l < 20; l++) {
      const radius = 1.8 + Math.random() * 4.8;
      const angle = Math.random() * Math.PI * 2;
      const lx = Math.cos(angle) * radius;
      const lz = Math.sin(angle) * radius;

      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.35, 12), leafMat);
      leaf.rotation.x = -Math.PI / 2;
      leaf.position.set(lx, 0.02, lz);
      pond.add(leaf);

      if (l % 2 === 0) {
        const flower = new THREE.Group();
        flower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 8), flowerCenterMat));
        for (let p = 0; p < 8; p++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 5), flowerPinkMat);
          const pa = (p * Math.PI * 2) / 8;
          petal.position.set(Math.cos(pa) * 0.12, 0.08, Math.sin(pa) * 0.12);
          petal.rotation.z = Math.cos(pa) * 0.4;
          petal.rotation.x = Math.sin(pa) * -0.4;
          flower.add(petal);
        }
        flower.position.set(lx + 0.12, 0.08, lz + 0.12);
        pond.add(flower);
      }
    }

    // Đàn cá koi bơi lội trong hồ
    const koiMatOrange = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3 });
    const koiMatWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    for (let k = 0; k < 6; k++) {
      const koi = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 6), k % 2 === 0 ? koiMatOrange : koiMatWhite);
      koi.rotation.x = Math.PI / 2;
      const ka = (k * Math.PI * 2) / 6;
      koi.position.set(Math.cos(ka) * 3.8, -0.1, Math.sin(ka) * 3.8);
      pond.add(koi);
    }

    // Hòn non bộ & Tượng Quan Âm Bồ Tát bạch ngọc
    const islet = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x4f5254, roughness: 0.95 }));
    islet.position.y = 0.5;
    pond.add(islet);

    const quanAmGroup = this.makeQuanAmFigure();
    pond.add(quanAmGroup);
    this.pondGroup = pond;
    this.root.add(pond);

    this.collisionCircles.push({ x: -18, z: 24, r: 8.4 });
  }

  // Tượng Quan Âm bạch ngọc (dùng cho hòn non bộ giữa hồ và tượng lộ thiên)
  // Tượng Bồ Tát đứng: 'jade' = Quan Âm bạch ngọc (hồ sen, tượng lộ thiên), 'gold' = Bồ Tát thếp vàng chầu bên tượng Phật
  // holding: 'vase' = tay trái tịnh bình, tay phải cành dương liễu; 'lotus' = hai tay nâng đoá sen trước ngực
  public makeQuanAmFigure(style: 'jade' | 'gold' = 'jade', holding: 'vase' | 'lotus' = 'vase'): THREE.Group {
    const gold = style === 'gold';
    const bodyMat = gold
      ? new THREE.MeshStandardMaterial({ color: 0xd8ad45, metalness: 0.78, roughness: 0.32 })
      : new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.42, metalness: 0.02 });
    const clothMat = bodyMat.clone();
    clothMat.side = THREE.DoubleSide;
    const trimMat = gold
      ? new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.5, metalness: 0.2 })
      : new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 0.75, roughness: 0.3 });
    const ribbonMat = gold
      ? new THREE.MeshStandardMaterial({ color: 0xa8792a, metalness: 0.8, roughness: 0.35 })
      : new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 0.75, roughness: 0.3 });
    const featureMat = new THREE.MeshStandardMaterial({ color: gold ? 0x6b4514 : 0x8c7f76, roughness: 0.6 });
    const lotusMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

    const g = new THREE.Group();
    g.position.y = 1.1;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material = bodyMat) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      g.add(m);
      return m;
    };

    // 1. Đài sen 2 tầng + gương sen
    add(TempleWorld.lotusThrone([
      { n: 12, r: 0.44, y: -0.04, len: 0.32, wid: 0.19, tilt: 0.8, c0: 0xfdf2f6, c1: gold ? 0xe0628f : 0xf2a7c3 },
      { n: 10, r: 0.37, y: 0.02, len: 0.28, wid: 0.17, tilt: 0.45, c0: 0xffffff, c1: gold ? 0xe8789f : 0xf6bfd3 }
    ]), lotusMat);
    const pad = add(new THREE.CylinderGeometry(0.42, 0.36, 0.1, 28), gold ? bodyMat : trimMat);
    pad.position.y = 0.14;

    // 2. Áo dài thướt tha có nếp gấp dọc, vạt dưới xoè nhẹ
    const robe = add(TempleWorld.pleatedLathe([
      new THREE.Vector2(0.0, 0.18), new THREE.Vector2(0.4, 0.18), new THREE.Vector2(0.43, 0.24),
      new THREE.Vector2(0.38, 0.55), new THREE.Vector2(0.32, 0.95), new THREE.Vector2(0.3, 1.25),
      new THREE.Vector2(0.27, 1.38), new THREE.Vector2(0.31, 1.58), new THREE.Vector2(0.33, 1.78),
      new THREE.Vector2(0.27, 1.92), new THREE.Vector2(0.12, 2.0), new THREE.Vector2(0.0, 2.0)
    ], 56, 11, 0.07, 1.3));
    robe.scale.z = 0.76;
    // dây thắt lưng + dải lụa buông trước bụng
    const belt = add(new THREE.TorusGeometry(0.285, 0.022, 8, 40), trimMat);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1, 0.76, 1);
    belt.position.y = 1.36;
    add(TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(0, 1.36, 0.22), V(0.03, 1.0, 0.27), V(-0.02, 0.62, 0.3), V(0.02, 0.3, 0.33)]), 16, 0.035, 0.025, 6), ribbonMat);

    // 3. Khăn choàng trùm đầu buông dài sau lưng và hai bên vai (mở phía trước)
    const mantle = add(TempleWorld.pleatedLathe([
      new THREE.Vector2(0.0, 2.6), new THREE.Vector2(0.17, 2.58), new THREE.Vector2(0.235, 2.45),
      new THREE.Vector2(0.25, 2.25), new THREE.Vector2(0.34, 2.02), new THREE.Vector2(0.4, 1.8),
      new THREE.Vector2(0.4, 1.3), new THREE.Vector2(0.44, 0.7), new THREE.Vector2(0.48, 0.3)
    ], 44, 9, 0.05, 1.6, 1.1, Math.PI * 2 - 2.2), clothMat); // chừa khe hở phía trước mặt
    mantle.scale.z = 0.82;
    // viền khăn chạy đúng theo mép khăn choàng (2 bên khe hở phía trước)
    const edgeProfile: [number, number][] = [[0.17, 2.58], [0.235, 2.45], [0.25, 2.25], [0.34, 2.02], [0.4, 1.8], [0.4, 1.3], [0.44, 0.7], [0.48, 0.3]];
    for (const side of [-1, 1]) {
      const pts = edgeProfile.map(([r, yy]) => V(side * r * Math.sin(1.1) * 1.01, yy, r * Math.cos(1.1) * 0.82 + 0.005));
      add(TempleWorld.taperTube(new THREE.CatmullRomCurve3(pts), 28, 0.016, 0.016, 6), ribbonMat);
    }

    // 4. Đầu & khuôn mặt từ bi
    const headC = V(0, 2.3, 0.02);
    const head = add(new THREE.SphereGeometry(1, 28, 20));
    head.scale.set(0.17, 0.21, 0.18);
    head.position.copy(headC);
    const neck = add(new THREE.CylinderGeometry(0.075, 0.09, 0.16, 14));
    neck.position.y = 2.06;
    for (const side of [-1, 1]) {
      const eye = add(new THREE.TorusGeometry(0.035, 0.005, 5, 12, Math.PI * 0.8), featureMat);
      eye.position.set(side * 0.062, 2.31, 0.185);
      eye.rotation.set(-0.15, side * 0.3, Math.PI * 1.1);
      const brow = add(new THREE.TorusGeometry(0.055, 0.006, 5, 12, Math.PI * 0.7), featureMat);
      brow.position.set(side * 0.062, 2.33, 0.18);
      brow.rotation.set(-0.2, side * 0.3, Math.PI * 0.15);
      const ear = add(new THREE.SphereGeometry(1, 10, 8));
      ear.scale.set(0.02, 0.08, 0.04);
      ear.position.set(side * 0.165, 2.25, 0.01);
    }
    const nose = add(new THREE.SphereGeometry(1, 10, 8));
    nose.scale.set(0.022, 0.04, 0.03);
    nose.position.set(0, 2.265, 0.19);
    const lips = add(new THREE.TorusGeometry(0.022, 0.006, 5, 10, Math.PI), new THREE.MeshStandardMaterial({ color: gold ? 0x8a3a1e : 0xd99a9a, roughness: 0.5 }));
    lips.position.set(0, 2.2, 0.178);
    lips.rotation.z = Math.PI;
    const urna = add(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc81e1e }));
    urna.position.set(0, 2.36, 0.185);
    // búi tóc cao
    const bun = add(new THREE.SphereGeometry(0.11, 16, 12));
    bun.position.set(0, 2.55, -0.02);
    bun.scale.set(1, 1.15, 1);

    // 5. Mũ Tỳ Lư: vành vàng + 5 cánh mũ nhọn, giữa có tượng Phật A Di Đà nhỏ
    const crownBand = add(new THREE.TorusGeometry(0.19, 0.018, 8, 32), trimMat);
    crownBand.rotation.x = Math.PI / 2 - 0.15;
    crownBand.position.set(0, 2.43, 0.01);
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.42;
      const leaf = add(TempleWorld.leafBlade(0.16 - Math.abs(i) * 0.02, 0.06, 0.012, 0.0), trimMat);
      leaf.position.set(Math.sin(a) * 0.19, 2.42, Math.cos(a) * 0.19 + 0.01);
      leaf.rotation.set(-0.25, a, 0, 'YXZ');
    }
    const amida = add(new THREE.SphereGeometry(0.022, 8, 6), trimMat);
    amida.position.set(0, 2.53, 0.22);
    const gem = add(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2f7fd1, roughness: 0.2, metalness: 0.3 }));
    gem.position.set(0, 2.47, 0.215);

    // 6. Chuỗi anh lạc trên ngực + mặt dây
    const beadPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const a = -1.2 + t * 2.4;
      beadPts.push(V(Math.sin(a) * 0.2, 1.95 - Math.cos(a * 0.9) * 0.16 + 0.16 * 0.35, Math.cos(a) * 0.17 + 0.07));
    }
    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), trimMat, beadPts.length);
    const bd = new THREE.Object3D();
    beadPts.forEach((p, i) => { bd.position.copy(p); bd.updateMatrix(); beads.setMatrixAt(i, bd.matrix); });
    g.add(beads);
    const pendant = add(new THREE.OctahedronGeometry(0.035, 0), trimMat);
    pendant.position.set(0, 1.75, 0.25);
    pendant.scale.set(1, 1.4, 0.6);

    // 7. Hai tay & ống tay áo rộng buông rủ
    const arm = (shoulder: THREE.Vector3, elbow: THREE.Vector3, hand: THREE.Vector3) => {
      add(TempleWorld.capsuleBetween(shoulder, elbow, 0.075));
      add(TempleWorld.capsuleBetween(elbow, hand, 0.06));
      // tay áo loe: ống côn hở đầu, rủ xuống dưới cẳng tay
      const dir = hand.clone().sub(elbow);
      const sleeve = new THREE.CylinderGeometry(0.075, 0.15, dir.length() * 0.8, 16, 1, true);
      sleeve.translate(0, dir.length() * 0.4, 0);
      sleeve.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()));
      sleeve.translate(elbow.x, elbow.y, elbow.z);
      add(sleeve, clothMat);
      const palm = add(new THREE.SphereGeometry(0.05, 12, 10));
      palm.scale.set(0.8, 1.2, 0.6);
      palm.position.copy(hand);
    };
    if (holding === 'vase') {
      // tay phải (phía -x) giơ cành dương liễu, tay trái (+x) ôm tịnh bình ngang hông
      arm(V(-0.29, 1.86, 0.0), V(-0.36, 1.5, 0.12), V(-0.16, 1.66, 0.3));
      arm(V(0.29, 1.86, 0.0), V(0.37, 1.45, 0.06), V(0.2, 1.28, 0.28));
      const vase = add(new THREE.LatheGeometry([
        new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.06, 0.01), new THREE.Vector2(0.085, 0.08),
        new THREE.Vector2(0.07, 0.16), new THREE.Vector2(0.025, 0.22), new THREE.Vector2(0.02, 0.32),
        new THREE.Vector2(0.04, 0.34)
      ], 18), gold ? bodyMat : new THREE.MeshStandardMaterial({ color: 0xeef6f2, roughness: 0.2, metalness: 0.1 }));
      vase.position.set(0.21, 1.18, 0.32);
      // cành dương liễu: cành chính + các nhánh lá rủ
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x4d8a1f, roughness: 0.6 });
      const tip = V(-0.3, 2.05, 0.4);
      add(TempleWorld.taperTube(new THREE.CatmullRomCurve3([V(-0.16, 1.62, 0.32), V(-0.2, 1.85, 0.36), tip]), 10, 0.012, 0.006, 5), leafMat);
      for (let k = 0; k < 5; k++) {
        const s = V(-0.18 - k * 0.028, 1.75 + k * 0.06, 0.34 + k * 0.012);
        add(TempleWorld.taperTube(new THREE.CatmullRomCurve3([s, s.clone().add(V(-0.07, 0.03, 0.03)), s.clone().add(V(-0.12, -0.12, 0.05)), s.clone().add(V(-0.13, -0.28, 0.05))]), 10, 0.006, 0.003, 4), leafMat);
      }
    } else {
      // hai tay nâng đoá sen trước ngực
      arm(V(-0.29, 1.86, 0.0), V(-0.35, 1.48, 0.1), V(-0.06, 1.55, 0.3));
      arm(V(0.29, 1.86, 0.0), V(0.35, 1.48, 0.1), V(0.06, 1.55, 0.3));
      const flower = add(TempleWorld.lotusThrone([
        { n: 8, r: 0.03, y: 0, len: 0.15, wid: 0.07, tilt: 0.75, c0: 0xffe4ee, c1: 0xe0628f },
        { n: 6, r: 0.02, y: 0.015, len: 0.13, wid: 0.06, tilt: 0.3, c0: 0xfff0f5, c1: 0xe8789f }
      ]), lotusMat);
      flower.position.set(0, 1.62, 0.33);
    }

    // 9. Vầng hào quang sau đầu: vòng vàng + ánh sáng dịu
    const ring = add(new THREE.TorusGeometry(0.34, 0.016, 8, 48), gold ? bodyMat : trimMat);
    ring.position.set(0, 2.36, -0.24);
    const qaHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({ map: createHaloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.28 })
    );
    qaHalo.position.set(0, 2.36, -0.26);
    g.add(qaHalo);

    // Tượng nhìn ra phía lối đi chính
    g.rotation.y = Math.PI / 2;
    return g;
  }

  // Hai vị Bồ Tát thếp vàng đứng chầu hai bên tượng Phật trên bệ sen
  public buildAttendantBodhisattvas(parent: THREE.Group) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a1c14, roughness: 0.55 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a537, metalness: 0.8, roughness: 0.3 });
    for (const side of [-1, 1]) {
      const grp = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.0, 8), stoneMat);
      plinth.position.y = 0.5;
      grp.add(plinth);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.03, 6, 32), goldMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.0;
      grp.add(rim);
      const fig = this.makeQuanAmFigure('gold', side < 0 ? 'vase' : 'lotus');
      fig.rotation.y = side * -0.25; // hơi quay vào tượng Phật
      fig.position.y = 1.02;
      fig.scale.setScalar(1.05);
      grp.add(fig);
      grp.position.set(side * 3.05, 0.9, -15.0);
      parent.add(grp);
    }
    this.collisionBoxes.push(
      { minX: -3.7, maxX: -2.4, minZ: -15.7, maxZ: -14.3, type: 'impassable' },
      { minX: 2.4, maxX: 3.7, minZ: -15.7, maxZ: -14.3, type: 'impassable' }
    );
  }

  // ===================== 11. CÂY ĐA SE DUYÊN: CÀNH XOÈ RỘNG, RỄ PHỤ BUÔNG RỦ, HÀNG TRĂM DẢI LỤA ĐỎ =====================
  public static readonly WISH_TREE = { x: -18, z: 14 };
  public wishLayer = new THREE.Group();
  private wishBranches: THREE.Curve<THREE.Vector3>[] = [];
  private wishMeshMap = new Map<string, THREE.Group>();
  private ribbonMesh: THREE.InstancedMesh | null = null;
  private ribbonData: { p: THREE.Vector3; ry: number; len: number; phase: number }[] = [];
  private ribbonDummy = new THREE.Object3D();
  private wishMats: { ribbon: THREE.MeshStandardMaterial; heart: THREE.MeshStandardMaterial; gold: THREE.MeshStandardMaterial; hit: THREE.MeshBasicMaterial } | null = null;
  private heartGeo: THREE.ExtrudeGeometry | null = null;

  private buildBodhiTree() {
    const C = TempleWorld.WISH_TREE;
    const tree = new THREE.Group();
    tree.position.set(C.x, 0, C.z);
    const rnd = seeded(2024);
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x4f3d2e, roughness: 0.95 });
    const rootMat = new THREE.MeshStandardMaterial({ color: 0x6b5644, roughness: 0.95 });

    // Thân to, gân guốc: lõi + nhiều rễ bám thân xoắn quanh
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.7, 5.0, 14), barkMat);
    trunk.position.y = 2.5;
    tree.add(trunk);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const pts = [0, 1, 2, 3, 4].map((k) => {
        const tw = a + k * 0.25;
        const r = 1.75 - k * 0.17;
        return V(Math.cos(tw) * r, k * 1.15, Math.sin(tw) * r);
      });
      tree.add(new THREE.Mesh(TempleWorld.taperTube(new THREE.CatmullRomCurve3(pts), 16, 0.32, 0.14, 8), barkMat));
    }

    // Cành lớn xoè ngang (dùng để treo dải lụa)
    const nB = 10;
    for (let i = 0; i < nB; i++) {
      const a = (i / nB) * Math.PI * 2 + rnd() * 0.3;
      const len = 5.2 + rnd() * 1.3;
      const d = V(Math.cos(a), 0, Math.sin(a));
      // cành vươn ngang rồi rủ thấp dần ra ngoài để dải lụa buông tới ngang tầm mắt
      const curve = new THREE.CatmullRomCurve3([
        V(0, 4.0, 0).addScaledVector(d, 0.6),
        V(0, 4.7 + rnd() * 0.4, 0).addScaledVector(d, len * 0.38),
        V(0, 4.4 + rnd() * 0.4, 0).addScaledVector(d, len * 0.72),
        V(0, 3.9 + rnd() * 0.4, 0).addScaledVector(d, len)
      ]);
      this.wishBranches.push(curve);
      tree.add(new THREE.Mesh(TempleWorld.taperTube(curve, 24, 0.34, 0.09, 8), barkMat));
      // cành phụ vươn lên đỡ tán
      for (const t of [0.45, 0.8]) {
        const base = curve.getPoint(t);
        const up = base.clone().add(V((rnd() - 0.5) * 1.2, 1.4 + rnd() * 0.6, (rnd() - 0.5) * 1.2));
        tree.add(new THREE.Mesh(this.makeLimb(base, up, 0.12, 0.05), barkMat));
      }
      // rễ phụ buông rủ: gần thân thì cắm xuống đất, ra xa thì lơ lửng trên đầu người
      for (const t of [0.22, 0.5, 0.68, 0.86]) {
        const top = curve.getPoint(t);
        const toGround = t < 0.3;
        const bottomY = toGround ? 0 : 2.3 + rnd() * 0.8;
        const sway = V((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25);
        tree.add(new THREE.Mesh(
          TempleWorld.taperTube(new THREE.CatmullRomCurve3([top, top.clone().add(sway).setY((top.y + bottomY) / 2), top.clone().add(sway).setY(bottomY)]), 8, toGround ? 0.09 : 0.04, toGround ? 0.12 : 0.012, 6),
          rootMat
        ));
      }
    }

    // Tán lá xanh tươi, nâng cao và thưa để thấy rõ dải lụa bên dưới (đa xanh quanh năm, không đổi theo mùa)
    const leafColors = [0x4f9a4f, 0x67b45f, 0x3f8a48, 0x7cc06a];
    const foliageMats = leafColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }));
    const top = this.createFoliageClump(foliageMats, 2.8, 5);
    top.position.set(0, 8.0, 0);
    top.scale.set(1.3, 0.7, 1.3);
    tree.add(top);
    this.wishBranches.forEach((curve, i) => {
      for (const t of [0.5, 0.92]) {
        const p = curve.getPoint(t);
        const clump = this.createFoliageClump([foliageMats[(i + (t > 0.7 ? 1 : 0)) % 4]], t > 0.7 ? 1.4 : 1.7, 4);
        clump.position.set(p.x, p.y + 2.1, p.z);
        clump.scale.set(1.25, 0.6, 1.25);
        tree.add(clump);
      }
    });

    // Ghế đá tròn vòng quanh gốc
    const bench = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.28, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 })
    );
    bench.rotation.x = Math.PI / 2;
    bench.position.y = 0.35;
    tree.add(bench);

    // Hàng trăm dải lụa đỏ (và ít dải hồng, vàng) buộc dọc các cành
    const ribbonGeo = new THREE.PlaneGeometry(0.085, 1);
    ribbonGeo.translate(0, -0.5, 0);
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.55, emissive: 0x3a0505, emissiveIntensity: 0.35 });
    const perBranch = 46;
    const count = nB * perBranch;
    this.ribbonMesh = new THREE.InstancedMesh(ribbonGeo, ribbonMat, count);
    this.ribbonMesh.frustumCulled = false;
    const reds = [0xd7191f, 0xe53935, 0xc62828, 0xff3b30, 0xb71c1c, 0xef5350, 0xf06292, 0xf2c14e];
    const col = new THREE.Color();
    let idx = 0;
    this.wishBranches.forEach((curve) => {
      for (let k = 0; k < perBranch; k++) {
        const t = 0.16 + (k / (perBranch - 1)) * 0.82 + (rnd() - 0.5) * 0.02;
        const p = curve.getPoint(Math.min(0.99, t));
        p.x += (rnd() - 0.5) * 0.3;
        p.z += (rnd() - 0.5) * 0.3;
        p.y -= 0.08;
        this.ribbonData.push({ p, ry: rnd() * Math.PI, len: 0.75 + rnd() * 0.75, phase: rnd() * Math.PI * 2 });
        const r = rnd();
        this.ribbonMesh!.setColorAt(idx, col.setHex(reds[r < 0.85 ? Math.floor(rnd() * 6) : r < 0.95 ? 6 : 7]));
        idx++;
      }
    });
    this.updateRibbons(0);
    tree.add(this.ribbonMesh);

    // Bảng gỗ "CÂY ĐA SE DUYÊN" quay ra lối đi chính
    const sign = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.7 });
    for (const sx of [-0.75, 0.75]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.9, 8), postMat);
      post.position.set(sx, 0.95, 0);
      sign.add(post);
    }
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.75, 0.08),
      new THREE.MeshStandardMaterial({ map: createPlaqueTexture('CÂY ĐA SE DUYÊN', 'Buộc dải lụa đỏ · Cầu tình duyên'), roughness: 0.5 })
    );
    board.position.y = 1.6;
    sign.add(board);
    sign.rotation.y = Math.PI / 2;
    sign.position.set(-13.8, 0, 12.4);
    this.root.add(sign);
    this.collisionCircles.push({ x: -13.8, z: 12.4, r: 0.5 });

    this.root.add(tree);
    this.root.add(this.wishLayer);
    this.collisionCircles.push({ x: C.x, z: C.z, r: 3.1 });
  }

  private updateRibbons(elapsed: number) {
    if (!this.ribbonMesh) return;
    const d = this.ribbonDummy;
    for (let i = 0; i < this.ribbonData.length; i++) {
      const r = this.ribbonData[i];
      d.position.copy(r.p);
      d.rotation.set(Math.sin(elapsed * 1.1 + r.phase) * 0.12, r.ry, Math.sin(elapsed * 1.6 + r.phase * 1.3) * 0.1);
      d.scale.set(1, r.len, 1);
      d.updateMatrix();
      this.ribbonMesh.setMatrixAt(i, d.matrix);
    }
    this.ribbonMesh.instanceMatrix.needsUpdate = true;
  }

  // Vị trí treo dải lụa cầu duyên thứ `slot` (0..59) trên cành, toạ độ thế giới
  private wishSlotPosition(slot: number) {
    const C = TempleWorld.WISH_TREE;
    const nB = this.wishBranches.length || 8;
    const b = slot % nB;
    const k = Math.floor(slot / nB);
    const t = Math.min(0.95, 0.28 + k * 0.085 + (slot % 3) * 0.012);
    const p = this.wishBranches[b].getPoint(t);
    return new THREE.Vector3(C.x + p.x, p.y - 0.1, C.z + p.z);
  }

  private makeWishRibbon(item: WishItem) {
    if (!this.wishMats) {
      this.wishMats = {
        ribbon: new THREE.MeshStandardMaterial({ color: 0xe0161e, side: THREE.DoubleSide, roughness: 0.45, emissive: 0x7a0a0a, emissiveIntensity: 0.45 }),
        heart: new THREE.MeshStandardMaterial({ color: 0xff2d55, roughness: 0.35, metalness: 0.1, emissive: 0xff2d55, emissiveIntensity: 0.35 }),
        gold: new THREE.MeshStandardMaterial({ color: 0xe8b94a, metalness: 0.75, roughness: 0.3 }),
        hit: new THREE.MeshBasicMaterial({ visible: false })
      };
      const hs = new THREE.Shape();
      hs.moveTo(0, -0.1);
      hs.bezierCurveTo(-0.02, -0.06, -0.12, -0.02, -0.12, 0.04);
      hs.bezierCurveTo(-0.12, 0.1, -0.05, 0.12, 0, 0.07);
      hs.bezierCurveTo(0.05, 0.12, 0.12, 0.1, 0.12, 0.04);
      hs.bezierCurveTo(0.12, -0.02, 0.02, -0.06, 0, -0.1);
      this.heartGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 });
      this.heartGeo.translate(0, 0, -0.0175);
    }
    const M = this.wishMats;
    const g = new THREE.Group();
    g.userData = { wishData: item, pop: 0, phase: (item.slot * 1.7) % (Math.PI * 2) };
    // nút thắt + 2 dải lụa dài buông xuống + thẻ trái tim ở cuối
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M.ribbon);
    g.add(knot);
    for (const sx of [-0.045, 0.045]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 1.15), M.ribbon);
      strip.position.set(sx, -0.6, 0);
      strip.rotation.z = sx * 0.6;
      g.add(strip);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 12), M.gold);
    ring.position.y = -1.2;
    g.add(ring);
    const heart = new THREE.Mesh(this.heartGeo!, M.heart);
    heart.scale.setScalar(1.15);
    heart.position.y = -1.32;
    g.add(heart);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), M.hit);
    hit.position.y = -0.75;
    g.add(hit);
    g.position.copy(this.wishSlotPosition(item.slot));
    g.rotation.y = (item.slot * 2.39) % (Math.PI * 2);
    return g;
  }

  // Thêm dải lụa mới (vừa có người buộc): hiện ra kèm hiệu ứng bung nhẹ
  public addWishes(list: WishItem[], animate = true) {
    if (!this.wishBranches.length) return; // bản đồ không có cây đa
    for (const item of list) {
      if (this.wishMeshMap.has(item.id)) continue;
      const g = this.makeWishRibbon(item);
      g.userData.pop = animate ? 0 : 1;
      if (animate) g.scale.setScalar(0.01);
      this.wishLayer.add(g);
      this.wishMeshMap.set(item.id, g);
    }
  }

  public syncWishes(list: WishItem[]) {
    const ids = new Set(list.map((w) => w.id));
    for (const [id, g] of this.wishMeshMap) {
      if (ids.has(id)) continue;
      this.wishLayer.remove(g);
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry !== this.heartGeo) m.geometry.dispose();
      });
      this.wishMeshMap.delete(id);
    }
    this.addWishes(list, false);
  }

  // Điểm đứng buộc dải lụa: vòng quanh gốc đa (ngoài ghế đá), gần người chơi nhất và không vướng hồ sen
  public getWishSpot(fromX: number, fromZ: number) {
    const C = TempleWorld.WISH_TREE;
    const base = Math.atan2(fromZ - C.z, fromX - C.x);
    for (let k = 0; k < 24; k++) {
      const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      const x = C.x + Math.cos(a) * 3.7;
      const z = C.z + Math.sin(a) * 3.7;
      if (this.checkCollision(x, z).allowed) return { x, z, ry: Math.atan2(C.x - x, C.z - z) };
    }
    return { x: C.x + 3.7, z: C.z, ry: -Math.PI / 2 };
  }

  private updateWishes(delta: number, elapsed: number) {
    this.updateRibbons(elapsed);
    for (const g of this.wishLayer.children) {
      const u = g.userData;
      if (u.pop < 1) {
        u.pop = Math.min(1, u.pop + delta / 0.7);
        const k = u.pop;
        const s = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
        g.scale.setScalar(Math.max(0.01, s));
      }
      g.rotation.z = Math.sin(elapsed * 1.3 + u.phase) * 0.09;
      g.rotation.x = Math.sin(elapsed * 0.9 + u.phase * 0.7) * 0.06;
    }
  }

  // ===================== 12. 15-20 CÂY HOA SỨ & BONSAI DỌC LỐI ĐI =====================
  private buildDecorationsAndBonsai() {
    const potTex = createBonsaiPotTexture();
    const potMat = new THREE.MeshStandardMaterial({ map: potTex, roughness: 0.3, metalness: 0.1 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8, flatShading: true });
    this.themeMats.foliage.push(foliageMat);
    const plumeriaBarkMat = new THREE.MeshStandardMaterial({ color: 0x6e6255, roughness: 0.9 });
    const plumeriaLeafMat = new THREE.MeshStandardMaterial({ color: 0x386641, roughness: 0.8, flatShading: true });
    this.themeMats.foliage.push(plumeriaLeafMat);
    const plumeriaFlowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    this.themeMats.treeFlower.push(plumeriaFlowerMat);

    // Chậu bonsai men lam dọc hành lang
    const bonsaiPositions = [
      { x: -5.2, z: -2.5 }, { x: 5.2, z: -2.5 },
      { x: -8.5, z: 4.0 },  { x: 8.5, z: 4.0 },
      { x: -8.5, z: 16.0 }, { x: 8.5, z: 16.0 },
      { x: -8.5, z: 28.0 }, { x: 8.5, z: 28.0 }
    ];

    for (const pos of bonsaiPositions) {
      const potGroup = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.52, 12), potMat);
      pot.position.y = 0.26;
      potGroup.add(pot);

      const bonsaiFoliage = this.createFoliageClump([foliageMat], 0.5, 4);
      bonsaiFoliage.position.set(0.08, 0.82, 0.05);
      potGroup.add(bonsaiFoliage);

      potGroup.position.set(pos.x, 0, pos.z);
      this.root.add(potGroup);

      this.collisionBoxes.push({ minX: pos.x - 0.5, maxX: pos.x + 0.5, minZ: pos.z - 0.5, maxZ: pos.z + 0.5, type: 'impassable' });
    }

    // 16 Cây hoa sứ (cành khúc khuỷu, hoa trắng nhụy vàng) & cây xanh bóng mát
    const treeCoords = [
      { x: -24, z: 4 },   { x: -25, z: -8 },  { x: -27, z: -19 }, { x: -12, z: -23 },
      { x: 12, z: -23 },  { x: 20, z: -18 },  { x: 25, z: -8 },   { x: 24, z: 4 },
      { x: 24, z: 14 },   { x: 24, z: 34 },   { x: -24, z: 34 },  { x: -10, z: 42 },
      { x: 10, z: 42 },   { x: -22, z: 42 },  { x: 22, z: 42 },   { x: 28, z: 31 }
    ];

    for (const tc of treeCoords) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 3.2, 8), plumeriaBarkMat);
      trunk.position.y = 1.6;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliage = this.createFoliageClump([plumeriaLeafMat], 1.3, 5);
      foliage.position.set(0.1, 3.4, 0.1);
      foliage.scale.set(1.4, 0.9, 1.4);
      tree.add(foliage);

      for (let f = 0; f < 5; f++) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), plumeriaFlowerMat);
        const fa = (f * Math.PI * 2) / 5;
        flower.position.set(Math.cos(fa) * 1.3, 3.5 + Math.sin(fa) * 0.2, Math.sin(fa) * 1.3);
        tree.add(flower);
      }

      tree.position.set(tc.x, 0, tc.z);
      this.root.add(tree);

      this.collisionBoxes.push({ minX: tc.x - 0.6, maxX: tc.x + 0.6, minZ: tc.z - 0.6, maxZ: tc.z + 0.6, type: 'impassable' });
    }
  }

  // ===================== CHI TIẾT LÀM ĐẸP: HOA ANH ĐÀO, TÙNG, DÂY ĐÈN LỒNG, VŨNG SÁNG ĐÊM =====================
  private buildBeautyDetails() {
    // Cây hoa anh đào tán hồng (x, z, độ to)
    const cherries: [number, number, number][] = [
      [-14.5, 0, 1.1], [14.5, 0, 1.1],
      [-6.8, 40.5, 1.05], [6.8, 40.5, 1.05],
      [-21.5, -3, 1.2], [21.5, -3, 1.2]
    ];
    cherries.forEach(([x, z, sc], i) => this.buildCherryTree(x, z, sc, 101 + i * 37));

    // Tùng tạo dáng tầng mây ở hai góc trong cổng (đứng sau bia công đức, không che mặt bia)
    this.buildCloudPine(-16.5, 33.5, 1.0, 11);
    this.buildCloudPine(16.5, 33.5, 1.0, 23);

    // Dây đèn lồng đỏ giăng ngang lối đi chính
    for (const z of [4, 12, 20, 28.5]) this.buildLanternString(z);

    // Vũng sáng ấm dưới chân đèn đá (chỉ ban đêm)
    for (const [x, z] of [[-3.8, 8], [3.8, 8], [-3.8, 24], [3.8, 24]]) this.addLightPool(x, z, 2.4, 0.32);
    for (const z of [4, 12, 20, 28.5]) this.addLightPool(0, z, 3.0, 0.14);
    this.addLightPool(0, -2.2, 4.2, 0.2);
  }

  public makeLimb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    g.translate(a.x, a.y, a.z);
    return g;
  }

  private cherryMats: { bark: THREE.MeshStandardMaterial; bloom: THREE.MeshStandardMaterial; carpet: THREE.MeshBasicMaterial } | null = null;

  public buildCherryTree(x: number, z: number, scale: number, seed: number) {
    const rnd = seeded(seed);
    if (!this.cherryMats) {
      this.cherryMats = {
        bark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }),
        bloom: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, emissive: 0x6a2448, emissiveIntensity: 0.22 }),
        carpet: new THREE.MeshBasicMaterial({ map: petalCarpetTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
      };
    }
    const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
    const bark: { geo: THREE.BufferGeometry; color: number }[] = [];
    const puffs: { geo: THREE.BufferGeometry; color: number }[] = [];
    const BARK = 0x4a3328;
    const PINKS = [0xf7b6cf, 0xf29bbd, 0xfbcfe0, 0xec90b3, 0xffd9e6];

    // thân cong + gốc loe
    const lean = V((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5);
    const top = V(lean.x, 1.75, lean.z);
    bark.push({ geo: this.makeLimb(V(0, 0, 0), V(lean.x * 0.4, 0.9, lean.z * 0.4), 0.36, 0.27), color: BARK });
    bark.push({ geo: this.makeLimb(V(lean.x * 0.4, 0.9, lean.z * 0.4), top, 0.27, 0.22), color: BARK });
    bark.push({ geo: new THREE.ConeGeometry(0.55, 0.45, 7).translate(0, 0.2, 0), color: 0x3d2a20 });

    // các cành toả ra, đầu cành là chùm hoa
    const nBranch = 4 + Math.floor(rnd() * 2);
    const tips: THREE.Vector3[] = [];
    for (let i = 0; i < nBranch; i++) {
      const a = (i / nBranch) * Math.PI * 2 + rnd() * 0.6;
      const reach = 1.4 + rnd() * 0.7;
      const mid = V(top.x + Math.cos(a) * reach * 0.5, top.y + 0.7 + rnd() * 0.3, top.z + Math.sin(a) * reach * 0.5);
      const tip = V(top.x + Math.cos(a) * reach, top.y + 1.1 + rnd() * 0.7, top.z + Math.sin(a) * reach);
      bark.push({ geo: this.makeLimb(top, mid, 0.17, 0.12), color: BARK });
      bark.push({ geo: this.makeLimb(mid, tip, 0.12, 0.06), color: BARK });
      tips.push(tip);
    }
    tips.push(V(top.x, top.y + 2.3, top.z));

    const addPuff = (c: THREE.Vector3, r: number) => {
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.scale(1, 0.78, 1);
      g.rotateY(rnd() * Math.PI);
      g.translate(c.x, c.y, c.z);
      puffs.push({ geo: g, color: PINKS[Math.floor(rnd() * PINKS.length)] });
    };
    for (const t of tips) {
      addPuff(t, 0.85 + rnd() * 0.35);
      // chùm nhỏ phụ quanh mỗi đầu cành cho tán dày
      for (let k = 0; k < 2; k++) {
        const a = rnd() * Math.PI * 2;
        addPuff(V(t.x + Math.cos(a) * 0.7, t.y - 0.25 + rnd() * 0.4, t.z + Math.sin(a) * 0.7), 0.5 + rnd() * 0.25);
      }
    }
    // lõi tán
    addPuff(V(top.x, top.y + 1.5, top.z), 1.15);

    const group = new THREE.Group();
    group.add(new THREE.Mesh(this.mergeColoredParts(bark), this.cherryMats.bark));
    const crown = new THREE.Mesh(this.mergeColoredParts(puffs), this.cherryMats.bloom);
    group.add(crown);
    group.scale.setScalar(scale);
    group.rotation.y = rnd() * Math.PI * 2;
    group.position.set(x, 0, z);
    this.root.add(group);

    // thảm cánh hoa rụng dưới gốc
    const carpet = new THREE.Mesh(new THREE.CircleGeometry(2.9 * scale, 28), this.cherryMats.carpet);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(x, 0.045, z);
    carpet.renderOrder = 1;
    this.root.add(carpet);

    this.collisionCircles.push({ x, z, r: 0.55 * scale });
  }

  public buildCloudPine(x: number, z: number, scale: number, seed: number) {
    const rnd = seeded(seed);
    const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
    const parts: { geo: THREE.BufferGeometry; color: number }[] = [];
    const BARK = 0x5a4434;
    const pts = [V(0, 0, 0), V(0.35, 1.1, 0.05), V(-0.25, 2.1, -0.05), V(0.2, 3.0, 0.05), V(0, 3.7, 0)];
    for (let i = 0; i < pts.length - 1; i++) parts.push({ geo: this.makeLimb(pts[i], pts[i + 1], 0.3 - i * 0.05, 0.25 - i * 0.05), color: BARK });
    parts.push({ geo: new THREE.ConeGeometry(0.5, 0.4, 7).translate(0, 0.18, 0), color: 0x4a382b });
    const pads = [
      { from: pts[1], to: V(1.35, 1.55, 0.25), r: 0.95, c: 0x2f5d3a },
      { from: pts[2], to: V(-1.3, 2.35, -0.2), r: 0.9, c: 0x346a40 },
      { from: pts[3], to: V(1.0, 3.05, -0.35), r: 0.8, c: 0x3c7a4a },
      { from: pts[4], to: V(0, 3.85, 0), r: 1.0, c: 0x458654 }
    ];
    for (const pd of pads) {
      if (pd.from !== pts[4]) parts.push({ geo: this.makeLimb(pd.from, pd.to, 0.1, 0.07), color: BARK });
      // mỗi tầng: 1 đĩa lá dẹt to + vài cụm nhỏ viền quanh
      const g = new THREE.SphereGeometry(pd.r, 14, 8);
      g.scale(1.15, 0.42, 1.0);
      g.translate(pd.to.x, pd.to.y + 0.12, pd.to.z);
      parts.push({ geo: g, color: pd.c });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + rnd();
        const sg = new THREE.SphereGeometry(pd.r * 0.42, 10, 6);
        sg.scale(1, 0.6, 1);
        sg.translate(pd.to.x + Math.cos(a) * pd.r * 0.85, pd.to.y + 0.1, pd.to.z + Math.sin(a) * pd.r * 0.75);
        parts.push({ geo: sg, color: k % 2 ? pd.c : 0x2a5234 });
      }
    }
    const mesh = new THREE.Mesh(
      this.mergeColoredParts(parts),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })
    );
    mesh.scale.setScalar(scale);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rnd() * Math.PI * 2;
    this.root.add(mesh);
    this.collisionCircles.push({ x, z, r: 0.6 * scale });
  }

  private redLanternMat: THREE.MeshStandardMaterial | null = null;
  private lanternStringMats: { pole: THREE.MeshStandardMaterial; rope: THREE.MeshStandardMaterial; red: THREE.MeshStandardMaterial; gold: THREE.MeshStandardMaterial } | null = null;

  // Hai cột gỗ sơn son hai bên lối đi + dây võng với 7 đèn lồng đỏ
  private buildLanternString(z: number) {
    if (!this.lanternStringMats) {
      const red = new THREE.MeshStandardMaterial({ color: 0xc81e16, roughness: 0.55, emissive: 0xe0200c, emissiveIntensity: 0.3 });
      this.redLanternMat = red;
      this.lanternStringMats = {
        pole: new THREE.MeshStandardMaterial({ color: 0x7a1d14, roughness: 0.6 }),
        rope: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 }),
        red,
        gold: new THREE.MeshStandardMaterial({ color: 0xd9a63a, roughness: 0.35, metalness: 0.6 })
      };
    }
    const M = this.lanternStringMats;
    const X = 4.7;
    const H = 5.0;
    const group = new THREE.Group();
    for (const sx of [-X, X]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, H + 0.2, 10), M.pole);
      pole.position.set(sx, (H + 0.2) / 2, 0);
      group.add(pole);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x8c877c, roughness: 0.9 }));
      base.position.set(sx, 0.11, 0);
      group.add(base);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M.gold);
      cap.position.set(sx, H + 0.25, 0);
      group.add(cap);
      this.collisionCircles.push({ x: sx, z, r: 0.28 });
    }
    // dây võng (catenary đơn giản)
    const sag = 0.75;
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        return new THREE.Vector3(-X + 2 * X * t, H - sag * 4 * t * (1 - t), 0);
      })
    );
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 4, false), M.rope));

    const glowMat = new THREE.SpriteMaterial({ map: warmGlowTexture(), color: 0xff5a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.38 });
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      const p = curve.getPoint(t);
      const L = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), M.red);
      body.scale.set(1, 1.2, 1);
      L.add(body);
      for (const cy of [0.27, -0.27]) {
        const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), M.gold);
        capM.position.y = cy;
        L.add(capM);
      }
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.28, 6), M.gold);
      tassel.position.y = -0.45;
      L.add(tassel);
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(1.15, 1.15, 1);
      L.add(glow);
      this.nightOnly.push(glow);
      L.position.set(p.x, p.y - 0.42, 0);
      group.add(L);
    }
    group.position.set(0, 0, z);
    this.root.add(group);
  }

  private lightPoolMat: THREE.MeshBasicMaterial | null = null;
  public addLightPool(x: number, z: number, r: number, opacity: number) {
    if (!this.lightPoolMat) {
      this.lightPoolMat = new THREE.MeshBasicMaterial({
        map: warmGlowTexture(), color: 0xffb066, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
      });
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), this.lightPoolMat.clone());
    (m.material as THREE.MeshBasicMaterial).opacity = opacity;
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.06, z);
    m.renderOrder = 2;
    this.root.add(m);
    this.nightOnly.push(m);
    return m;
  }

  // Tường rào bao quanh chùa & Hàng cau/dừa nhiệt đới (như trong ảnh mẫu)
  private buildPerimeterWalls() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x948b81, roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ map: getVietnameseCurvedRoofTexture(),
      side: THREE.DoubleSide, roughness: 0.65 });

    const createWallSegment = (x: number, z: number, w: number, d: number) => {
      const group = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), wallMat);
      wall.position.y = 1.3;
      wall.castShadow = true;
      group.add(wall);

      const tile = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.5), roofMat);
      tile.position.y = 2.8;
      group.add(tile);

      group.position.set(x, 0, z);
      this.root.add(group);

      this.collisionBoxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, type: 'impassable' });
    };

    createWallSegment(-30, 8, 1.0, 56);
    createWallSegment(30, 8, 1.0, 56);
    createWallSegment(0, -22, 60, 1.0);
    createWallSegment(-18, 36, 24, 1.0);
    createWallSegment(18, 36, 24, 1.0);

    // Hàng cau / dừa cảnh cao vút dọc tường rào (như trong ảnh mẫu)
    this.buildPalmTreesAlongWalls();
  }

  // Trồng các cụm dừa cảnh / cau cảnh cao thanh mảnh dọc tường rào
  private buildPalmTreesAlongWalls() {
    const palmLocations = [
      { x: -28, z: 0, h: 8.5, t: -0.06 },
      { x: -28, z: 12, h: 7.8, t: 0.05 },
      { x: -28, z: 26, h: 8.2, t: -0.04 },
      { x: -28, z: -10, h: 7.5, t: 0.07 },
      { x: 28, z: -2, h: 8.2, t: 0.05 },
      { x: 28, z: 12, h: 7.9, t: -0.05 },
      { x: 28, z: 24, h: 8.4, t: 0.06 },
      { x: 28, z: -12, h: 7.6, t: -0.07 },
      { x: -16, z: -23.5, h: 8.8, t: 0.05 },
      { x: -8, z: -23.5, h: 7.8, t: -0.04 },
      { x: 8, z: -23.5, h: 8.0, t: 0.04 },
      { x: 16, z: -23.5, h: 8.6, t: -0.06 },
      { x: -22, z: 37, h: 7.6, t: 0.05 },
      { x: 22, z: 37, h: 7.8, t: -0.05 }
    ];

    for (const pl of palmLocations) {
      this.buildPalmTree(pl.x, pl.z, pl.h, pl.t);
    }
  }

  // Cây dừa / cây cau cảnh cao vút dọc tường rào (như trong ảnh mẫu)
  private buildPalmTree(x: number, z: number, height = 7.5, tilt = 0.08) {
    const palm = new THREE.Group();
    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x6e5c4a,
      roughness: 0.95,
      flatShading: true
    });
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x386641,
      roughness: 0.8,
      flatShading: true,
      side: THREE.DoubleSide
    });
    this.themeMats.palm.push(frondMat);

    const segments = 8;
    const segH = height / segments;
    let currY = 0;
    for (let s = 0; s < segments; s++) {
      const r = 0.26 * (1 - s * 0.045);
      const trunkSeg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, segH, 8), barkMat);
      trunkSeg.position.set(s * tilt * 0.35, currY + segH / 2, 0);
      trunkSeg.castShadow = true;
      palm.add(trunkSeg);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.03, 6, 12), barkMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(s * tilt * 0.35, currY + segH, 0);
      palm.add(ring);

      currY += segH;
    }

    const crownX = (segments - 1) * tilt * 0.35;
    const crownY = currY;
    const frondCount = 10;
    for (let f = 0; f < frondCount; f++) {
      const angle = (f * Math.PI * 2) / frondCount;
      const frondGroup = new THREE.Group();

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1.2, 0.35, 0),
        new THREE.Vector3(2.4, -0.45, 0),
        new THREE.Vector3(3.2, -1.4, 0)
      ]);
      const frondGeo = new THREE.TubeGeometry(curve, 10, 0.05, 6, false);
      const frondStem = new THREE.Mesh(frondGeo, frondMat);
      frondGroup.add(frondStem);

      const leafGeo = new THREE.ConeGeometry(0.3, 2.2, 4);
      const leafMesh = new THREE.Mesh(leafGeo, frondMat);
      leafMesh.rotation.z = -Math.PI / 3;
      leafMesh.position.set(1.5, 0.05, 0);
      frondGroup.add(leafMesh);

      frondGroup.rotation.y = angle;
      frondGroup.position.set(crownX, crownY, 0);
      palm.add(frondGroup);
    }

    palm.position.set(x, 0, z);
    this.root.add(palm);
  }

  // ===================== 13. KHÓI HƯƠNG SPRITE TRÒN MỜ & CÁNH HOA RƠI INSTANCED =====================
  private setupSmokeAndPetals() {
    // 1. Khói hương: Sprite tròn mờ (radial gradient), bay lên lượn nhẹ, to dần và mờ dần trong 4-6s
    const smokeTex = getSmokeSpriteTexture();
    const smokeCount = 36;

    for (let i = 0; i < smokeCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: smokeTex,
        depthWrite: false,
        transparent: true,
        opacity: 0.0,
        color: 0xf5f1ea
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.4, 0.4, 1);
      this.root.add(sp);
      this.smokeSprites.push(sp);
      this.smokeLifetimes.push(Math.random()); // Lệch pha để khói liên tục
    }

    // 2. Cánh hoa rơi InstancedMesh (~150 cánh hoa)
    const petalGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xffd1dc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      roughness: 0.5
    });
    this.fallingPetals = new THREE.InstancedMesh(petalGeo, petalMat, this.petalCount);
    this.fallingPetals.frustumCulled = false;

    for (let i = 0; i < this.petalCount; i++) {
      const [ax0, ax1, az0, az1, ayTop] = this.particleArea;
      this.petalData.push({
        x: ax0 + Math.random() * (ax1 - ax0),
        y: 0.5 + Math.random() * (ayTop - 0.5),
        z: az0 + Math.random() * (az1 - az0),
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        speed: 0.6 + Math.random() * 0.5,
        rotSpeed: 0.8 + Math.random() * 1.2
      });
    }
    this.root.add(this.fallingPetals);
  }

  // ===================== CHẾ ĐỘ NGÀY / ĐÊM =====================
  public setDayNight(night: boolean) {
    // Cảnh trong hang / trong điện: ánh sáng cố định, đèn nến luôn sáng
    const fixed = !!this.theme.fixed;
    if (fixed) night = false;
    this.isNight = night;
    for (const o of this.nightOnly) o.visible = night || fixed;
    if (this.redLanternMat) this.redLanternMat.emissiveIntensity = night ? 0.5 : 0.25;
    for (const m of this.waterMats) m.roughness = night ? 0.38 : 0.1;
    if (!this.sunLight || !this.hemiLight || !this.skyMaterial) return;

    if (night) {
      // Đêm: trời hoàng hôn tím (đỉnh chàm -> chân trời tím hồng), sáng dịu chứ không tối đen
      this.skyMaterial.uniforms.topColor.value.setHex(0x17153f);
      this.skyMaterial.uniforms.bottomColor.value.setHex(0x6a4a8c);
      this.skyMaterial.uniforms.glowColor.value.setHex(0xf0a9c4);
      this.skyMaterial.uniforms.glowStrength.value = 0.75;
      this.skyMaterial.uniforms.exponent.value = 0.55;

      this.sunLight.color.setHex(0xa9b2ff);
      this.sunLight.intensity = 0.55;
      this.sunLight.position.set(-35, 30, -35);

      this.hemiLight.color.setHex(0x8577c4);
      this.hemiLight.groundColor.setHex(0x241a36);
      this.hemiLight.intensity = 0.62;
      this.scene.environmentIntensity = 0.15;
      this.scene.fog = new THREE.Fog(0x4a3a6e, Math.min(60, this.theme.fog.near), Math.min(320, this.theme.fog.far));

      if (this.starsPoints) this.starsPoints.visible = true;
      if (this.moonGroup) this.moonGroup.visible = true;
      if (this.skyLanternMesh) this.skyLanternMesh.visible = true;
      if (this.skyLanternGlow) this.skyLanternGlow.visible = true;

      // Đèn lồng, đèn đá, nến chuyển sang emissive ấm (#ffb347), tăng sáng
      for (const pl of this.nightLights) pl.intensity = 1.25;
      for (const pl of this.lanternsGlow) pl.intensity = 1.0;
      for (const m of this.glowMaterials) m.emissiveIntensity = 1.35;
    } else {
      // Ban ngày: màu trời, nắng, sương theo cảnh của phòng
      const th = this.theme;
      this.skyMaterial.uniforms.topColor.value.setHex(th.sky.top);
      this.skyMaterial.uniforms.bottomColor.value.setHex(th.sky.bottom);
      this.skyMaterial.uniforms.glowStrength.value = 0;
      this.skyMaterial.uniforms.exponent.value = 0.65;

      this.sunLight.color.setHex(th.sun.color);
      this.sunLight.intensity = th.sun.intensity;
      this.sunLight.position.set(...th.sun.position);

      this.hemiLight.color.setHex(th.hemi.sky);
      this.hemiLight.groundColor.setHex(th.hemi.ground);
      this.hemiLight.intensity = th.hemi.intensity;
      this.scene.environmentIntensity = 0.35;
      this.scene.fog = new THREE.Fog(th.fog.color, th.fog.near, th.fog.far);

      if (this.starsPoints) this.starsPoints.visible = false;
      if (this.moonGroup) this.moonGroup.visible = false;
      if (this.skyLanternMesh) this.skyLanternMesh.visible = false;
      if (this.skyLanternGlow) this.skyLanternGlow.visible = false;

      const lights = fixed ? this.theme.lights ?? 1 : 0.3;
      for (const pl of this.nightLights) pl.intensity = lights;
      for (const pl of this.lanternsGlow) pl.intensity = fixed ? lights * 0.8 : 0.15;
      for (const m of this.glowMaterials) m.emissiveIntensity = fixed ? this.theme.glow ?? 1 : 0.5;
    }
  }

  // ===================== ĐỔI CẢNH THEO PHÒNG =====================
  public applyTheme(theme: TempleTheme) {
    this.theme = theme;
    const set = (mats: THREE.MeshStandardMaterial[], colors: number | number[]) => {
      mats.forEach((m, i) => m.color.setHex(Array.isArray(colors) ? colors[i % colors.length] : colors));
    };
    set(this.themeMats.mountains, theme.mountains);
    set(this.themeMats.grass, theme.grass);
    set(this.themeMats.grassBlade, theme.grassBlade);
    set(this.themeMats.blossom, theme.blossom);
    set(this.themeMats.foliage, theme.foliage);
    set(this.themeMats.treeFlower, theme.treeFlower);
    set(this.themeMats.palm, theme.palm);

    // Hạt rơi
    const pt = theme.particles;
    this.particleKind = pt.kind;
    this.particleSize = pt.size;
    this.particleSpeed = pt.fallSpeed;
    if (this.fallingPetals) {
      this.fallingPetals.count = Math.min(this.maxParticles, pt.count);
      const pm = this.fallingPetals.material as THREE.MeshStandardMaterial;
      pm.color.setHex(pt.color);
      const glow = pt.kind === 'firefly' ? 1.4 : pt.kind === 'ember' ? 2.2 : pt.kind === 'dust' ? 1.0 : pt.kind === 'snow' ? 0.35 : 0;
      pm.emissive.setHex(pt.color);
      pm.emissiveIntensity = glow;
      pm.opacity = pt.kind === 'snow' ? 0.95 : 0.85;
    }

    // Lá đa trên sân đổi màu theo mùa
    this.leafMats.forEach((m, i) => m.color.setHex(theme.leafPile[i % theme.leafPile.length]));

    this.setDayNight(this.isNight);
  }

  // ===================== NHÀ ĂN (TRAI ĐƯỜNG) =====================
  private buildDiningHall() {
    const D = DINING;
    const cx = (D.minX + D.maxX) / 2;
    const cz = (D.minZ + D.maxZ) / 2;
    const width = D.maxX - D.minX;
    const depth = D.maxZ - D.minZ;
    const wallH = 3.0;
    const hall = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xefe3c8, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ map: getLacqueredWoodTexture(), roughness: 0.65 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.7 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.85 });
    const blockers: THREE.Object3D[] = [];

    // Nền gỗ
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, depth), floorMat);
    floor.position.set(cx, 0.03, cz);
    floor.receiveShadow = true;
    hall.add(floor);

    // Tường: tây (có cửa), đông, bắc, nam
    const addWall = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, 0.3), wallMat);
      wall.position.set((x1 + x2) / 2, wallH / 2, (z1 + z2) / 2);
      wall.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      wall.castShadow = true;
      wall.receiveShadow = true;
      hall.add(wall);
      blockers.push(wall);
      this.collisionBoxes.push({
        minX: Math.min(x1, x2) - 0.15, maxX: Math.max(x1, x2) + 0.15,
        minZ: Math.min(z1, z2) - 0.15, maxZ: Math.max(z1, z2) + 0.15,
        type: 'impassable'
      });
    };
    addWall(D.minX, D.minZ, D.maxX, D.minZ);
    addWall(D.minX, D.maxZ, D.maxX, D.maxZ);
    addWall(D.maxX, D.minZ, D.maxX, D.maxZ);
    addWall(D.minX, D.minZ, D.minX, D.doorZ[0]);
    addWall(D.minX, D.doorZ[1], D.minX, D.maxZ);
    // Khung cửa + xà ngang trên cửa
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.7, D.doorZ[1] - D.doorZ[0] + 0.3), wallMat);
    lintel.position.set(D.minX, wallH - 0.35, (D.doorZ[0] + D.doorZ[1]) / 2);
    hall.add(lintel);
    for (const z of D.doorZ) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH, 0.22), woodMat);
      post.position.set(D.minX, wallH / 2, z);
      hall.add(post);
    }
    // Cửa sổ song gỗ hai bên
    for (const z of [20.4, 26.6]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), darkWood);
      win.position.set(D.minX - 0.16, 1.7, z);
      win.rotation.y = -Math.PI / 2;
      hall.add(win);
      for (let i = -2; i <= 2; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.05), woodMat);
        bar.position.set(D.minX - 0.18, 1.7, z + i * 0.26);
        hall.add(bar);
      }
    }
    // Bảng tên "TRAI ĐƯỜNG" trên cửa, quay ra ngoài (hướng -x)
    const plaqueFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.75),
      new THREE.MeshStandardMaterial({ map: createPlaqueTexture('TRAI ĐƯỜNG', 'Nhà ăn chùa'), roughness: 0.45 })
    );
    plaqueFace.position.set(D.minX - 0.2, wallH + 0.25, (D.doorZ[0] + D.doorZ[1]) / 2);
    plaqueFace.rotation.y = -Math.PI / 2;
    hall.add(plaqueFace);

    // Mái ngói cong
    const roofMat = new THREE.MeshStandardMaterial({ map: getVietnameseCurvedRoofTexture(), side: THREE.DoubleSide, roughness: 0.55 });
    const roof = makeRoofGroup(width + 1.6, depth + 1.6, 2.0, 0.9, roofMat);
    roof.position.set(cx, wallH, cz);
    roof.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    hall.add(roof);
    this.diningRoof = roof;

    // 2 bàn ăn dài + bồ đoàn hai bên
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xc98f2a, roughness: 0.9 });
    for (const t of D.tables) {
      const tw = t.maxX - t.minX;
      const td = t.maxZ - t.minZ;
      const tx = (t.minX + t.maxX) / 2;
      const tz = (t.minZ + t.maxZ) / 2;
      const top = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.08, td), darkWood);
      top.position.set(tx, D.tableTop - 0.04, tz);
      top.castShadow = true;
      top.receiveShadow = true;
      hall.add(top);
      for (const lx of [t.minX + 0.2, t.maxX - 0.2]) {
        for (const lz of [t.minZ + 0.15, t.maxZ - 0.15]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, D.tableTop - 0.08, 0.1), darkWood);
          leg.position.set(lx, (D.tableTop - 0.08) / 2, lz);
          hall.add(leg);
        }
      }
      // Bồ đoàn phía tường (chỗ chư tăng ngồi thọ trai)
      const wallSide = tz < cz ? t.minZ - 0.45 : t.maxZ + 0.45;
      for (let k = 0; k < 4; k++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 18), cushionMat);
        c.position.set(17.1 + k * 1.27, 0.12, wallSide);
        hall.add(c);
      }
      // Đôi đũa + chén trống sẵn trên bàn
      for (let k = 0; k < 4; k++) {
        const bowl = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, side: THREE.DoubleSide })
        );
        bowl.position.set(17.1 + k * 1.27 + 0.3, D.tableTop + 0.09, tz + (tz < cz ? -0.3 : 0.3));
        hall.add(bowl);
      }
      this.collisionBoxes.push({ minX: t.minX, maxX: t.maxX, minZ: t.minZ, maxZ: t.maxZ, type: 'impassable' });
    }

    // Bếp: quầy gỗ, bếp lò lửa đỏ, nồi cơm đồng bốc hơi, chồng mâm
    const C = D.counter;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(C.maxX - C.minX, 0.95, C.maxZ - C.minZ), darkWood);
    counter.position.set((C.minX + C.maxX) / 2, 0.475, (C.minZ + C.maxZ) / 2);
    counter.castShadow = true;
    hall.add(counter);
    blockers.push(counter);
    this.collisionBoxes.push({ minX: C.minX, maxX: C.maxX, minZ: C.minZ, maxZ: C.maxZ, type: 'impassable' });
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(C.maxX - C.minX + 0.1, 0.06, C.maxZ - C.minZ + 0.1), new THREE.MeshStandardMaterial({ color: 0xd6c3a0, roughness: 0.6 }));
    counterTop.position.set((C.minX + C.maxX) / 2, 0.98, (C.minZ + C.maxZ) / 2);
    hall.add(counterTop);

    const bronze = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, metalness: 0.7, roughness: 0.35 });
    const top = D.counterTop;
    // Bếp lò + nồi đồng (đầu quầy)
    const stove = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x3f3a36, roughness: 0.9 }));
    stove.position.set(D.stove.x, top + 0.15, D.stove.z);
    hall.add(stove);
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
    fire.position.set(D.stove.x, top + 0.31, D.stove.z);
    hall.add(fire);
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze);
    pot.rotation.x = Math.PI;
    pot.position.set(D.stove.x, top + 0.71, D.stove.z);
    hall.add(pot);
    const potLid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.06, 20), bronze);
    potLid.position.set(D.stove.x, top + 0.74, D.stove.z);
    hall.add(potLid);
    const fireLight = new THREE.PointLight(0xff8a3a, 1.2, 6);
    fireLight.position.set(D.stove.x - 0.5, 1.6, D.stove.z);
    hall.add(fireLight);

    // Chồng đĩa sứ
    for (let i = 0; i < 6; i++) {
      const plate = makeBunPlateMesh(0);
      plate.position.set(D.plateStack.x, top + i * 0.03, D.plateStack.z);
      hall.add(plate);
    }

    // Xửng tre hấp bánh bao (2 tầng, tầng trên mở nắp thấy bánh)
    const bamboo = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.85 });
    const bambooDark = new THREE.MeshStandardMaterial({ color: 0x9c7a45, roughness: 0.85 });
    for (let tier = 0; tier < 2; tier++) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 24, 1, true), bamboo);
      ring.material.side = THREE.DoubleSide;
      ring.position.set(D.steamer.x, top + 0.07 + tier * 0.15, D.steamer.z);
      hall.add(ring);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 24), bambooDark);
      band.rotation.x = Math.PI / 2;
      band.position.set(D.steamer.x, top + 0.14 + tier * 0.15, D.steamer.z);
      hall.add(band);
    }
    const steamerFloor = new THREE.Mesh(new THREE.CircleGeometry(0.29, 24), bambooDark);
    steamerFloor.rotation.x = -Math.PI / 2;
    steamerFloor.position.set(D.steamer.x, top + 0.17, D.steamer.z);
    hall.add(steamerFloor);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const bun = makeBunMesh();
      bun.position.set(D.steamer.x + Math.cos(a) * 0.15, top + 0.17, D.steamer.z + Math.sin(a) * 0.15);
      hall.add(bun);
    }
    // Nắp xửng dựng nghiêng bên cạnh
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 24), bambooDark);
    lid.position.set(D.steamer.x + 0.35, top + 0.3, D.steamer.z + 0.55);
    lid.rotation.x = 1.2;
    hall.add(lid);

    // Hơi nước bốc lên từ nồi và xửng hấp
    const steamTex = getSmokeSpriteTexture();
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      sp.userData.phase = i / 10;
      sp.userData.base = i % 2 === 0
        ? new THREE.Vector3(D.stove.x, top + 0.8, D.stove.z)
        : new THREE.Vector3(D.steamer.x, top + 0.3, D.steamer.z);
      this.steamSprites.push(sp);
      hall.add(sp);
    }

    // Đèn lồng giấy treo trần
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc46b, emissiveIntensity: 0.9 });
    // Treo sát trần phía trên 2 dãy bàn (không chắn tầm nhìn ở lối đi giữa)
    for (const t of D.tables) {
      for (const lx of [17.5, 20.5]) {
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), lanternMat);
        lantern.scale.y = 1.3;
        lantern.position.set(lx, 2.75, (t.minZ + t.maxZ) / 2);
        hall.add(lantern);
      }
    }
    this.glowMaterials.push(lanternMat);
    const inLight = new THREE.PointLight(0xffe2b0, 1.4, 14);
    inLight.position.set(cx - 1, 2.4, cz);
    hall.add(inLight);

    hall.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m.material as THREE.Material).transparent) m.receiveShadow = true;
    });
    this.root.add(hall);
    this.cameraBlockers.push(...blockers);
    this.root.add(this.trayLayer);
  }

  // Đĩa bánh bao đang bày trên quầy: null = chưa lấy đĩa, 0-3 = số bánh bao trên đĩa
  public setCounterPlate(buns: number | null) {
    if (this.counterPlate) {
      this.root.remove(this.counterPlate);
      this.counterPlate = null;
    }
    if (buns === null || this.mapId !== 'main') return;
    this.counterPlate = makeBunPlateMesh(buns);
    this.counterPlate.position.set(DINING.workPlate.x, DINING.counterTop, DINING.workPlate.z);
    this.root.add(this.counterPlate);
  }

  // Ẩn mái nhà ăn khi người chơi đang ở trong để nhìn thấy bên trong
  public updateInterior(x: number, z: number) {
    if (!this.diningRoof) return;
    const D = DINING;
    const inside = x > D.minX && x < D.maxX && z > D.minZ && z < D.maxZ;
    this.diningRoof.visible = !inside;
  }

  public isInsideDining(x: number, z: number) {
    if (this.mapId !== 'main') return false;
    const D = DINING;
    return x > D.minX && x < D.maxX && z > D.minZ && z < D.maxZ;
  }

  // Mâm cơm trên bàn (đồng bộ từ server)
  public syncTrays(list: TrayItem[]) {
    const ids = new Set(list.map(t => t.id));
    for (const [id, g] of this.trayMeshes) {
      if (!ids.has(id)) {
        this.trayLayer.remove(g);
        this.trayMeshes.delete(id);
      }
    }
    for (const t of list) {
      if (this.trayMeshes.has(t.id)) continue;
      const slot = traySlot(t.slot);
      const g = makeBunPlateMesh(3);
      g.position.set(slot.x, DINING.tableTop, slot.z);
      g.rotation.y = Math.random() * 0.3 - 0.15;
      this.trayLayer.add(g);
      this.trayMeshes.set(t.id, g);
    }
  }

  // Chỗ đặt mâm còn trống gần nhất (đều đầy thì lấy mâm cũ nhất)
  public pickTraySlot(x: number, z: number, list: TrayItem[]): number {
    const used = new Map(list.map(t => [t.slot, t.createdAt]));
    let best = -1;
    let bestD = Infinity;
    for (let s = 0; s < 8; s++) {
      if (used.has(s)) continue;
      const sp = traySlot(s).spot;
      const d = Math.hypot(sp.x - x, sp.z - z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best >= 0) return best;
    return [...used.entries()].sort((a, b) => a[1] - b[1])[0][0];
  }

  // ===================== BIA CÔNG ĐỨC (rùa đội bia) =====================
  private buildMeritStele() {
    const x = -12.5;
    const z = 33;
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.9 });

    // Rùa đá đội bia
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 12), stoneMat);
    shell.scale.set(0.95, 0.42, 1.3);
    shell.position.y = 0.3;
    group.add(shell);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), stoneMat);
    head.scale.set(0.9, 0.8, 1.2);
    head.position.set(0, 0.42, 1.25);
    group.add(head);
    for (const [fx, fz] of [[-0.7, 0.75], [0.7, 0.75], [-0.7, -0.75], [0.7, -0.75]]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), stoneMat);
      foot.scale.set(1, 0.5, 1.2);
      foot.position.set(fx, 0.1, fz);
      group.add(foot);
    }

    // Tấm bia: mặt trước khắc chữ (texture vẽ lại khi có người đứng đầu mới)
    // Hơi tự phát sáng để đọc được chữ cả khi bia nằm trong bóng tường
    this.steleMat = new THREE.MeshStandardMaterial({ roughness: 0.75, emissive: 0xffffff, emissiveIntensity: 0.35 });
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.3, 0.22),
      [stoneMat, stoneMat, stoneMat, stoneMat, this.steleMat, stoneMat]
    );
    slab.position.y = 1.75;
    group.add(slab);
    // Chóp bia hình bán nguyệt
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.26, 24, 1, false, Math.PI / 2, Math.PI), stoneMat);
    cap.rotation.x = Math.PI / 2;
    cap.scale.y = 0.55;
    cap.position.y = 2.9;
    group.add(cap);

    // Quay mặt bia về phía lối đi chính
    group.rotation.y = Math.PI / 2;
    group.position.set(x, 0, z);
    this.root.add(group);
    this.collisionCircles.push({ x, z, r: 1.3 });
    this.updateStele([], null);
  }

  // Khắc tên người đứng đầu công đức các tuần lên bia
  public updateStele(winners: { week: string; name: string; merit: number }[], leader: { name: string; merit: number } | null) {
    if (!this.steleMat) return;
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 576;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 576);
    grad.addColorStop(0, '#8d877c');
    grad.addColorStop(1, '#6f6a61');
    g.fillStyle = grad;
    g.fillRect(0, 0, 384, 576);
    g.strokeStyle = 'rgba(40, 30, 20, 0.55)';
    g.lineWidth = 6;
    g.strokeRect(16, 16, 352, 544);

    g.textAlign = 'center';
    g.fillStyle = '#3b2a12';
    g.font = '900 38px "Noto Serif", Georgia, serif';
    g.fillText('BIA CÔNG ĐỨC', 192, 70);
    g.font = '500 18px "Be Vietnam Pro", sans-serif';
    g.fillText('Ghi danh người đứng đầu mỗi tuần', 192, 100);
    g.fillRect(70, 115, 244, 3);

    const fmtWeek = (w: string) => w.split('-').reverse().slice(0, 2).join('/');
    g.textAlign = 'left';
    if (!winners.length) {
      g.textAlign = 'center';
      g.font = 'italic 20px "Noto Serif", Georgia, serif';
      g.fillText('Chưa có ai được khắc tên', 192, 200);
      g.fillText('Tích công đức để ghi danh 🙏', 192, 232);
    }
    winners.slice(0, 8).forEach((w, i) => {
      const y = 158 + i * 46;
      g.font = '700 22px "Noto Serif", Georgia, serif';
      g.fillStyle = i === 0 ? '#5a3a00' : '#3b2a12';
      const name = w.name.length > 14 ? w.name.slice(0, 13) + '…' : w.name;
      g.fillText(`${i === 0 ? '★ ' : ''}${name}`, 36, y);
      g.textAlign = 'right';
      g.font = '500 16px "Be Vietnam Pro", sans-serif';
      g.fillText(`tuần ${fmtWeek(w.week)} · ${w.merit}`, 350, y);
      g.textAlign = 'left';
    });

    g.textAlign = 'center';
    g.fillStyle = '#2e1f0c';
    g.font = '600 18px "Be Vietnam Pro", sans-serif';
    g.fillText('Tuần này dẫn đầu:', 192, 520);
    g.font = '700 20px "Noto Serif", Georgia, serif';
    g.fillText(leader ? `${leader.name} (${leader.merit})` : 'Đang chờ người đầu tiên', 192, 546);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.steleMat.map?.dispose();
    this.steleMat.map = tex;
    this.steleMat.emissiveMap = tex;
    this.steleMat.needsUpdate = true;
  }

  // ===================== CÔNG TRÌNH CÚNG DƯỜNG CHUNG =====================
  // animate = mọc lên từ mặt đất khi vừa xây xong
  public setBuiltProjects(ids: string[], animate = true) {
    if (this.mapId !== 'main') return; // công trình chung chỉ xây ở chùa chính
    for (const id of ids) {
      if (this.builtProjects.has(id)) continue;
      let group: THREE.Group | null = null;
      if (id === 'bao_thap') group = this.buildPagoda(-23, -15);
      else if (id === 'quan_am') group = this.buildGrandQuanAm(-17, -11);
      else if (id === 'ho_sen_2') group = this.buildSecondPond(18, -12);
      if (!group) continue;
      group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !(m.material as THREE.Material).transparent) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      this.root.add(group);
      group.scale.setScalar(animate ? 0.01 : 1);
      this.builtProjects.set(id, { group, grow: animate ? 0 : 1 });
    }
  }

  // Bảo tháp 5 tầng mái cong
  public buildPagoda(x: number, z: number, tiers = 5): THREE.Group {
    const group = new THREE.Group();
    const roofMat = new THREE.MeshStandardMaterial({ map: getVietnameseCurvedRoofTexture(), side: THREE.DoubleSide, roughness: 0.55 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc4, roughness: 0.85 });
    const woodMat = new THREE.MeshStandardMaterial({ map: getLacqueredWoodTexture(), roughness: 0.65 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a537, metalness: 0.85, roughness: 0.3 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8c867a, roughness: 0.9 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.6, 8), stoneMat);
    base.position.y = 0.3;
    group.add(base);

    let y = 0.6;
    const step = 2.1 / Math.max(5, tiers);
    for (let tier = 0; tier < tiers; tier++) {
      const w = 3.0 - tier * step;
      const h = tier === 0 ? 1.7 : 1.15;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), wallMat);
      body.position.y = y + h / 2;
      group.add(body);
      // Cửa vòm đỏ 4 mặt
      for (let side = 0; side < 4; side++) {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, h * 0.55), woodMat);
        const a = (side * Math.PI) / 2;
        door.position.set(Math.sin(a) * (w / 2 + 0.01), y + h * 0.42, Math.cos(a) * (w / 2 + 0.01));
        door.rotation.y = a;
        group.add(door);
      }
      y += h;
      const roof = makeRoofGroup(w + 1.3, w + 1.3, 0.75, 0.55, roofMat);
      roof.position.y = y - 0.15;
      group.add(roof);
      y += 0.45;
    }
    // Chóp tháp: hồ lô vàng
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 12), goldMat);
    finial.position.y = y + 0.6;
    group.add(finial);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18 - i * 0.03, 0.04, 6, 16), goldMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y + 0.2 + i * 0.25;
      group.add(ring);
    }

    group.position.set(x, 0, z);
    this.collisionCircles.push({ x, z, r: 2.6 });
    return group;
  }

  // Tượng Quan Âm lộ thiên cao lớn trên đài sen
  private buildGrandQuanAm(x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8c867a, roughness: 0.9 });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 1.2, 8), stoneMat);
    pedestal.position.y = 0.6;
    group.add(pedestal);
    const pedestal2 = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.5, 8), stoneMat);
    pedestal2.position.y = 1.45;
    group.add(pedestal2);
    const figure = this.makeQuanAmFigure();
    figure.scale.setScalar(2.4);
    figure.position.y = 1.7;
    figure.rotation.y = Math.PI * 0.15;
    group.add(figure);
    const light = new THREE.PointLight(0xfff1c1, 0.8, 10);
    light.position.set(0, 4, 2);
    group.add(light);
    this.nightLights.push(light);
    group.position.set(x, 0, z);
    this.collisionCircles.push({ x, z, r: 2.2 });
    return group;
  }

  // Hồ sen thứ hai: mặt nước, bờ đá, lá sen, hoa sen, cá koi
  private buildSecondPond(x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 0.3, 32),
      this.waterMat(new THREE.MeshStandardMaterial({ color: 0x1d5d6e, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.88 }))
    );
    water.position.y = -0.1;
    group.add(water);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.25, 0), rockMat);
      rock.position.set(Math.cos(a) * 4.15, 0.05, Math.sin(a) * 4.15);
      rock.scale.set(1.3, 0.5, 1);
      rock.rotation.y = -a;
      group.add(rock);
    }
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 2.8;
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.4 + Math.random() * 0.25, 12), leafMat);
      leaf.rotation.x = -Math.PI / 2;
      leaf.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r);
      group.add(leaf);
      if (i % 2 === 0) {
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), pinkMat);
        bud.scale.set(1, 1.3, 1);
        bud.position.set(Math.cos(a) * r + 0.1, 0.2, Math.sin(a) * r);
        group.add(bud);
      }
    }
    const koiMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3 });
    for (let k = 0; k < 3; k++) {
      const koi = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), koiMat);
      koi.rotation.x = Math.PI / 2;
      const a = (k / 3) * Math.PI * 2;
      koi.position.set(Math.cos(a) * 2, -0.02, Math.sin(a) * 2);
      group.add(koi);
    }
    group.position.set(x, 0, z);
    this.collisionCircles.push({ x, z, r: 4.6 });
    return group;
  }

  // ===================== LÁ ĐA RỤNG =====================
  private getLeafAssets() {
    if (!this.leafGeo) {
      // Lá đa: bầu dục, đầu nhọn, cuống ngắn
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.11);
      shape.quadraticCurveTo(0.1, -0.06, 0.085, 0.04);
      shape.quadraticCurveTo(0.06, 0.12, 0, 0.17);
      shape.quadraticCurveTo(-0.06, 0.12, -0.085, 0.04);
      shape.quadraticCurveTo(-0.1, -0.06, 0, -0.11);
      this.leafGeo = new THREE.ShapeGeometry(shape, 6);
      this.leafGeo.rotateX(-Math.PI / 2);
      this.leafMats = [0, 1, 2, 3].map(i => new THREE.MeshStandardMaterial({
        color: this.theme.leafPile[i % this.theme.leafPile.length],
        roughness: 0.8,
        side: THREE.DoubleSide
      }));
    }
    return { geo: this.leafGeo, mats: this.leafMats };
  }

  // Thêm 1 đống lá; animate = lá rơi từ trên cây xuống
  public addLeafPile(data: LeafPile, animate = true) {
    if (this.leafPiles.has(data.id)) return;
    const { geo, mats } = this.getLeafAssets();
    const group = new THREE.Group();
    let seed = data.seed || 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed % 10000) / 10000;
    };
    const count = 9 + Math.floor(rand() * 5);
    for (let i = 0; i < count; i++) {
      const leaf = new THREE.Mesh(geo, mats[i % mats.length]);
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.5;
      leaf.position.set(Math.cos(a) * r, 0.015 + i * 0.004, Math.sin(a) * r);
      leaf.rotation.set((rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4);
      const sc = 0.9 + rand() * 0.6;
      leaf.scale.setScalar(sc);
      leaf.userData.rest = leaf.position.clone();
      leaf.userData.drop = 4 + rand() * 4;       // độ cao bắt đầu rơi
      leaf.userData.spin = (rand() - 0.5) * 6;
      leaf.receiveShadow = true;
      group.add(leaf);
    }
    group.position.set(data.x, this.getGroundHeight(data.x, data.z), data.z);
    this.leafLayer.add(group);
    this.leafPiles.set(data.id, { data, group, falling: animate ? 0 : 1, sweptAt: 0 });
  }

  // Quét đống lá: lá bay gọn về một phía rồi biến mất (sau delay để khớp động tác chổi)
  public removeLeafPile(id: string, delayMs = 0) {
    const pile = this.leafPiles.get(id);
    if (!pile || pile.sweptAt) return;
    pile.sweptAt = performance.now() + delayMs;
  }

  public syncLeafPiles(list: LeafPile[]) {
    const ids = new Set(list.map(l => l.id));
    for (const [id, pile] of this.leafPiles) {
      if (!ids.has(id)) {
        this.leafLayer.remove(pile.group);
        this.leafPiles.delete(id);
      }
    }
    for (const l of list) this.addLeafPile(l, false);
  }

  // Đống lá gần nhất còn trên sân
  public getNearestLeafPile(x: number, z: number): LeafPile | null {
    let best: LeafPile | null = null;
    let bestD = Infinity;
    for (const pile of this.leafPiles.values()) {
      if (pile.sweptAt) continue;
      const d = Math.hypot(pile.data.x - x, pile.data.z - z);
      if (d < bestD) {
        bestD = d;
        best = pile.data;
      }
    }
    return best;
  }

  private updateLeafPiles(delta: number) {
    const now = performance.now();
    for (const [id, pile] of this.leafPiles) {
      // Lá rơi xoáy từ trên cao xuống
      if (pile.falling < 1) {
        pile.falling = Math.min(1, pile.falling + delta / 3.2);
        const f = pile.falling;
        for (const leaf of pile.group.children) {
          const rest = leaf.userData.rest as THREE.Vector3;
          const h = leaf.userData.drop * (1 - f) * (1 - f);
          leaf.position.set(
            rest.x + Math.sin(f * 9 + leaf.userData.spin) * 0.6 * (1 - f),
            rest.y + h,
            rest.z + Math.cos(f * 7 + leaf.userData.spin) * 0.6 * (1 - f)
          );
          leaf.rotation.z = leaf.userData.spin * (1 - f);
        }
      }
      // Bị quét: lá dồn lại, thu nhỏ rồi biến mất
      if (pile.sweptAt && now >= pile.sweptAt) {
        const k = Math.min(1, (now - pile.sweptAt) / 900);
        for (const leaf of pile.group.children) {
          const rest = leaf.userData.rest as THREE.Vector3;
          leaf.position.set(rest.x * (1 - k) + k * 0.6, rest.y + Math.sin(k * Math.PI) * 0.15, rest.z * (1 - k));
        }
        pile.group.scale.setScalar(Math.max(0.01, 1 - k));
        if (k >= 1) {
          this.leafLayer.remove(pile.group);
          this.leafPiles.delete(id);
        }
      }
    }
  }

  // ===================== ĐỒNG BỘ ĐỒ VẬT =====================
  // Thêm đồ vật mới (một người vừa thắp hương / dâng hoa / thả đèn) mà không đụng tới đồ đang có
  public addObjects(incenseList: IncenseItem[], flowerList: FlowerItem[], lanternList: LanternItem[]) {
    for (const item of incenseList) {
      if (this.incenseMeshMap.has(item.id)) continue;
      const mesh = this.createIncenseStickMesh(item.x, item.y, item.z);
      this.root.add(mesh);
      this.incenseMeshMap.set(item.id, mesh);
    }
    for (const item of flowerList) {
      if (this.flowerMeshMap.has(item.id)) continue;
      const mesh = this.createAltarLotusMesh(item.x, item.y, item.z);
      this.root.add(mesh);
      this.flowerMeshMap.set(item.id, mesh);
    }
    for (const item of lanternList) {
      if (this.lanternMeshMap.has(item.id)) continue;
      const mesh = this.createFloatingLanternMesh(item);
      this.lanternLayer.add(mesh);
      this.lanternMeshMap.set(item.id, mesh);
    }
  }

  // Đồng bộ toàn bộ danh sách (vào phòng, đổi phòng, server dọn đồ hết hạn): xoá đồ không còn trong danh sách
  public syncObjects(incenseList: IncenseItem[], flowerList: FlowerItem[], lanternList: LanternItem[]) {
    const currentIncenseIds = new Set(incenseList.map(i => i.id));
    for (const [id, mesh] of this.incenseMeshMap.entries()) {
      if (!currentIncenseIds.has(id)) {
        this.root.remove(mesh);
        this.disposeOfferingMesh(mesh);
        this.incenseMeshMap.delete(id);
      }
    }
    for (const item of incenseList) {
      if (!this.incenseMeshMap.has(item.id)) {
        const mesh = this.createIncenseStickMesh(item.x, item.y, item.z);
        this.root.add(mesh);
        this.incenseMeshMap.set(item.id, mesh);
      }
    }

    const currentFlowerIds = new Set(flowerList.map(f => f.id));
    for (const [id, mesh] of this.flowerMeshMap.entries()) {
      if (!currentFlowerIds.has(id)) {
        this.root.remove(mesh);
        this.disposeOfferingMesh(mesh);
        this.flowerMeshMap.delete(id);
      }
    }
    for (const item of flowerList) {
      if (!this.flowerMeshMap.has(item.id)) {
        const mesh = this.createAltarLotusMesh(item.x, item.y, item.z);
        this.root.add(mesh);
        this.flowerMeshMap.set(item.id, mesh);
      }
    }

    const currentLanternIds = new Set(lanternList.map(l => l.id));
    for (const [id, mesh] of this.lanternMeshMap.entries()) {
      if (!currentLanternIds.has(id)) {
        this.lanternLayer.remove(mesh);
        this.disposeOfferingMesh(mesh);
        this.lanternMeshMap.delete(id);
      }
    }
    for (const item of lanternList) {
      if (!this.lanternMeshMap.has(item.id)) {
        const mesh = this.createFloatingLanternMesh(item);
        this.lanternLayer.add(mesh);
        this.lanternMeshMap.set(item.id, mesh);
      }
    }
  }

  // Giải phóng geometry đã gộp (material dùng chung nên không dispose ở đây) để tránh rò rỉ bộ nhớ GPU
  // khi nhang/hoa/đèn hết hạn và liên tục bị tạo-xoá trong phiên chơi dài.
  private disposeOfferingMesh(root: THREE.Object3D) {
    root.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }

  // Ghép ma trận "vị trí cục bộ sau khi xoay theo nhóm cha" giống hệt cách Object3D cha-con cũ tính ra,
  // để gộp hình học mà không làm lệch vị trí so với bản gốc.
  private static partMatrix(parentX: number, parentZ: number, parentTiltZ: number, localX: number, localY: number, localZ: number): THREE.Matrix4 {
    return new THREE.Matrix4()
      .makeTranslation(parentX, 0, parentZ)
      .multiply(new THREE.Matrix4().makeRotationZ(parentTiltZ))
      .multiply(new THREE.Matrix4().makeTranslation(localX, localY, localZ));
  }

  // Ma trận vị trí + xoay (Euler) + tỉ lệ cho một khối lá/cánh hoa gắn thẳng vào group gốc (không qua cha trung gian)
  private static leafMatrix(px: number, py: number, pz: number, euler: THREE.Euler, scale?: THREE.Vector3): THREE.Matrix4 {
    const q = new THREE.Quaternion().setFromEuler(euler);
    return new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), q, scale ?? new THREE.Vector3(1, 1, 1));
  }

  // Gộp nhiều khối hình lại thành 1 BufferGeometry duy nhất (kèm màu từng phần) để giảm số draw call
  // khi có nhiều nhang/hoa/đèn hoa đăng cùng lúc trên bàn thờ/mặt hồ.
  public mergeColoredParts(parts: { geo: THREE.BufferGeometry; color: THREE.ColorRepresentation; matrix?: THREE.Matrix4 }[]): THREE.BufferGeometry {
    const tmpColor = new THREE.Color();
    const pieces: THREE.BufferGeometry[] = [];
    const mixed = parts.some(pt => pt.geo.index) && parts.some(pt => !pt.geo.index);
    for (const part of parts) {
      const g = mixed && part.geo.index ? part.geo.toNonIndexed() : part.geo;
      if (g !== part.geo) part.geo.dispose();
      if (part.matrix) g.applyMatrix4(part.matrix);
      tmpColor.set(part.color);
      const count = g.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      pieces.push(g);
    }
    const merged = mergeGeometries(pieces, false);
    for (const g of pieces) g.dispose();
    return merged;
  }

  private createIncenseStickMesh(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const woodParts: { geo: THREE.BufferGeometry; color: THREE.ColorRepresentation; matrix: THREE.Matrix4 }[] = [];
    const tipGeos: THREE.BufferGeometry[] = [];

    // Bó 3 nén hương hơi xòe ra
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * 0.03;
      const tilt = (i - 1) * 0.12;

      const body = new THREE.CylinderGeometry(0.014, 0.014, 0.62, 5);
      woodParts.push({ geo: body, color: 0x9a3412, matrix: TempleWorld.partMatrix(offsetX, 0, tilt, 0, 0.31, 0) });

      const handle = new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5);
      woodParts.push({ geo: handle, color: 0xb91c1c, matrix: TempleWorld.partMatrix(offsetX, 0, tilt, 0, -0.05, 0) });

      const tip = new THREE.SphereGeometry(0.02, 6, 6);
      tip.applyMatrix4(TempleWorld.partMatrix(offsetX, 0, tilt, 0, 0.63, 0));
      tipGeos.push(tip);
    }

    const woodMesh = new THREE.Mesh(this.mergeColoredParts(woodParts), this.offeringMat.incenseWood);
    group.add(woodMesh);
    const tipMesh = new THREE.Mesh(mergeGeometries(tipGeos, false), this.offeringMat.incenseTip);
    for (const g of tipGeos) g.dispose();
    group.add(tipMesh);

    const glow = new THREE.Sprite(this.offeringMat.incenseGlow);
    glow.scale.set(0.12, 0.12, 1);
    glow.position.y = 0.63;
    group.add(glow);

    group.rotation.y = Math.random() * Math.PI;
    group.position.set(x, y, z);
    return group;
  }

  private createAltarLotusMesh(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const parts: { geo: THREE.BufferGeometry; color: THREE.ColorRepresentation; matrix: THREE.Matrix4 }[] = [];

    const center = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
    parts.push({ geo: center, color: 0xfacc15, matrix: new THREE.Matrix4() });

    for (let p = 0; p < 8; p++) {
      const petal = new THREE.ConeGeometry(0.08, 0.22, 5);
      const pa = (p * Math.PI * 2) / 8;
      const e = new THREE.Euler(Math.sin(pa) * -0.4, 0, Math.cos(pa) * 0.4);
      const mx = TempleWorld.leafMatrix(Math.cos(pa) * 0.12, 0.08, Math.sin(pa) * 0.12, e);
      parts.push({ geo: petal, color: 0xf472b6, matrix: mx });
    }

    const mesh = new THREE.Mesh(this.mergeColoredParts(parts), this.offeringMat.lotus);
    group.add(mesh);
    group.position.set(x, y, z);
    return group;
  }

  private createFloatingLanternMesh(item: LanternItem): THREE.Group {
    const group = new THREE.Group();
    group.userData = { lanternData: item };

    // Đế + cây nến gộp chung 1 khối (không phát sáng)
    const baseParts: { geo: THREE.BufferGeometry; color: THREE.ColorRepresentation; matrix: THREE.Matrix4 }[] = [
      { geo: new THREE.CylinderGeometry(0.26, 0.2, 0.08, 12), color: 0x4d7c0f, matrix: new THREE.Matrix4() },
      { geo: new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), color: 0xfff7ed, matrix: new THREE.Matrix4().makeTranslation(0, 0.16, 0) }
    ];
    const baseMesh = new THREE.Mesh(this.mergeColoredParts(baseParts), this.offeringMat.lanternBase);
    group.add(baseMesh);

    // 2 tầng cánh sen phát sáng ấm gộp chung 1 khối
    const petalParts: { geo: THREE.BufferGeometry; color: THREE.ColorRepresentation; matrix: THREE.Matrix4 }[] = [];
    const petalScale = new THREE.Vector3(0.7, 1.4, 0.35);
    for (const [count, radius, tilt, color, h] of [[8, 0.2, 0.55, 0xf9a8d4, 0.1], [6, 0.11, 0.3, 0xfce7f3, 0.14]] as const) {
      for (let i = 0; i < count; i++) {
        const petal = new THREE.SphereGeometry(0.1, 8, 6);
        const a = (i / count) * Math.PI * 2;
        const e = new THREE.Euler(tilt, -a + Math.PI / 2, 0, 'YXZ');
        const mx = TempleWorld.leafMatrix(Math.cos(a) * radius, h, Math.sin(a) * radius, e, petalScale);
        petalParts.push({ geo: petal, color, matrix: mx });
      }
    }
    const petalMesh = new THREE.Mesh(this.mergeColoredParts(petalParts), this.offeringMat.lanternPetal);
    group.add(petalMesh);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), this.offeringMat.lanternFlame);
    flame.position.y = 0.28;
    group.add(flame);

    const glow = new THREE.Sprite(this.offeringMat.lanternGlow);
    glow.scale.set(0.9, 0.9, 1);
    glow.position.y = 0.3;
    group.add(glow);

    group.position.set(item.x, 0.06, item.z);
    return group;
  }

  public triggerBellRing() {
    this.bellRingingTimer = 1.0;
  }

  public triggerDrumBeat() {
    this.drumBeatingTimer = 1.0;
  }

  // ===================== TICK HOẠT HỌA =====================
  public update(delta: number, elapsed: number) {
    for (const fn of this.animators) fn(delta, elapsed);
    this.updateSkyLanterns(delta, elapsed);
    this.updateWishes(delta, elapsed);
    // 1. Mây trôi chậm rãi trên bầu trời
    if (this.cloudsGroup) {
      for (const cl of this.cloudsGroup.children) {
        cl.position.x += delta * 0.65;
        if (cl.position.x > 120) cl.position.x = -120;
      }
    }

    // 2. Khói hương tròn mờ: bay lên từ lư hương, lượn nhẹ, to dần và mờ dần
    const urn = this.incenseUrnGroup?.position;
    const smokeStrength = Math.min(1, 0.35 + this.incenseMeshMap.size * 0.12);
    for (let i = 0; i < this.smokeSprites.length; i++) {
      const sp = this.smokeSprites[i];
      const lt = (this.smokeLifetimes[i] + delta * 0.18) % 1.0;
      this.smokeLifetimes[i] = lt;

      const swirl = 0.08 + lt * 0.55;
      sp.position.set(
        (urn?.x ?? 0) + Math.sin(elapsed * 0.9 + i * 1.7) * swirl + lt * 0.6,
        this.smokeY + lt * 4.2,
        (urn?.z ?? 0) + Math.cos(elapsed * 0.7 + i * 2.3) * swirl
      );

      const scale = 0.3 + lt * 1.6;
      sp.scale.set(scale, scale, 1);
      (sp.material as THREE.SpriteMaterial).opacity = Math.sin(lt * Math.PI) * 0.32 * smokeStrength;
      sp.material.rotation = elapsed * 0.2 + i;
    }

    // 3. Hạt rơi theo cảnh: cánh hoa, lá vàng, tuyết hoặc đom đóm
    if (this.fallingPetals) {
      const kind = this.particleKind;
      const count = this.fallingPetals.count;
      for (let i = 0; i < count; i++) {
        const p = this.petalData[i];
        const [ax0, ax1, az0, az1, ayTop] = this.particleArea;
        if (kind === 'ember') {
          // Tàn lửa: bốc lên từ mặt đất, lượn nhẹ, tắt dần khi lên cao
          p.y += delta * p.speed * this.particleSpeed * 1.4;
          p.x += Math.sin(elapsed * 1.7 + i) * delta * 0.5;
          p.z += Math.cos(elapsed * 1.3 + i * 1.7) * delta * 0.4;
          const life = Math.max(0, 1 - p.y / ayTop);
          this.petalDummy.scale.setScalar(this.particleSize * (0.3 + 0.7 * life) * (0.7 + 0.3 * Math.sin(elapsed * 9 + i)));
          if (p.y > ayTop) {
            p.y = 0.05;
            p.x = ax0 + Math.random() * (ax1 - ax0);
            p.z = az0 + Math.random() * (az1 - az0);
          }
        } else if (kind === 'dust') {
          // Bụi vàng lơ lửng trong nắng: trôi rất chậm, lấp lánh
          p.x += Math.sin(elapsed * 0.21 + i * 1.3) * delta * 0.12;
          p.z += Math.cos(elapsed * 0.17 + i * 2.1) * delta * 0.12;
          p.y += Math.sin(elapsed * 0.3 + i) * delta * 0.08;
          this.petalDummy.scale.setScalar(this.particleSize * (0.4 + 0.6 * Math.max(0, Math.sin(elapsed * 0.9 + i * 0.7))));
        } else if (kind === 'firefly') {
          // Đom đóm bay lượn thấp, nhấp nháy
          p.x += Math.sin(elapsed * 0.7 + i * 1.3) * delta * 0.6;
          p.z += Math.cos(elapsed * 0.6 + i * 2.1) * delta * 0.6;
          p.y = 0.6 + (i % 7) * 0.35 + Math.sin(elapsed * 1.1 + i) * 0.4;
          const blink = 0.4 + 0.6 * Math.max(0, Math.sin(elapsed * 2.2 + i * 0.9));
          this.petalDummy.scale.setScalar(this.particleSize * blink);
        } else {
          p.y -= delta * p.speed * this.particleSpeed;
          const sway = kind === 'snow' ? 0.5 : kind === 'leaf' ? 0.8 : 0.3;
          p.x += Math.sin(elapsed * 1.5 + i) * delta * sway;
          p.rx += delta * p.rotSpeed * (kind === 'snow' ? 0.2 : 1);
          p.ry += delta * (p.rotSpeed * 0.7);
          this.petalDummy.scale.setScalar(this.particleSize);
        }

        if (p.y < 0.1 && kind !== 'ember' && kind !== 'dust') {
          p.y = ayTop * 0.75 + Math.random() * ayTop * 0.25;
          p.x = ax0 + Math.random() * (ax1 - ax0);
          p.z = az0 + Math.random() * (az1 - az0);
        }

        this.petalDummy.position.set(p.x, p.y, p.z);
        this.petalDummy.rotation.set(p.rx, p.ry, 0);
        this.petalDummy.updateMatrix();
        this.fallingPetals.setMatrixAt(i, this.petalDummy.matrix);
      }
      this.fallingPetals.instanceMatrix.needsUpdate = true;
    }

    this.updateLeafPiles(delta);
    for (const sp of this.steamSprites) {
      const lt = (sp.userData.phase + elapsed * 0.25) % 1;
      const base = sp.userData.base as THREE.Vector3;
      sp.position.set(base.x + Math.sin(elapsed + lt * 6) * 0.08, base.y + lt * 1.1, base.z);
      sp.scale.setScalar(0.25 + lt * 0.6);
      (sp.material as THREE.SpriteMaterial).opacity = Math.sin(lt * Math.PI) * 0.35;
    }
    for (const b of this.builtProjects.values()) {
      if (b.grow >= 1) continue;
      b.grow = Math.min(1, b.grow + delta / 2.5);
      const k = 1 - Math.pow(1 - b.grow, 3);
      b.group.scale.setScalar(Math.max(0.01, k));
    }

    // 4. Hào quang Đức Phật Thích Ca nhấp nháy nhẹ trang nghiêm
    if (this.buddhaHalo) {
      this.buddhaHalo.rotation.z += delta * 0.08;
      (this.buddhaHalo.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(elapsed * 1.6) * 0.08;
    }

    // 5. Đèn hoa đăng trôi chậm vòng quanh hồ sen, dập dềnh theo sóng
    const pondCenterX = -18;
    const pondCenterZ = 24;
    for (const lanternGroup of this.lanternLayer.children) {
      const data = lanternGroup.userData?.lanternData as LanternItem | undefined;
      if (!data) continue;
      const seed = data.seed || 1;
      const startAngle = Math.atan2(data.z - pondCenterZ, data.x - pondCenterX);
      const radius = Math.min(6.2, Math.max(3.0, Math.hypot(data.x - pondCenterX, data.z - pondCenterZ)));
      const age = (Date.now() - data.createdAt) / 1000;
      const angle = startAngle + age * 0.025 * (seed % 2 === 0 ? 1 : -1);
      const r = radius + Math.sin(age * 0.2 + seed) * 0.3;
      lanternGroup.position.set(
        pondCenterX + Math.cos(angle) * r,
        0.06 + Math.sin(elapsed * 1.8 + seed) * 0.025,
        pondCenterZ + Math.sin(angle) * r
      );
      lanternGroup.rotation.y += delta * 0.15;
      lanternGroup.rotation.z = Math.sin(elapsed * 1.3 + seed) * 0.05;
    }

    // 6. Hoạt ảnh rung chuông & chày
    if (this.bellRingingTimer > 0) {
      this.bellRingingTimer -= delta * 0.35;
      const decay = Math.max(0, this.bellRingingTimer);
      if (this.bellMesh) this.bellMesh.rotation.z = Math.sin(elapsed * 12) * 0.08 * decay;
      if (this.strikerMesh) this.strikerMesh.rotation.z = Math.sin(elapsed * 10) * 0.25 * decay;
    }

    // 7. Hoạt ảnh rung trống
    if (this.drumBeatingTimer > 0) {
      this.drumBeatingTimer -= delta * 0.6;
      const decay = Math.max(0, this.drumBeatingTimer);
      if (this.drumMesh) {
        this.drumMesh.rotation.x = -Math.sin(elapsed * 3.2) * 0.06 * decay;
        const drum = this.drumMesh.children[0];
        const shake = 1 + Math.sin(elapsed * 22) * 0.025 * decay;
        drum.scale.set(shake, shake, 1);
      }
    }
  }

  // ===================== ĐỘ CAO MẶT NỀN =====================
  // Nền chính điện cao 0.9, 5 bậc tam cấp mỗi bậc 0.18, nền lầu chuông bát giác cao 0.6 có mép vát
  public getGroundHeight(x: number, z: number): number {
    if (this.mapId !== 'main') return this.groundFn ? this.groundFn(x, z) : 0;
    let h = 0;
    if (Math.abs(x) <= 11 && z >= -20 && z <= -4) {
      h = 0.9;
    } else if (Math.abs(x) <= 3.8 && z > -4 && z < -1.95) {
      // Bậc k (1..5) có tâm z = -4 + (5 - k) * 0.45
      const k = Math.min(5, Math.max(0, 5 - Math.round((z + 4) / 0.45)));
      h = 0.18 * k;
    }
    const d = Math.hypot(x - 18, z - 8);
    if (d < 4.6) h = Math.max(h, d < 4.05 ? 0.6 : (0.6 * (4.6 - d)) / 0.55);
    return h;
  }

  // ===================== KIỂM TRA VA CHẠM =====================
  public checkCollision(x: number, z: number, radius = 0.35): { allowed: boolean; height: number } {
    const groundHeight = this.getGroundHeight(x, z);
    const B = this.spec.bounds;
    if (this.mapId !== 'main' && (x < B.minX + radius || x > B.maxX - radius || z < B.minZ + radius || z > B.maxZ - radius)) {
      return { allowed: false, height: groundHeight };
    }

    for (const c of this.collisionCircles) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return { allowed: false, height: groundHeight };
    }

    for (const box of this.collisionBoxes) {
      const inX = x >= box.minX - radius && x <= box.maxX + radius;
      const inZ = z >= box.minZ - radius && z <= box.maxZ + radius;

      if (inX && inZ) {
        if (box.type === 'impassable') {
          return { allowed: false, height: groundHeight };
        }
      }
    }

    return { allowed: true, height: groundHeight };
  }
}
