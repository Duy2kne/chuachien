import * as THREE from 'three';
import {
  getCourtyardStoneTexture,
  getMainPathTexture,
  getVietnameseCurvedRoofTexture,
  getLacqueredWoodTexture,
  getSmokeSpriteTexture,
  createPlaqueTexture,
  createBonsaiPotTexture
} from './proceduralTextures.js';
import type { IncenseItem, FlowerItem, LanternItem } from '../types.js';

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
// Mặt mái võng xuống: y = h * (0.35t + 0.65t^2)
// 4 góc mái vểnh cong lên (đầu đao): elevation = curl * (|u|*|v|)^4 * (1 - t)^2.5
// =========================================================================
export function makeCurvedRoofGeometry(
  width: number,
  depth: number,
  height: number,
  curl = 1.45,
  segments = 24
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const ridgeW = width * 0.35; // Bờ nóc thu nhỏ ở giữa
  const ridgeD = depth * 0.08;

  const rows = segments;
  const cols = segments;

  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 ở diềm mái, 1 ở bờ nóc
    // Mặt mái võng xuống theo công thức parabol
    const baseY = height * (0.35 * t + 0.65 * (t * t));

    // Kích thước thu dần lên nóc
    const currentW = halfW * (1 - t) + ridgeW * t;
    const currentD = halfD * (1 - t) + ridgeD * t;

    for (let c = 0; c <= cols; c++) {
      const uFrac = c / cols; // 0 -> 1
      const u = (uFrac - 0.5) * 2; // -1 -> 1
      const v = (t - 0.5) * 2;

      const x = u * currentW;
      const z = (uFrac < 0.5 ? -1 : 1) * Math.sin(uFrac * Math.PI) * currentD;

      // Độ cong vểnh đầu đao ở 4 góc: curl * (|u|*|v|)^4 * (1 - t)^2.5
      const cornerFactor = Math.pow(Math.abs(u), 4) * Math.pow(1 - t, 2.5);
      const curlElevation = curl * cornerFactor;

      const y = baseY + curlElevation;

      positions.push(x, y, (c / cols - 0.5) * currentD * 2);
      uvs.push(uFrac * 4, t * 4);
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

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

export class TempleWorld {
  public scene: THREE.Scene;
  public collisionBoxes: CollisionBox[] = [];

  // Tương tác
  public bellMesh: THREE.Group | null = null;
  public strikerMesh: THREE.Group | null = null;
  public drumMesh: THREE.Group | null = null;
  public incenseUrnGroup: THREE.Group | null = null;
  public altarGroup: THREE.Group | null = null;
  public pondGroup: THREE.Group | null = null;

  // Đồ vật đồng bộ
  private incenseMeshMap = new Map<string, THREE.Group>();
  private flowerMeshMap = new Map<string, THREE.Group>();
  private lanternMeshMap = new Map<string, THREE.Group>();

  // Chiếu sáng & Bầu trời
  public sunLight: THREE.DirectionalLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;
  public nightLights: THREE.PointLight[] = [];
  public lanternsGlow: THREE.PointLight[] = [];
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
  private petalCount = 150;
  private petalData: { x: number; y: number; z: number; rx: number; ry: number; speed: number; rotSpeed: number }[] = [];

  // Bụi cỏ & Hoa nhỏ InstancedMesh ngoài sân
  private grassMesh: THREE.InstancedMesh | null = null;

  private bellRingingTimer = 0;
  private drumBeatingTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildWorld();
  }

  private buildWorld() {
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
    this.setupSmokeAndPetals();
  }

  // ===================== 1. ÁNH SÁNG BAN NGÀY & ĐÊM =====================
  private setupLighting() {
    // HemisphereLight: trời #fff1d6, đất #7a6a4a, cường độ 0.9
    this.hemiLight = new THREE.HemisphereLight(0xfff1d6, 0x7a6a4a, 0.9);
    this.scene.add(this.hemiLight);

    // DirectionalLight: nắng chiều vàng ấm #ffd9a0, cường độ 2.5, từ góc thấp phía tây để tạo bóng dài
    this.sunLight = new THREE.DirectionalLight(0xffd9a0, 2.5);
    this.sunLight.position.set(45, 28, 38);
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
    this.scene.fog = new THREE.Fog(0xffe3b3, 60, 250);
  }

  // ===================== 2. BẦU TRỜI GRADIENT (SHADER MATERIAL) =====================
  private buildSkyDome() {
    const skyGeo = new THREE.SphereGeometry(240, 32, 16);
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x6fa8dc) },    // Xanh thiên thanh
        bottomColor: { value: new THREE.Color(0xffe3b3) }, // Vàng hoàng hôn chân trời
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
    sunSprite.position.set(80, 50, 70);
    sunSprite.scale.set(30, 30, 1);
    this.scene.add(sunSprite);

    // Mặt trăng rằm và ngàn sao ban đêm
    this.moonGroup = new THREE.Group();
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfffae6 })
    );
    this.moonGroup.add(moonMesh);

    // Hào quang trăng
    const moonAura = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: 0xc7d2fe, depthWrite: false }));
    moonAura.scale.set(24, 24, 1);
    this.moonGroup.add(moonAura);

    this.moonGroup.position.set(-60, 75, -90);
    this.moonGroup.visible = false;
    this.scene.add(this.moonGroup);

    // 800 Ngôi sao trên bầu trời đêm
    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45; // Nửa cầu trên
      const r = 230;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) + 15;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85 })
    );
    this.starsPoints.visible = false;
    this.scene.add(this.starsPoints);
  }

  // ===================== 3. NÚI NON LOW-POLY HÒA VÀO SƯƠNG =====================
  private buildMountainRanges() {
    // 3 Lớp đồi núi low-poly nhấp nhô ở xa (150-240 đơn vị), flatShading, xanh nhạt dần
    const layers = [
      { dist: 160, count: 9, baseRadius: 28, height: 35, color: 0x7d9a8a, yOff: 10 },
      { dist: 195, count: 11, baseRadius: 36, height: 48, color: 0x8daab3, yOff: 14 },
      { dist: 230, count: 12, baseRadius: 45, height: 62, color: 0xa9bccb, yOff: 18 }
    ];

    for (const lyr of layers) {
      const mat = new THREE.MeshStandardMaterial({
        color: lyr.color,
        roughness: 0.95,
        flatShading: true
      });

      for (let i = 0; i < lyr.count; i++) {
        // Phân bố núi vòng quanh phía Bắc, Đông và Tây
        const angle = -Math.PI * 0.85 + (i / (lyr.count - 1)) * Math.PI * 1.7;
        const x = Math.sin(angle) * lyr.dist + (Math.random() - 0.5) * 15;
        const z = -Math.cos(angle) * lyr.dist - 30 + (Math.random() - 0.5) * 15;

        const cone = new THREE.ConeGeometry(
          lyr.baseRadius * (0.8 + Math.random() * 0.4),
          lyr.height * (0.85 + Math.random() * 0.35),
          7
        );

        // Nhiễu đỉnh low-poly tự nhiên
        const pos = cone.attributes.position;
        for (let v = 0; v < pos.count; v++) {
          if (pos.getY(v) > 2) {
            pos.setX(v, pos.getX(v) + (Math.random() - 0.5) * 4);
            pos.setZ(v, pos.getZ(v) + (Math.random() - 0.5) * 4);
          }
        }
        cone.computeVertexNormals();

        const mesh = new THREE.Mesh(cone, mat);
        mesh.position.set(x, lyr.yOff + lyr.height * 0.35, z);
        this.scene.add(mesh);
      }
    }
  }

  // ===================== 4. MẶT ĐẤT, SÂN CHÙA & BỤI CỎ INSTANCED =====================
  private buildGroundAndFlora() {
    // 1. Mặt cỏ xanh (#6f9a4a) rộng lớn bao bọc
    const grassGroundGeo = new THREE.PlaneGeometry(280, 280, 16, 16);
    const grassGroundMat = new THREE.MeshStandardMaterial({
      color: 0x6f9a4a,
      roughness: 0.92,
      metalness: 0.05
    });
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
    const geo = new THREE.CylinderGeometry(0.52, 0.54, 0.13, 20);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdeb841, // Vàng nghệ thiền sáng ấm
      roughness: 0.82
    });
    const cushion = new THREE.Mesh(geo, mat);
    cushion.position.y = 0.065;
    cushion.receiveShadow = true;
    group.add(cushion);

    // Điểm nhấn rốn bồ đoàn ở tâm
    const button = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 })
    );
    button.position.y = 0.135;
    group.add(button);

    // Đường gờ viền may bo tròn
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.51, 0.025, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xc49b28, roughness: 0.85 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.13;
    group.add(rim);

    group.position.set(x, 0, z);
    this.scene.add(group);
  }

  // Đèn đá chùa đích thực: đế cánh sen nở, thân trụ đá, lồng đèn tròn sáng vàng, mái chóp nón búp sen
  private createAuthenticStoneLantern(x: number, z: number) {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af, // Xám đá tự nhiên
      roughness: 0.88
    });

    // 1. Đế đá 2 tầng có cánh sen nở
    const baseLow = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.18, 16), stoneMat);
    baseLow.position.y = 0.09;
    group.add(baseLow);

    // Bệ sen nở ở chân đế
    for (let p = 0; p < 8; p++) {
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 5), stoneMat);
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

    // Ánh sáng phát ra
    const pLight = new THREE.PointLight(0xffb74d, 0.4, 8);
    pLight.position.set(0, 1.6, 0);
    group.add(pLight);
    this.nightLights.push(pLight);

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
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85 });
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

    // Thân lư tròn phình bụng
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), bronzeMat);
    body.position.y = 1.05;
    body.scale.set(1.15, 0.9, 1.15);
    body.castShadow = true;
    this.incenseUrnGroup.add(body);

    // Cổ và miệng lư hương loe rộng
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.1, 0.45, 24), bronzeMat);
    neck.position.y = 1.45;
    this.incenseUrnGroup.add(neck);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.1, 8, 24), bronzeMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.68;
    this.incenseUrnGroup.add(rim);

    // Hai quai rồng uốn lượn hai bên sườn
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 8, 16, Math.PI * 1.2), bronzeMat);
      handle.rotation.y = Math.PI / 2;
      handle.rotation.z = side * (Math.PI / 2.2);
      handle.position.set(side * 1.25, 1.2, 0);
      this.incenseUrnGroup.add(handle);
    }

    // Lòng tro cát cắm hương
    const ash = new THREE.Mesh(
      new THREE.CylinderGeometry(0.96, 0.96, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0x948e85, roughness: 1.0 })
    );
    ash.position.y = 1.58;
    this.incenseUrnGroup.add(ash);

    // Đốm lửa than hồng le lói
    const emberLight = new THREE.PointLight(0xff5511, 0.6, 3.5);
    emberLight.position.set(0, 1.7, 0);
    this.incenseUrnGroup.add(emberLight);

    this.incenseUrnGroup.position.set(x, 0, z);
    this.scene.add(this.incenseUrnGroup);

    this.collisionBoxes.push({
      minX: x - 1.3,
      maxX: x + 1.3,
      minZ: z - 1.3,
      maxZ: z + 1.3,
      type: 'impassable'
    });
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
    const gateRoofGeo = makeCurvedRoofGeometry(15.2, 4.2, 1.8, 1.6);
    const gateRoof = new THREE.Mesh(gateRoofGeo, roofMat);
    gateRoof.position.set(0, 5.8, 0);
    gateRoof.castShadow = true;
    gate.add(gateRoof);

    // Bờ nóc viền vàng kim
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.35, 0.4), new THREE.MeshStandardMaterial({ color: 0xdeb841 }));
    ridge.position.set(0, 7.6, 0);
    gate.add(ridge);

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
    const lowerRoofGeo = makeCurvedRoofGeometry(26.5, 20.5, 2.6, 1.8);
    const lowerRoof = new THREE.Mesh(lowerRoofGeo, roofMat);
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
    const upperRoofGeo = makeCurvedRoofGeometry(20.0, 15.5, 2.8, 2.2);
    const upperRoof = new THREE.Mesh(upperRoofGeo, roofMat);
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
      { minX: -11, maxX: 11, minZ: -20, maxZ: -4, type: 'step', height: 0.9 },
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

    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.35), new THREE.MeshBasicMaterial({ color: 0xffd54f }));
    tassel.position.y = -1.15;
    group.add(tassel);

    const light = new THREE.PointLight(0xff5511, 0.2, 5);
    light.position.y = -0.7;
    group.add(light);
    this.lanternsGlow.push(light);

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

    // TƯỢNG PHẬT NGỒI KIẾT GIÀ (Thân tượng cao ~4.5m uy nghi)
    const buddha = new THREE.Group();
    buddha.position.set(0, 2.0, -0.6);

    // 1. Chân xếp bằng kiết già (Capsule/Torus nằm ngang vững chãi)
    const lapGeo = new THREE.TorusGeometry(0.95, 0.35, 12, 24, Math.PI);
    const lap = new THREE.Mesh(lapGeo, goldBuddhaMat);
    lap.rotation.x = Math.PI / 2;
    lap.position.y = 0.3;
    buddha.add(lap);

    // Bàn chân lộ diện đặt ngửa lên đùi
    for (const side of [-1, 1]) {
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.22), goldBuddhaMat);
      sole.position.set(side * 0.45, 0.4, 0.4);
      sole.rotation.x = 0.2;
      buddha.add(sole);
    }

    // 2. Thân trên trang nghiêm khoác áo cà sa
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.9, 1.6, 16), goldBuddhaMat);
    torso.position.y = 1.15;
    buddha.add(torso);

    // Dải y cà sa vắt chéo qua vai trái
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 8, 20), goldBuddhaMat);
    sash.rotation.x = Math.PI / 3;
    sash.rotation.y = Math.PI / 6;
    sash.position.y = 1.35;
    buddha.add(sash);

    // 3. Hai cánh tay và bàn tay đặt trong lòng (Thủ ấn thiền định - Dhyana mudra)
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9), goldBuddhaMat);
      arm.position.set(side * 0.72, 1.1, 0.15);
      arm.rotation.z = side * 0.45;
      arm.rotation.x = 0.35;
      buddha.add(arm);
    }

    // Hai bàn tay đan đặt ngửa trong lòng
    const hands = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.32), goldBuddhaMat);
    hands.position.set(0, 0.58, 0.52);
    buddha.add(hands);

    // 4. Đầu tượng, búi tóc nhục kế (Ushnisha) và tai dài
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 18), goldBuddhaMat);
    head.position.y = 2.25;
    buddha.add(head);

    // Nhục kế trên đỉnh đầu
    const ushnisha = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), goldBuddhaMat);
    ushnisha.position.y = 2.82;
    buddha.add(ushnisha);

    // Nốt tóc xoắn nhỏ trên đầu
    for (let i = 0; i < 28; i++) {
      const curlNode = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), goldBuddhaMat);
      const ca = (i * Math.PI * 2) / 14;
      const cr = i < 14 ? 0.45 : 0.28;
      const cy = i < 14 ? 2.35 : 2.65;
      curlNode.position.set(Math.cos(ca) * cr, cy, Math.sin(ca) * cr);
      buddha.add(curlNode);
    }

    // Đôi tai dài thùy châu chạm vai
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.48, 8), goldBuddhaMat);
      ear.position.set(side * 0.55, 2.15, 0.05);
      ear.rotation.z = side * 0.15;
      buddha.add(ear);
    }

    // 5. HÀO QUANG TRÒN VÀNG KIM PHÁT SÁNG PHÍA SAU
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 2.35, -0.45);

    const haloDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.65, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffe082,
        emissive: 0xffca28,
        emissiveIntensity: 0.9,
        side: THREE.DoubleSide
      })
    );
    haloGroup.add(haloDisc);

    const haloRim = new THREE.Mesh(
      new THREE.RingGeometry(1.65, 1.85, 32),
      new THREE.MeshStandardMaterial({ color: 0xdeb841, metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide })
    );
    haloGroup.add(haloRim);

    this.buddhaHalo = haloDisc;
    buddha.add(haloGroup);

    const haloLight = new THREE.PointLight(0xffd54f, 1.6, 9);
    haloLight.position.set(0, 2.4, 0.4);
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
    const roofMat = new THREE.MeshStandardMaterial({ map: getVietnameseCurvedRoofTexture(), roughness: 0.55 });
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
    const lowerRoofGeo = makeCurvedRoofGeometry(7.2, 7.2, 2.2, 1.8);
    const lowerRoof = new THREE.Mesh(lowerRoofGeo, roofMat);
    lowerRoof.position.set(0, 5.1, 0);
    lowerRoof.castShadow = true;
    pavilion.add(lowerRoof);

    // TRỐNG BÁT NHÃ ĐỎ NẰM TRÊN GIÁ ĐỠ GỖ (TẦNG 1)
    const drumGroup = new THREE.Group();
    // Thân trống sơn đỏ son có vòng nẹp đồng
    const drumBody = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 1.5, 24), new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 }));
    drumBody.rotation.x = Math.PI / 2;
    drumGroup.add(drumBody);

    // Đai nẹp vàng kim bao quanh thân trống
    for (const dz of [-0.4, 0.4]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.09, 0.04, 8, 24), goldMat);
      hoop.position.z = dz;
      drumGroup.add(hoop);
    }

    // Hai mặt trống da trâu màu trắng kem ngà có viền đinh tán
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2d6be, roughness: 0.9 });
    for (const dir of [-0.76, 0.76]) {
      const skin = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), skinMat);
      skin.position.z = dir;
      if (dir < 0) skin.rotation.y = Math.PI;
      drumGroup.add(skin);
    }

    // Giá đỡ trống bằng gỗ chữ X
    const standMat = new THREE.MeshStandardMaterial({ color: 0x3d170e, roughness: 0.8 });
    for (const sz of [-0.5, 0.5]) {
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 0.16), standMat);
      leg1.position.set(0, -0.4, sz);
      leg1.rotation.z = 0.35;
      drumGroup.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 0.16), standMat);
      leg2.position.set(0, -0.4, sz);
      leg2.rotation.z = -0.35;
      drumGroup.add(leg2);
    }

    drumGroup.position.set(0, 1.6, 0);
    pavilion.add(drumGroup);
    this.drumMesh = drumGroup;

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
    const upperRoofGeo = makeCurvedRoofGeometry(5.8, 5.8, 2.4, 2.0);
    const upperRoof = new THREE.Mesh(upperRoofGeo, roofMat);
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

    this.scene.add(pavilion);

    this.collisionBoxes.push({
      minX: 15.0,
      maxX: 21.0,
      minZ: 5.0,
      maxZ: 11.0,
      type: 'step',
      height: 0.6
    });
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
    for (let i = 0; i < 24; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), rimStoneMat);
      const angle = (i * Math.PI * 2) / 24;
      rock.position.set(Math.cos(angle) * 7.6, 0.15, Math.sin(angle) * 7.6);
      rock.scale.set(1.2, 0.7, 1.2);
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

    const whiteJadeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.1 });
    const quanAmGroup = new THREE.Group();
    quanAmGroup.position.y = 1.1;

    const qaLotus = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.25, 12), whiteJadeMat);
    quanAmGroup.add(qaLotus);

    const qaRobe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 1.8, 12), whiteJadeMat);
    qaRobe.position.y = 1.0;
    quanAmGroup.add(qaRobe);

    const qaHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), whiteJadeMat);
    qaHead.position.y = 2.05;
    quanAmGroup.add(qaHead);

    const qaVase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.25), whiteJadeMat);
    qaVase.position.set(0.25, 1.15, 0.25);
    quanAmGroup.add(qaVase);

    pond.add(quanAmGroup);
    this.pondGroup = pond;
    this.scene.add(pond);

    this.collisionBoxes.push({ minX: -26, maxX: -10, minZ: 16, maxZ: 32, type: 'impassable' });
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

    this.collisionBoxes.push({ minX: -20.5, maxX: -15.5, minZ: 11.5, maxZ: 16.5, type: 'impassable' });
  }

  // ===================== 12. 15-20 CÂY HOA SỨ & BONSAI DỌC LỐI ĐI =====================
  private buildDecorationsAndBonsai() {
    const potTex = createBonsaiPotTexture();
    const potMat = new THREE.MeshStandardMaterial({ map: potTex, roughness: 0.3, metalness: 0.1 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8, flatShading: true });
    const plumeriaBarkMat = new THREE.MeshStandardMaterial({ color: 0x6e6255, roughness: 0.9 });
    const plumeriaLeafMat = new THREE.MeshStandardMaterial({ color: 0x386641, roughness: 0.8, flatShading: true });
    const plumeriaFlowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

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
      { x: -24, z: 4 },   { x: -25, z: -8 },  { x: -20, z: -18 }, { x: -12, z: -23 },
      { x: 12, z: -23 },  { x: 20, z: -18 },  { x: 25, z: -8 },   { x: 24, z: 4 },
      { x: 24, z: 14 },   { x: 24, z: 34 },   { x: -24, z: 34 },  { x: -10, z: 42 },
      { x: 10, z: 42 },   { x: -22, z: 42 },  { x: 22, z: 42 },   { x: 26, z: 24 }
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
    const roofMat = new THREE.MeshStandardMaterial({ map: getVietnameseCurvedRoofTexture(), roughness: 0.65 });

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
    const smokeCount = 28;

    for (let i = 0; i < smokeCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: smokeTex,
        depthWrite: false,
        transparent: true,
        opacity: 0.0
      });
      const sp = new THREE.Sprite(mat);
      sp.position.set((Math.random() - 0.5) * 0.35, 1.6 + (i / smokeCount) * 2.8, 8.5 + (Math.random() - 0.5) * 0.35);
      sp.scale.set(0.4, 0.4, 1);
      this.scene.add(sp);
      this.smokeSprites.push(sp);
      this.smokeLifetimes.push(i / smokeCount); // Offset chu kỳ sống
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
      this.hemiLight.intensity = 0.4;
      this.scene.fog = new THREE.Fog(0x13192f, 50, 200);

      if (this.starsPoints) this.starsPoints.visible = true;
      if (this.moonGroup) this.moonGroup.visible = true;

      // Đèn lồng, đèn đá, nến chuyển sang emissive ấm (#ffb347), tăng sáng
      for (const pl of this.nightLights) pl.intensity = 1.8;
      for (const pl of this.lanternsGlow) pl.intensity = 1.4;
    } else {
      // Ngày nắng chiều: gradient #6fa8dc -> #ffe3b3
      this.skyMaterial.uniforms.topColor.value.setHex(0x6fa8dc);
      this.skyMaterial.uniforms.bottomColor.value.setHex(0xffe3b3);

      this.sunLight.color.setHex(0xffd9a0);
      this.sunLight.intensity = 2.5;
      this.sunLight.position.set(45, 28, 38);

      this.hemiLight.color.setHex(0xfff1d6);
      this.hemiLight.groundColor.setHex(0x7a6a4a);
      this.hemiLight.intensity = 0.9;
      this.scene.fog = new THREE.Fog(0xffe3b3, 60, 250);

      if (this.starsPoints) this.starsPoints.visible = false;
      if (this.moonGroup) this.moonGroup.visible = false;

      for (const pl of this.nightLights) pl.intensity = 0.3;
      for (const pl of this.lanternsGlow) pl.intensity = 0.15;
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
        this.scene.remove(mesh);
        this.lanternMeshMap.delete(id);
      }
    }
    for (const item of lanternList) {
      if (!this.lanternMeshMap.has(item.id)) {
        const mesh = this.createFloatingLanternMesh(item);
        this.scene.add(mesh);
        this.lanternMeshMap.set(item.id, mesh);
      }
    }
  }

  private createIncenseStickMesh(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x8b3a1a, roughness: 0.9 });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 });

    for (let i = 0; i < 3; i++) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45), stickMat);
      stick.position.set((i - 1) * 0.035, 0.22, 0);
      group.add(stick);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), tipMat);
      tip.position.set((i - 1) * 0.035, 0.45, 0);
      group.add(tip);
    }
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
    (group as any).userData = { lanternData: item };

    const paperMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), paperMat);
      const a = (i * Math.PI * 2) / 6;
      petal.position.set(Math.cos(a) * 0.18, 0.08, Math.sin(a) * 0.18);
      petal.rotation.z = Math.cos(a) * 0.35;
      petal.rotation.x = Math.sin(a) * -0.35;
      group.add(petal);
    }

    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    candle.position.y = 0.1;
    group.add(candle);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    flame.position.y = 0.2;
    group.add(flame);

    const light = new THREE.PointLight(0xff9900, 0.5, 3.5);
    light.position.y = 0.25;
    group.add(light);

    group.position.set(item.x, 0.04, item.z);
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

    // 2. Khói hương tròn mờ: bay lên, lượn nhẹ, to dần và mờ dần trong 4-6s
    for (let i = 0; i < this.smokeSprites.length; i++) {
      const sp = this.smokeSprites[i];
      let lt = (this.smokeLifetimes[i] + delta * 0.2) % 1.0;
      this.smokeLifetimes[i] = lt;

      // Chiều cao bay lên từ 1.6m -> 5.2m
      sp.position.y = 1.6 + lt * 3.6;
      // Uốn lượn nhẹ nhàng theo sóng sin
      sp.position.x = Math.sin(elapsed * 1.5 + i) * (0.15 + lt * 0.35);
      sp.position.z = 8.5 + Math.cos(elapsed * 1.2 + i * 2) * (0.15 + lt * 0.35);

      // Kích thước to dần (0.35 -> 1.2m)
      const scale = 0.35 + lt * 0.95;
      sp.scale.set(scale, scale, 1);

      // Mờ dần theo thời gian (tối đa 0.35)
      const alpha = Math.sin(lt * Math.PI) * 0.35;
      (sp.material as THREE.SpriteMaterial).opacity = alpha;
    }

    // 3. Cánh hoa rơi InstancedMesh
    if (this.fallingPetals) {
      for (let i = 0; i < this.petalCount; i++) {
        const p = this.petalData[i];
        p.y -= delta * p.speed;
        p.x += Math.sin(elapsed * 1.5 + i) * delta * 0.3;
        p.rx += delta * p.rotSpeed;
        p.ry += delta * (p.rotSpeed * 0.7);

        if (p.y < 0.1) {
          p.y = 11 + Math.random() * 4;
          p.x = (Math.random() - 0.5) * 60;
          p.z = (Math.random() - 0.5) * 60;
        }

        this.petalDummy.position.set(p.x, p.y, p.z);
        this.petalDummy.rotation.set(p.rx, p.ry, 0);
        this.petalDummy.updateMatrix();
        this.fallingPetals.setMatrixAt(i, this.petalDummy.matrix);
      }
      this.fallingPetals.instanceMatrix.needsUpdate = true;
    }

    // 4. Hào quang Đức Phật Thích Ca nhấp nháy nhẹ trang nghiêm
    if (this.buddhaHalo) {
      this.buddhaHalo.rotation.z += delta * 0.15;
      const pulse = 1.0 + Math.sin(elapsed * 2.2) * 0.05;
      this.buddhaHalo.scale.set(pulse, pulse, 1);
    }

    // 5. Đèn hoa đăng trôi dập dềnh trên hồ sen
    for (const [, lanternGroup] of this.lanternMeshMap.entries()) {
      const data = (lanternGroup as any).userData?.lanternData as LanternItem;
      if (data) {
        const seed = data.seed || 1;
        const driftT = (elapsed + seed % 1000) * 0.2;
        lanternGroup.position.x = data.x + Math.sin(driftT) * 0.35;
        lanternGroup.position.z = data.z + Math.cos(driftT) * 0.35;
        lanternGroup.position.y = 0.04 + Math.sin(elapsed * 2.5 + seed) * 0.02;
        lanternGroup.rotation.y += delta * 0.2;
      }
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
        this.drumMesh.scale.set(
          1 + Math.sin(elapsed * 20) * 0.04 * decay,
          1 + Math.sin(elapsed * 20) * 0.04 * decay,
          1
        );
      }
    }
  }

  // ===================== KIỂM TRA VA CHẠM =====================
  public checkCollision(x: number, z: number, radius = 0.35): { allowed: boolean; height: number } {
    let groundHeight = 0;

    for (const box of this.collisionBoxes) {
      const inX = x >= box.minX - radius && x <= box.maxX + radius;
      const inZ = z >= box.minZ - radius && z <= box.maxZ + radius;

      if (inX && inZ) {
        if (box.type === 'impassable') {
          return { allowed: false, height: groundHeight };
        } else if (box.type === 'step') {
          groundHeight = Math.max(groundHeight, box.height || 0);
        }
      }
    }

    return { allowed: true, height: groundHeight };
  }
}
