import * as THREE from 'three';
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
import type { IncenseItem, FlowerItem, LanternItem, LeafPile } from '../types.js';
import { DEFAULT_THEME, type TempleTheme } from './themes.js';
import { DINING, traySlot, type TrayItem } from '../shared/dining.js';

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

// Mâm cơm chay: mâm gỗ tròn, bát cơm trắng, đĩa rau xanh, bát canh, đôi đũa
export function PlayerTrayMesh(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.6 });
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.035, 22), wood);
  tray.position.y = 0.018;
  g.add(tray);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 6, 22), wood);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.04;
  g.add(rim);
  const bowlGeo = new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const dishes: [number, number, number][] = [[-0.12, -0.05, 0xffffff], [0.12, -0.06, 0x16a34a], [0.0, 0.13, 0xf59e0b]];
  for (const [x, z, food] of dishes) {
    // Nửa dưới hình cầu = bát ngửa, miệng bát ở trên
    const bowl = new THREE.Mesh(bowlGeo, porcelain);
    bowl.position.set(x, 0.11, z);
    g.add(bowl);
    const fill = new THREE.Mesh(new THREE.SphereGeometry(0.066, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: food, roughness: 0.8 }));
    fill.scale.y = 0.45;
    fill.position.set(x, 0.1, z);
    g.add(fill);
  }
  const chop = new THREE.MeshStandardMaterial({ color: 0x3b2a1a });
  for (const dx of [-0.012, 0.012]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), chop);
    stick.rotation.z = Math.PI / 2;
    stick.rotation.y = 0.3;
    stick.position.set(0.02, 0.05, -0.2 + dx);
    g.add(stick);
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

  // Chiếu sáng & Bầu trời
  public sunLight: THREE.DirectionalLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;
  public nightLights: THREE.PointLight[] = [];
  public lanternsGlow: THREE.PointLight[] = [];
  // Vật liệu phát sáng (đèn đá, đèn lồng) sáng rực hơn về đêm
  private glowMaterials: THREE.MeshStandardMaterial[] = [];
  public isNight = false;

  private skyMesh: THREE.Mesh | null = null;
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private cloudsGroup: THREE.Group | null = null;
  private starsPoints: THREE.Points | null = null;
  private moonGroup: THREE.Group | null = null;
  private buddhaHalo: THREE.Mesh | null = null;

  // Khói hương tròn mờ
  private smokeSprites: THREE.Sprite[] = [];
  private smokeLifetimes: number[] = [];

  // Cánh hoa rơi
  private fallingPetals: THREE.InstancedMesh | null = null;
  private petalDummy = new THREE.Object3D();
  private petalCount = 450;
  private petalData: { x: number; y: number; z: number; rx: number; ry: number; speed: number; rotSpeed: number }[] = [];

  // Vật liệu đổi màu theo cảnh của phòng (mùa xuân, thu, đông...)
  private themeMats: Record<'mountains' | 'grass' | 'grassBlade' | 'blossom' | 'foliage' | 'treeFlower' | 'palm', THREE.MeshStandardMaterial[]> = {
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

  // Đống lá đa rụng trên sân (đồng bộ từ server)
  public leafLayer = new THREE.Group();
  private leafPiles = new Map<string, { data: LeafPile; group: THREE.Group; falling: number; sweptAt: number }>();
  private leafGeo: THREE.ShapeGeometry | null = null;
  private leafMats: THREE.MeshStandardMaterial[] = [];

  // Bụi cỏ & Hoa nhỏ InstancedMesh ngoài sân
  private grassMesh: THREE.InstancedMesh | null = null;

  private bellRingingTimer = 0;
  private drumBeatingTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildWorld();
    this.applyTheme(DEFAULT_THEME);
  }

  private buildWorld() {
    this.scene.add(this.lanternLayer);
    this.scene.add(this.leafLayer);
    this.setupLighting();
    this.buildSkyDome();
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
    this.setupSmokeAndPetals();
    this.enableShadows();
    this.buildDiningHall();
  }

  private enableShadows() {
    const worldPos = new THREE.Vector3();
    this.scene.updateMatrixWorld(true);
    this.scene.traverse(obj => {
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
      mesh.castShadow = true;
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
    this.scene.add(this.hemiLight);

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
    this.scene.add(this.sunLight);

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
        exponent: { value: 0.65 }
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
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.scene.add(this.skyMesh);

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
    this.scene.add(this.cloudsGroup);

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
    this.scene.add(sunSprite);

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
    this.scene.add(this.moonGroup);

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
    this.scene.add(this.starsPoints);
  }

  // ===================== 3. NÚI NON LOW-POLY HÒA VÀO SƯƠNG =====================
  private buildMountainRanges() {
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
        this.scene.add(mesh);
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
    this.scene.add(grassGround);

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
    this.scene.add(courtyard);

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
      this.scene.add(curb);
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
    this.scene.add(mainPath);

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
    this.scene.add(this.grassMesh);

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
  private createRoundCushion(x: number, z: number) {
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
    this.scene.add(group);
    this.cushionSpots.push({ x, z });
  }

  // Đèn đá chùa đích thực: đế cánh sen nở, thân trụ đá, lồng đèn tròn sáng vàng, mái chóp nón búp sen
  private createAuthenticStoneLantern(x: number, z: number) {
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
    this.scene.add(group);

    this.collisionBoxes.push({
      minX: x - 0.45,
      maxX: x + 0.45,
      minZ: z - 0.45,
      maxZ: z + 0.45,
      type: 'impassable'
    });
  }

  // Bệ đá cao với chậu men lam và cây cảnh hoa mai vàng rực rỡ / tán xanh (như trong ảnh mẫu)
  private createPedestalBonsai(x: number, z: number, type: 'yellow_blossom' | 'green_foliage') {
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
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), foliageMat);
      foliage.scale.set(1.2, 0.8, 1.2);
      foliage.position.set(0.08, 2.2, 0);
      foliage.castShadow = true;
      group.add(foliage);
    }

    group.position.set(x, 0, z);
    this.scene.add(group);

    this.collisionBoxes.push({
      minX: x - 0.45,
      maxX: x + 0.45,
      minZ: z - 0.45,
      maxZ: z + 0.45,
      type: 'impassable'
    });
  }

  // ===================== 5. LƯ HƯƠNG ĐỒNG LỚN (ĐỒNG #6b4a2b, KIM LOẠI 0.8) =====================
  private buildGrandBronzeUrn(x: number, z: number) {
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
    this.scene.add(this.incenseUrnGroup);

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
    this.scene.add(gate);

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

    this.scene.add(hall);

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
  private createHangingLantern(x: number, y: number, z: number, parent: THREE.Group) {
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
  private buildGoldenCraneOnTurtle(x: number, y: number, z: number, ry: number, parent: THREE.Group) {
    const group = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xdeb841,
      metalness: 0.85,
      roughness: 0.24
    });
    const bronzeDarkMat = new THREE.MeshStandardMaterial({
      color: 0x6e5228,
      metalness: 0.8,
      roughness: 0.35
    });

    // 1. Con rùa (Quy) nằm trên nền đá
    const turtle = new THREE.Group();
    const shellGeo = new THREE.SphereGeometry(0.7, 14, 10);
    const shell = new THREE.Mesh(shellGeo, bronzeDarkMat);
    shell.scale.set(0.85, 0.38, 1.25);
    shell.position.y = 0.22;
    turtle.add(shell);

    // Mai rùa viền gờ nổi
    const rimGeo = new THREE.TorusGeometry(0.68, 0.06, 8, 16);
    const rim = new THREE.Mesh(rimGeo, goldMat);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(0.9, 1.3, 1);
    rim.position.y = 0.18;
    turtle.add(rim);

    // Đầu rùa vươn dài ngẩng cao
    const tHead = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.38, 8), bronzeDarkMat);
    tHead.rotation.x = Math.PI / 3;
    tHead.position.set(0, 0.28, 0.88);
    turtle.add(tHead);

    const tSnout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), bronzeDarkMat);
    tSnout.rotation.x = Math.PI / 3;
    tSnout.position.set(0, 0.38, 1.02);
    turtle.add(tSnout);

    // 4 Chân rùa xòe bám sàn
    for (const [fx, fz] of [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.32), bronzeDarkMat);
      foot.position.set(fx, 0.06, fz);
      turtle.add(foot);
    }
    group.add(turtle);

    // 2. Chim Hạc vàng thanh mảnh đứng trên mai rùa
    const crane = new THREE.Group();
    crane.position.y = 0.38;

    // Đôi chân hạc khẳng khiu
    for (const legX of [-0.12, 0.12]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 1.2, 8), goldMat);
      leg.position.set(legX, 0.6, 0);
      crane.add(leg);

      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), goldMat);
      knee.position.set(legX, 0.65, 0);
      crane.add(knee);
    }

    // Thân chim hạc hình thoi thon gọn
    const craneBody = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), goldMat);
    craneBody.scale.set(0.65, 0.8, 1.3);
    craneBody.rotation.x = -Math.PI / 8;
    craneBody.position.set(0, 1.35, 0.05);
    craneBody.castShadow = true;
    crane.add(craneBody);

    // Hai cánh khép dọc thân với đường chạm lông vũ
    for (const wingSide of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.85), goldMat);
      wing.position.set(wingSide * 0.26, 1.32, 0.1);
      wing.rotation.x = -0.3;
      crane.add(wing);
    }

    // Cổ hạc dài uốn lượn chữ S tao nhã
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.45, 0.38),
      new THREE.Vector3(0, 1.85, 0.52),
      new THREE.Vector3(0, 2.25, 0.45),
      new THREE.Vector3(0, 2.55, 0.48)
    ]);
    const neckGeo = new THREE.TubeGeometry(neckCurve, 12, 0.055, 8, false);
    const neck = new THREE.Mesh(neckGeo, goldMat);
    crane.add(neck);

    // Đầu hạc và mỏ dài ngậm cành sen
    const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), goldMat);
    cHead.position.set(0, 2.55, 0.48);
    crane.add(cHead);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.48, 8), goldMat);
    beak.rotation.x = Math.PI / 2.3;
    beak.position.set(0, 2.52, 0.72);
    crane.add(beak);

    // Cành hoa sen ngậm trên mỏ hạc
    const lotusStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.65), goldMat);
    lotusStem.position.set(0, 2.68, 0.75);
    lotusStem.rotation.x = 0.4;
    crane.add(lotusStem);

    const lotusBud = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), goldMat);
    lotusBud.position.set(0, 2.96, 0.86);
    crane.add(lotusBud);

    group.add(crane);

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
  private buildAuthenticBuddhaAndAltar(parent: THREE.Group) {
    const altar = new THREE.Group();
    altar.position.set(0, 0.9, -14.5);

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

    // ĐÀI SEN 2 TẦNG CÁNH (Hồng nhạt viền vàng)
    const goldBuddhaMat = new THREE.MeshStandardMaterial({
      color: 0xd4a537,
      metalness: 0.85,
      roughness: 0.3
    });
    const lotusPetalMat = new THREE.MeshStandardMaterial({
      color: 0xfbcfe8, // Hồng cánh sen thanh khiết
      roughness: 0.5
    });

    const pedestal = new THREE.Group();
    pedestal.position.set(0, 1.2, -0.6);

    // Tầng đài sen 1 & 2
    for (const tier of [0, 1]) {
      const radius = 1.6 - tier * 0.25;
      const py = tier * 0.35;
      const count = 16 - tier * 2;

      for (let p = 0; p < count; p++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), lotusPetalMat);
        petal.scale.set(1.1, 0.45, 1.5);
        const a = (p * Math.PI * 2) / count + (tier * Math.PI) / count;
        petal.position.set(Math.cos(a) * radius, py + 0.15, Math.sin(a) * radius);
        petal.rotation.y = -a;
        petal.rotation.x = 0.35;
        pedestal.add(petal);
      }
    }
    altar.add(pedestal);

    // Đế đài sen: trụ tròn + mặt đài
    const pedestalBase = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 0.5, 32), goldBuddhaMat);
    pedestalBase.position.set(0, 1.45, -0.6);
    altar.add(pedestalBase);
    const pedestalTop = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.25, 0.18, 32), goldBuddhaMat);
    pedestalTop.position.set(0, 1.95, -0.6);
    altar.add(pedestalTop);

    // TƯỢNG PHẬT NGỒI KIẾT GIÀ, THỦ ẤN THIỀN ĐỊNH
    const buddha = new THREE.Group();
    buddha.position.set(0, 2.04, -0.6);

    // Nối 2 điểm bằng khối capsule (dùng cho tay)
    const limb = (from: THREE.Vector3, to: THREE.Vector3, r: number) => {
      const dir = new THREE.Vector3().subVectors(to, from);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, dir.length() - r), 6, 12), goldBuddhaMat);
      mesh.position.copy(from).add(to).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      buddha.add(mesh);
    };

    // 1. Chân xếp bằng: khối đùi nằm ngang rộng, hai bàn chân ngửa trên đùi
    const lap = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.35, 8, 20), goldBuddhaMat);
    lap.rotation.z = Math.PI / 2;
    lap.scale.set(1, 1, 1.45);
    lap.position.set(0, 0.36, 0.12);
    buddha.add(lap);
    for (const side of [-1, 1]) {
      const sole = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), goldBuddhaMat);
      sole.scale.set(1.3, 0.45, 0.8);
      sole.position.set(side * 0.42, 0.7, 0.42);
      sole.rotation.y = side * 0.5;
      buddha.add(sole);
    }

    // 2. Thân trên tiện tròn (Lathe), vai xuôi, ngực đầy đặn
    const torsoProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.78, 0.0),
      new THREE.Vector2(0.82, 0.35),
      new THREE.Vector2(0.74, 0.95),
      new THREE.Vector2(0.7, 1.32),
      new THREE.Vector2(0.55, 1.58),
      new THREE.Vector2(0.26, 1.7),
      new THREE.Vector2(0.0, 1.72)
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 32), goldBuddhaMat);
    torso.scale.set(1, 1, 0.68);
    torso.position.y = 0.42;
    buddha.add(torso);

    // Nếp y cà sa vắt chéo ngực
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 8, 32), goldBuddhaMat);
    sash.scale.set(1, 1, 0.72);
    sash.rotation.set(Math.PI / 2.4, 0, -0.55);
    sash.position.set(0.05, 1.35, 0.02);
    buddha.add(sash);

    // 3. Hai tay: vai -> khuỷu -> bàn tay chồng lên nhau trong lòng (thiền định ấn)
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Vector3(side * 0.66, 1.88, 0.0);
      const elbow = new THREE.Vector3(side * 0.82, 1.1, 0.22);
      const wrist = new THREE.Vector3(side * 0.24, 0.84, 0.58);
      limb(shoulder, elbow, 0.19);
      limb(elbow, wrist, 0.15);
    }
    const hands = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), goldBuddhaMat);
    hands.scale.set(1.1, 0.4, 0.75);
    hands.position.set(0, 0.84, 0.6);
    buddha.add(hands);

    // 4. Cổ, đầu, tóc xoắn ốc, nhục kế, tai dài
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 16), goldBuddhaMat);
    neck.position.y = 2.22;
    buddha.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), goldBuddhaMat);
    head.scale.set(0.92, 1.06, 0.95);
    head.position.y = 2.66;
    buddha.add(head);

    const curlCount = 90;
    const curls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5), goldBuddhaMat, curlCount);
    const curlDummy = new THREE.Object3D();
    for (let i = 0; i < curlCount; i++) {
      // Phân bố đều trên chỏm đầu (bán cầu trên, lệch về phía sau trán)
      const yN = 0.25 + (i / curlCount) * 0.75;
      const ring = Math.sqrt(1 - yN * yN);
      const a = i * 2.39996;
      curlDummy.position.set(Math.cos(a) * ring * 0.47, 2.68 + yN * 0.52, Math.sin(a) * ring * 0.47 - 0.02);
      curlDummy.updateMatrix();
      curls.setMatrixAt(i, curlDummy.matrix);
    }
    buddha.add(curls);

    const ushnisha = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), goldBuddhaMat);
    ushnisha.position.y = 3.2;
    buddha.add(ushnisha);
    const jewel = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 10), goldBuddhaMat);
    jewel.position.y = 3.46;
    buddha.add(jewel);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), goldBuddhaMat);
      ear.position.set(side * 0.47, 2.52, 0.0);
      ear.scale.set(0.7, 1, 1);
      buddha.add(ear);
    }

    // Nét mặt: mắt khép hờ, chấm bạch hào giữa trán, môi mỉm cười
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x5c3b12, roughness: 0.6, metalness: 0.3 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.013, 6, 12, Math.PI), faceMat);
      eye.position.set(side * 0.17, 2.68, 0.44);
      eye.rotation.z = Math.PI;
      buddha.add(eye);
    }
    const urna = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), faceMat);
    urna.position.set(0, 2.84, 0.46);
    buddha.add(urna);
    const lips = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), faceMat);
    lips.position.set(0, 2.44, 0.45);
    lips.rotation.z = Math.PI;
    buddha.add(lips);

    // 5. HÀO QUANG: vầng đầu + vầng thân (texture tia sáng, phát sáng cộng màu)
    const haloTex = createHaloTexture();
    const headHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 2.9),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })
    );
    headHalo.position.set(0, 2.72, -0.55);
    buddha.add(headHalo);
    this.buddhaHalo = headHalo;

    const bodyHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 4.6),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 })
    );
    bodyHalo.position.set(0, 1.45, -0.6);
    buddha.add(bodyHalo);

    // Vành hào quang chạm vàng phía sau
    const haloRim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 8, 64), goldBuddhaMat);
    haloRim.position.set(0, 2.72, -0.58);
    buddha.add(haloRim);

    const haloLight = new THREE.PointLight(0xffd54f, 1.6, 9);
    haloLight.position.set(0, 2.4, 1.2);
    buddha.add(haloLight);

    altar.add(buddha);
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

    this.scene.add(pavilion);

    // Trống bát nhã giữa lầu (trục trống nằm theo trục z)
    this.collisionBoxes.push({ minX: 16.9, maxX: 19.1, minZ: 7.2, maxZ: 8.8, type: 'impassable' });
  }

  // ===================== 10. HỒ SEN, CÁ KOI & TƯỢNG QUAN ÂM BẠCH NGỌC =====================
  private buildLotusPond() {
    const pond = new THREE.Group();
    pond.position.set(-18, 0, 24);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 7.5, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x1d5d6e, roughness: 0.1, metalness: 0.65, transparent: true, opacity: 0.88 })
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
    this.scene.add(pond);

    this.collisionCircles.push({ x: -18, z: 24, r: 8.4 });
  }

  // Tượng Quan Âm bạch ngọc (dùng cho hòn non bộ giữa hồ và tượng lộ thiên)
  private makeQuanAmFigure(): THREE.Group {
    const whiteJadeMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.35, metalness: 0.05 });
    const quanAmGroup = new THREE.Group();
    quanAmGroup.position.y = 1.1;

    // Đài sen
    for (let i = 0; i < 12; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), whiteJadeMat);
      petal.scale.set(0.8, 0.5, 1.4);
      const a = (i / 12) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
      petal.rotation.y = -a;
      quanAmGroup.add(petal);
    }

    // Thân áo dài buông chấm chân
    const robeProfile = [
      new THREE.Vector2(0.0, 0.12),
      new THREE.Vector2(0.5, 0.12),
      new THREE.Vector2(0.44, 0.6),
      new THREE.Vector2(0.34, 1.2),
      new THREE.Vector2(0.36, 1.6),
      new THREE.Vector2(0.4, 1.85),
      new THREE.Vector2(0.24, 2.05),
      new THREE.Vector2(0.1, 2.12),
      new THREE.Vector2(0.0, 2.12)
    ];
    const qaRobe = new THREE.Mesh(new THREE.LatheGeometry(robeProfile, 28), whiteJadeMat);
    qaRobe.scale.z = 0.75;
    quanAmGroup.add(qaRobe);

    // Đầu + khăn choàng trùm đầu buông xuống vai
    const qaHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), whiteJadeMat);
    qaHead.position.y = 2.32;
    quanAmGroup.add(qaHead);
    const veil = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      whiteJadeMat
    );
    veil.position.set(0, 2.35, -0.03);
    veil.rotation.x = -0.25;
    quanAmGroup.add(veil);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 10), whiteJadeMat);
    crown.position.y = 2.62;
    quanAmGroup.add(crown);

    // Tay trái ôm tịnh bình trước ngực, tay phải cầm cành dương liễu
    const qaVase = new THREE.Mesh(
      new THREE.LatheGeometry([
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.07, 0.02),
        new THREE.Vector2(0.09, 0.12),
        new THREE.Vector2(0.04, 0.22),
        new THREE.Vector2(0.03, 0.3),
        new THREE.Vector2(0.05, 0.33)
      ], 14),
      whiteJadeMat
    );
    qaVase.position.set(0.14, 1.45, 0.3);
    quanAmGroup.add(qaVase);
    const willow = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.16, 1.5, 0.3),
        new THREE.Vector3(-0.2, 1.75, 0.35),
        new THREE.Vector3(-0.32, 1.9, 0.38)
      ]), 8, 0.012, 5, false),
      new THREE.MeshStandardMaterial({ color: 0x4d7c0f })
    );
    quanAmGroup.add(willow);
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.45, 4, 10), whiteJadeMat);
      sleeve.position.set(side * 0.28, 1.6, 0.18);
      sleeve.rotation.x = -0.9;
      sleeve.rotation.z = side * 0.25;
      quanAmGroup.add(sleeve);
    }

    // Hào quang sau đầu
    const qaHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshBasicMaterial({ map: createHaloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 })
    );
    qaHalo.position.set(0, 2.38, -0.28);
    quanAmGroup.add(qaHalo);

    // Tượng nhìn ra phía lối đi chính
    quanAmGroup.rotation.y = Math.PI / 2;

    return quanAmGroup;
  }

  // ===================== 11. CÂY BỒ ĐỀ LỚN & VÒNG GHẾ ĐÁ (GÓC TRÁI NHƯ TRONG ẢNH MẪU) =====================
  private buildBodhiTree() {
    const tree = new THREE.Group();
    tree.position.set(-18, 0, 14);

    const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.95 });

    // Thân cây bồ đề nhiều nhánh
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 5.5, 12), barkMat);
    trunk.position.y = 2.75;
    trunk.castShadow = true;
    tree.add(trunk);

    // Rễ phụ buông rủ
    for (let r = 0; r < 6; r++) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 4.2, 6), barkMat);
      const ra = (r * Math.PI * 2) / 6;
      root.position.set(Math.cos(ra) * 1.65, 2.1, Math.sin(ra) * 1.65);
      tree.add(root);
    }

    // Tán lá bồ đề đa tầng gồm các khối icosahedron xanh lá nhiều sắc độ (flatShading)
    const leafColors = [0x2d6a4f, 0x40916c, 0x52b788, 0x1b4332];
    const crownClusters = [
      { x: 0, y: 6.2, z: 0, s: 4.2, c: 0 },
      { x: -2.2, y: 5.6, z: -1.5, s: 3.2, c: 1 },
      { x: 2.2, y: 5.8, z: 1.2, s: 3.4, c: 2 },
      { x: -1.4, y: 5.8, z: 1.8, s: 3.1, c: 3 },
      { x: 1.6, y: 5.4, z: -2.0, s: 3.0, c: 0 }
    ];

    for (const c of crownClusters) {
      const foliageMat = new THREE.MeshStandardMaterial({
        color: leafColors[c.c],
        roughness: 0.85,
        flatShading: true
      });
      this.themeMats.foliage.push(foliageMat);
      const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(c.s, 1), foliageMat);
      foliage.position.set(c.x, c.y, c.z);
      foliage.castShadow = true;
      tree.add(foliage);
    }

    // Ghế đá tròn vòng quanh gốc bồ đề
    const bench = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.28, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 })
    );
    bench.rotation.x = Math.PI / 2;
    bench.position.y = 0.35;
    tree.add(bench);

    this.scene.add(tree);

    this.collisionCircles.push({ x: -18, z: 14, r: 3.1 });
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

      const bonsaiFoliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 1), foliageMat);
      bonsaiFoliage.position.set(0.08, 0.82, 0.05);
      potGroup.add(bonsaiFoliage);

      potGroup.position.set(pos.x, 0, pos.z);
      this.scene.add(potGroup);

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

      const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), plumeriaLeafMat);
      foliage.position.set(0.1, 3.4, 0.1);
      foliage.scale.set(1.4, 0.85, 1.4);
      foliage.castShadow = true;
      tree.add(foliage);

      for (let f = 0; f < 5; f++) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), plumeriaFlowerMat);
        const fa = (f * Math.PI * 2) / 5;
        flower.position.set(Math.cos(fa) * 1.3, 3.5 + Math.sin(fa) * 0.2, Math.sin(fa) * 1.3);
        tree.add(flower);
      }

      tree.position.set(tc.x, 0, tc.z);
      this.scene.add(tree);

      this.collisionBoxes.push({ minX: tc.x - 0.6, maxX: tc.x + 0.6, minZ: tc.z - 0.6, maxZ: tc.z + 0.6, type: 'impassable' });
    }
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
      this.scene.add(group);

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
    this.scene.add(palm);
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
      this.scene.add(sp);
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
      this.petalData.push({
        x: (Math.random() - 0.5) * 60,
        y: 1.5 + Math.random() * 12,
        z: (Math.random() - 0.5) * 60,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        speed: 0.6 + Math.random() * 0.5,
        rotSpeed: 0.8 + Math.random() * 1.2
      });
    }
    this.scene.add(this.fallingPetals);
  }

  // ===================== CHẾ ĐỘ NGÀY / ĐÊM =====================
  public setDayNight(night: boolean) {
    this.isNight = night;
    if (!this.sunLight || !this.hemiLight || !this.skyMaterial) return;

    if (night) {
      // Đêm trăng: gradient #0b1026 -> #2a2f5a
      this.skyMaterial.uniforms.topColor.value.setHex(0x0b1026);
      this.skyMaterial.uniforms.bottomColor.value.setHex(0x2a2f5a);

      this.sunLight.color.setHex(0x5c7cfa);
      this.sunLight.intensity = 0.5;
      this.sunLight.position.set(-35, 30, -35);

      this.hemiLight.color.setHex(0x2a2f5a);
      this.hemiLight.groundColor.setHex(0x0a101d);
      this.hemiLight.intensity = 0.45;
      this.scene.environmentIntensity = 0.12;
      this.scene.fog = new THREE.Fog(0x161c36, Math.min(60, this.theme.fog.near), Math.min(300, this.theme.fog.far));

      if (this.starsPoints) this.starsPoints.visible = true;
      if (this.moonGroup) this.moonGroup.visible = true;

      // Đèn lồng, đèn đá, nến chuyển sang emissive ấm (#ffb347), tăng sáng
      for (const pl of this.nightLights) pl.intensity = 1.8;
      for (const pl of this.lanternsGlow) pl.intensity = 1.4;
      for (const m of this.glowMaterials) m.emissiveIntensity = 2.4;
    } else {
      // Ban ngày: màu trời, nắng, sương theo cảnh của phòng
      const th = this.theme;
      this.skyMaterial.uniforms.topColor.value.setHex(th.sky.top);
      this.skyMaterial.uniforms.bottomColor.value.setHex(th.sky.bottom);

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

      for (const pl of this.nightLights) pl.intensity = 0.3;
      for (const pl of this.lanternsGlow) pl.intensity = 0.15;
      for (const m of this.glowMaterials) m.emissiveIntensity = 0.5;
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
      const glow = pt.kind === 'firefly' ? 1.4 : pt.kind === 'snow' ? 0.35 : 0;
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
    const stove = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x3f3a36, roughness: 0.9 }));
    stove.position.set(25, 1.16, 22.2);
    hall.add(stove);
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
    fire.position.set(25, 1.32, 22.2);
    hall.add(fire);
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze);
    pot.rotation.x = Math.PI;
    pot.position.set(25, 1.72, 22.2);
    hall.add(pot);
    const potLid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.06, 20), bronze);
    potLid.position.set(25, 1.75, 22.2);
    hall.add(potLid);
    const fireLight = new THREE.PointLight(0xff8a3a, 1.2, 6);
    fireLight.position.set(24.5, 1.6, 22.2);
    hall.add(fireLight);
    // Nồi canh thứ hai
    const pot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.38, 18), bronze);
    pot2.position.set(25, 1.2, 24.4);
    hall.add(pot2);

    // Hơi nước bốc lên từ nồi
    const steamTex = getSmokeSpriteTexture();
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      sp.userData.phase = i / 10;
      sp.userData.base = i % 2 === 0 ? new THREE.Vector3(25, 1.8, 22.2) : new THREE.Vector3(25, 1.42, 24.4);
      this.steamSprites.push(sp);
      hall.add(sp);
    }

    // Chồng mâm gỗ trên quầy
    for (let i = 0; i < 4; i++) {
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.04, 20), darkWood);
      tray.position.set(24.75, 1.03 + i * 0.045, 26.2);
      hall.add(tray);
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
    this.scene.add(hall);
    this.cameraBlockers.push(...blockers);
    this.scene.add(this.trayLayer);
  }

  // Ẩn mái nhà ăn khi người chơi đang ở trong để nhìn thấy bên trong
  public updateInterior(x: number, z: number) {
    if (!this.diningRoof) return;
    const D = DINING;
    const inside = x > D.minX && x < D.maxX && z > D.minZ && z < D.maxZ;
    this.diningRoof.visible = !inside;
  }

  public isInsideDining(x: number, z: number) {
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
      const g = PlayerTrayMesh();
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
    this.scene.add(group);
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
      this.scene.add(group);
      group.scale.setScalar(animate ? 0.01 : 1);
      this.builtProjects.set(id, { group, grow: animate ? 0 : 1 });
    }
  }

  // Bảo tháp 5 tầng mái cong
  private buildPagoda(x: number, z: number): THREE.Group {
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
    for (let tier = 0; tier < 5; tier++) {
      const w = 3.0 - tier * 0.42;
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
      new THREE.MeshStandardMaterial({ color: 0x1d5d6e, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.88 })
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
  public syncObjects(incenseList: IncenseItem[], flowerList: FlowerItem[], lanternList: LanternItem[]) {
    const currentIncenseIds = new Set(incenseList.map(i => i.id));
    for (const [id, mesh] of this.incenseMeshMap.entries()) {
      if (!currentIncenseIds.has(id)) {
        this.scene.remove(mesh);
        this.incenseMeshMap.delete(id);
      }
    }
    for (const item of incenseList) {
      if (!this.incenseMeshMap.has(item.id)) {
        const mesh = this.createIncenseStickMesh(item.x, item.y, item.z);
        this.scene.add(mesh);
        this.incenseMeshMap.set(item.id, mesh);
      }
    }

    const currentFlowerIds = new Set(flowerList.map(f => f.id));
    for (const [id, mesh] of this.flowerMeshMap.entries()) {
      if (!currentFlowerIds.has(id)) {
        this.scene.remove(mesh);
        this.flowerMeshMap.delete(id);
      }
    }
    for (const item of flowerList) {
      if (!this.flowerMeshMap.has(item.id)) {
        const mesh = this.createAltarLotusMesh(item.x, item.y, item.z);
        this.scene.add(mesh);
        this.flowerMeshMap.set(item.id, mesh);
      }
    }

    const currentLanternIds = new Set(lanternList.map(l => l.id));
    for (const [id, mesh] of this.lanternMeshMap.entries()) {
      if (!currentLanternIds.has(id)) {
        this.lanternLayer.remove(mesh);
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

  private createIncenseStickMesh(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
    const glowMat = new THREE.SpriteMaterial({
      map: getSmokeSpriteTexture(),
      color: 0xff7a2a,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    // Bó 3 nén hương hơi xòe ra
    for (let i = 0; i < 3; i++) {
      const stick = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 5), stickMat);
      body.position.y = 0.31;
      stick.add(body);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), handleMat);
      handle.position.y = -0.05;
      stick.add(handle);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), tipMat);
      tip.position.y = 0.63;
      stick.add(tip);
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(0.12, 0.12, 1);
      glow.position.y = 0.63;
      stick.add(glow);

      stick.position.x = (i - 1) * 0.03;
      stick.rotation.z = (i - 1) * 0.12;
      group.add(stick);
    }
    group.rotation.y = Math.random() * Math.PI;
    group.position.set(x, y, z);
    return group;
  }

  private createAltarLotusMesh(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });
    const centerMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });

    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), centerMat);
    group.add(center);

    for (let p = 0; p < 8; p++) {
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), petalMat);
      const pa = (p * Math.PI * 2) / 8;
      petal.position.set(Math.cos(pa) * 0.12, 0.08, Math.sin(pa) * 0.12);
      petal.rotation.z = Math.cos(pa) * 0.4;
      petal.rotation.x = Math.sin(pa) * -0.4;
      group.add(petal);
    }
    group.position.set(x, y, z);
    return group;
  }

  private createFloatingLanternMesh(item: LanternItem): THREE.Group {
    const group = new THREE.Group();
    group.userData = { lanternData: item };

    const petalOuter = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.55, emissive: 0xf472b6, emissiveIntensity: 0.25 });
    const petalInner = new THREE.MeshStandardMaterial({ color: 0xfce7f3, roughness: 0.5, emissive: 0xfbcfe8, emissiveIntensity: 0.35 });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.2, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.8 })
    );
    group.add(base);

    // 2 tầng cánh sen
    for (const [count, radius, tilt, mat, h] of [[8, 0.2, 0.55, petalOuter, 0.1], [6, 0.11, 0.3, petalInner, 0.14]] as const) {
      for (let i = 0; i < count; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat);
        petal.scale.set(0.7, 1.4, 0.35);
        const a = (i / count) * Math.PI * 2;
        petal.position.set(Math.cos(a) * radius, h, Math.sin(a) * radius);
        petal.rotation.y = -a + Math.PI / 2;
        petal.rotation.x = tilt;
        petal.rotation.order = 'YXZ';
        group.add(petal);
      }
    }

    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xfff7ed }));
    candle.position.y = 0.16;
    group.add(candle);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), new THREE.MeshBasicMaterial({ color: 0xffc14d }));
    flame.position.y = 0.28;
    group.add(flame);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSmokeSpriteTexture(),
      color: 0xffa94d,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.9
    }));
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
        1.75 + lt * 4.2,
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
        if (kind === 'firefly') {
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

        if (p.y < 0.1) {
          p.y = 11 + Math.random() * 4;
          p.x = (Math.random() - 0.5) * 70;
          p.z = (Math.random() - 0.5) * 70 + 5;
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
      (this.buddhaHalo.material as THREE.MeshBasicMaterial).opacity = 0.8 + Math.sin(elapsed * 1.6) * 0.15;
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
