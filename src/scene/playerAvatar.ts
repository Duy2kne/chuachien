import * as THREE from 'three';
import type { PlayerData, ActionType, RobeColor, AvatarStyle } from '../types.js';
import { getTitle } from '../shared/merit.js';
import { createHaloTexture } from './proceduralTextures.js';

// Bảng màu áo tràng truyền thống chùa Việt Nam
export const ROBE_COLORS: Record<RobeColor, { hex: number; name: string; css: string }> = {
  blue:   { hex: 0x2563eb, name: 'Lam y (Xanh)', css: '#2563eb' },
  brown:  { hex: 0x5e371d, name: 'Nâu sòng', css: '#5e371d' },
  orange: { hex: 0xd97706, name: 'Cam ca-sa', css: '#d97706' },
  grey:   { hex: 0x64748b, name: 'Xám lam', css: '#64748b' },
  yellow: { hex: 0xeab308, name: 'Vàng hoàng y', css: '#eab308' },
  white:  { hex: 0xf1f5f9, name: 'Bạch y', css: '#f1f5f9' },
  moss:   { hex: 0x3f6212, name: 'Xanh rêu', css: '#3f6212' }
};

// Thời lượng các hành động làm một lần (giây). Hành động không có ở đây là dạng bật/tắt.
export const ACTION_DURATION: Partial<Record<ActionType, number>> = {
  bow: 6.2,
  incense: 5.4,
  flower: 3.6,
  bell: 3.0,
  drum: 3.0,
  lantern: 3.6,
  wave: 2.6,
  sweep: 3.4
};

export type AvatarSoundEvent = 'mo' | 'chime';

const SKIN = '#ffe4d0';
const SKIN_HEX = 0xffe4d0;

// Kích thước cánh tay (tính từ khớp vai)
const UPPER_ARM = 0.16;
const SLEEVE_LEN = 0.33;
const HAND_FROM_ELBOW = 0.2;

// Tư thế: mọi khớp được nội suy mượt từ tư thế hiện tại sang tư thế đích
interface Pose {
  hipY: number;       // hạ thấp người khi quỳ / ngồi
  bend: number;       // cúi người về phía trước
  sway: number;       // nghiêng người sang bên
  headX: number;      // cúi / ngẩng đầu
  headZ: number;      // nghiêng đầu
  lsx: number; lsy: number; lsz: number; le: number; // vai + khuỷu tay trái
  rsx: number; rsy: number; rsz: number; re: number; // vai + khuỷu tay phải
  footL: number;      // bàn chân trái tiến / lùi
  footR: number;
  liftL: number;      // nhấc chân khi bước
  liftR: number;
  skirtY: number;     // vạt áo co lại khi ngồi
  skirtXZ: number;    // vạt áo xòe khi ngồi xếp bằng
  lap: number;        // đùi xếp bằng (0 = ẩn, 1 = hiện)
  feet: number;       // 1 = thấy giày, 0 = giấu dưới áo
  palms: number;      // 1 = hai lòng bàn tay áp vào nhau (chắp tay)
  eyes: number;       // 1 = mở, 0 = nhắm
  aura: number;       // độ sáng hào quang thiền
}

const IDLE_POSE: Pose = {
  hipY: 0, bend: 0, sway: 0, headX: 0, headZ: 0,
  lsx: 0.37, lsy: -0.17, lsz: 0.54, le: -0.94,
  rsx: 0.37, rsy: 0.17, rsz: -0.54, re: -0.94,
  footL: 0, footR: 0, liftL: 0, liftR: 0,
  skirtY: 1, skirtXZ: 1, lap: 0, feet: 1, palms: 0, eyes: 1, aura: 0
};

// Góc tay trái [vai x, vai y, vai z, khuỷu] cho từng tư thế (tay phải lấy đối xứng).
// Các góc được giải bằng động học ngược để bàn tay tới đúng chỗ mà không xuyên vào thân.
type ArmAngles = [number, number, number, number];
const ARM: Record<string, ArmAngles> = {
  idle:       [0.37, -0.17, 0.54, -0.94],   // buông thả hai bên, hơi khép
  pray:       [0.08, -1.31, 1.31, -1.31],   // chắp tay trước ngực
  prayHigh:   [-0.96, -1.41, 0.88, -1.18],  // chắp tay đưa lên trán (vái)
  belly:      [-1.15, -2.13, 0.03, -0.7],   // hai tay chồng trước bụng (thiền)
  hold:       [-1.14, -2.02, 0.04, -0.62],  // nâng vật trước ngực
  holdUp:     [-0.61, -1.79, 0.77, -0.32],  // dâng vật lên cao
  reachUp:    [-1.22, -1.83, 1.39, -0.16],  // với dây thừng trên cao
  pullDown:   [-1.73, -0.44, -0.28, -0.98], // kéo dây xuống
  holdLow:    [-1.14, -2.05, 0.05, -0.6],   // cầm đèn thấp
  pushOut:    [-1.15, -2.11, 0.0, -0.49],   // đẩy đèn ra mặt nước
  drumLow:    [-1.0, -0.9, 0.35, -0.75],    // dùi trống chạm mặt trống
  drumHigh:   [-1.07, -0.3, 0.06, -1.54],   // giơ dùi lên
  moRest:     [-1.17, -2.01, -0.05, -0.51], // tay đặt lên mõ
  moUp:       [-0.84, -1.02, 0.21, -0.87],  // giơ dùi mõ
  moDown:     [-1.16, -2.04, -0.03, -0.46], // gõ xuống mõ
  bowDown:    [-1.74, 0.39, -0.21, -0.03]   // lạy: hai tay vươn ra trước chạm đất
};

const mixArm = (a: ArmAngles, b: ArmAngles, t: number): ArmAngles =>
  [0, 1, 2, 3].map(i => a[i] + (b[i] - a[i]) * t) as ArmAngles;

// Gán góc cho tay trái và tay phải (mặc định đối xứng)
function setArms(p: Pose, left: ArmAngles, right: ArmAngles = left) {
  [p.lsx, p.lsy, p.lsz, p.le] = left;
  p.rsx = right[0];
  p.rsy = -right[1];
  p.rsz = -right[2];
  p.re = right[3];
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
// Xung 0 -> 1 -> 0 trong khoảng [a, b]
const pulse = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));

const toCss = (c: THREE.Color) => `#${c.getHexString()}`;

// ===================== TEXTURE VẼ TAY =====================
const faceCache = new Map<string, THREE.CanvasTexture>();

// Mặt chibi vẽ trên quả cầu đầu. Mặt trước của SphereGeometry nằm ở u = 0.25 (x = 256 / 1024).
function getFaceTexture(style: AvatarStyle, closed: boolean): THREE.CanvasTexture {
  const key = `${style}-${closed}`;
  if (faceCache.has(key)) return faceCache.get(key)!;

  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  const cx = 256;

  g.fillStyle = SKIN;
  g.fillRect(0, 0, 1024, 512);

  // Đổ bóng nhẹ phía sau đầu và cằm cho khối đầu tròn trịa
  const back = g.createLinearGradient(0, 0, 1024, 0);
  back.addColorStop(0, 'rgba(0,0,0,0)');
  back.addColorStop(0.25, 'rgba(0,0,0,0)');
  back.addColorStop(0.75, 'rgba(150,90,60,0.12)');
  back.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = back;
  g.fillRect(0, 0, 1024, 512);

  if (style === 'lay') {
    // Tóc đen ôm đầu, đường chân tóc bo tròn quanh mặt
    g.fillStyle = '#2b211c';
    g.fillRect(0, 0, 1024, 300);
    g.fillStyle = SKIN;
    g.beginPath();
    g.ellipse(cx, 340, 175, 150, 0, 0, Math.PI * 2);
    g.fill();
    // Mái tóc rẽ ngôi
    g.fillStyle = '#2b211c';
    g.beginPath();
    g.ellipse(cx - 60, 196, 120, 34, 0.18, 0, Math.PI * 2);
    g.ellipse(cx + 70, 200, 110, 30, -0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, 60, 1024, 18);
  } else {
    // Chú tiểu: da đầu cạo xanh nhạt
    const scalp = g.createLinearGradient(0, 0, 0, 230);
    scalp.addColorStop(0, 'rgba(120, 140, 160, 0.42)');
    scalp.addColorStop(0.75, 'rgba(120, 140, 160, 0.18)');
    scalp.addColorStop(1, 'rgba(120, 140, 160, 0)');
    g.fillStyle = scalp;
    g.fillRect(0, 0, 1024, 230);
  }

  // Lông mày
  g.strokeStyle = style === 'lay' ? '#3a2a20' : '#9a7357';
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(cx + s * 64, 262, 28, Math.PI * 1.22, Math.PI * 1.78);
    g.stroke();
  }

  const eyeY = 300;
  if (closed) {
    // Mắt nhắm hiền hòa (cong xuống)
    g.strokeStyle = '#3b2418';
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * 64, eyeY - 10, 24, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      const ex = cx + s * 64;
      // Tròng mắt to long lanh
      const iris = g.createLinearGradient(0, eyeY - 34, 0, eyeY + 34);
      iris.addColorStop(0, '#1f140e');
      iris.addColorStop(1, '#5a3a24');
      g.fillStyle = iris;
      g.beginPath();
      g.ellipse(ex, eyeY, 24, 33, 0, 0, Math.PI * 2);
      g.fill();
      // Điểm sáng trong mắt
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(ex + 8, eyeY - 13, 9, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(ex - 8, eyeY + 14, 4.5, 0, Math.PI * 2);
      g.fill();
      // Mi trên
      g.strokeStyle = '#1f140e';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(ex, eyeY + 4, 30, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
  }

  // Má hồng
  for (const s of [-1, 1]) {
    const blush = g.createRadialGradient(cx + s * 112, 350, 0, cx + s * 112, 350, 40);
    blush.addColorStop(0, 'rgba(255, 120, 130, 0.55)');
    blush.addColorStop(1, 'rgba(255, 120, 130, 0)');
    g.fillStyle = blush;
    g.fillRect(cx + s * 112 - 40, 310, 80, 80);
  }

  // Mũi + miệng cười
  g.fillStyle = 'rgba(200, 120, 90, 0.5)';
  g.beginPath();
  g.ellipse(cx, 335, 6, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#b4413f';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(cx, 352, 17, Math.PI * 0.18, Math.PI * 0.82);
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}

// Áo tràng phần thân: cổ giao lĩnh viền trắng, thắt lưng, nếp vải.
// Lathe có phiStart = π nên mặt trước nằm giữa ảnh (x = 256 / 512).
function makeTorsoTexture(robe: THREE.Color, embroidered = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const dark = robe.clone().multiplyScalar(0.6);
  g.fillStyle = toCss(robe);
  g.fillRect(0, 0, 512, 256);

  // Nếp vải dọc
  for (let x = 0; x < 512; x += 32) {
    const grad = g.createLinearGradient(x, 0, x + 32, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0.0)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 32, 256);
  }

  // Cổ áo giao lĩnh: vạt phải đè lên vạt trái, viền trắng
  g.lineCap = 'round';
  g.strokeStyle = toCss(dark);
  g.lineWidth = 22;
  g.beginPath();
  g.moveTo(256 - 78, 0);
  g.lineTo(256 + 26, 168);
  g.stroke();
  g.strokeStyle = '#f4efe4';
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(256 - 78, 0);
  g.lineTo(256 + 26, 168);
  g.stroke();
  g.strokeStyle = '#f4efe4';
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(256 + 78, 0);
  g.lineTo(256 + 10, 96);
  g.stroke();

  // Áo vàng kim: hoa sen thêu chỉ đỏ trên ngực và lưng
  if (embroidered) {
    for (const [cx, cy] of [[150, 130], [380, 120], [470, 70], [40, 90]]) {
      g.fillStyle = 'rgba(160, 40, 20, 0.75)';
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(cx + (i - 2) * 9, cy - Math.abs(i - 2) * -4, 6, 16, (i - 2) * 0.45, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(255, 236, 160, 0.9)';
      g.beginPath();
      g.arc(cx, cy + 10, 5, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Thắt lưng + nút buộc
  g.fillStyle = toCss(dark);
  g.fillRect(0, 222, 512, 20);
  g.beginPath();
  g.ellipse(256 + 40, 232, 16, 12, 0, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Vạt áo dưới: nếp gấp dọc và viền gấu áo
function makeSkirtTexture(robe: THREE.Color): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = toCss(robe);
  g.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 28) {
    const grad = g.createLinearGradient(x, 0, x + 28, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.05)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.13)');
    grad.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 28, 128);
  }
  g.fillStyle = toCss(robe.clone().multiplyScalar(0.55));
  g.fillRect(0, 114, 512, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ===================== CÁNH TAY LIỀN KHỐI (SKINNED MESH) =====================
// Ống tay áo là 1 khối liền, uốn cong tự nhiên theo 2 xương: vai và khuỷu tay.
function makeArm(sleeveMat: THREE.Material, skinMat: THREE.Material) {
  const geo = new THREE.CylinderGeometry(0.066, 0.102, SLEEVE_LEN, 16, 14, true);
  geo.translate(0, -SLEEVE_LEN / 2, 0);
  const pos = geo.attributes.position;
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    // Chuyển dần từ xương vai sang xương khuỷu quanh vùng khuỷu tay
    const w = smooth((-pos.getY(i) - (UPPER_ARM - 0.05)) / 0.1);
    skinIndex.push(0, 1, 0, 0);
    skinWeight.push(1 - w, w, 0, 0);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const shoulder = new THREE.Bone();
  const elbow = new THREE.Bone();
  elbow.position.y = -UPPER_ARM;
  shoulder.add(elbow);

  const mesh = new THREE.SkinnedMesh(geo, sleeveMat);
  mesh.add(shoulder);
  // Cập nhật ma trận xương trước khi bind để tính đúng ma trận nghịch đảo của khuỷu tay
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([shoulder, elbow]));
  mesh.frustumCulled = false;
  mesh.castShadow = true;

  // Bàn tay tròn nhô ra khỏi ống tay
  const hand = new THREE.Group();
  hand.position.y = -HAND_FROM_ELBOW;
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), skinMat);
  palm.scale.set(0.9, 1.05, 0.75);
  hand.add(palm);
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skinMat);
  thumb.position.set(0, 0.0, 0.04);
  hand.add(thumb);
  elbow.add(hand);

  return { mesh, shoulder, elbow, hand };
}

export class PlayerAvatar {
  public group: THREE.Group;
  public data: PlayerData;
  public isSelf: boolean;

  private hips = new THREE.Group();
  private head = new THREE.Group();
  private headMesh!: THREE.Mesh;
  private faceOpen!: THREE.Texture;
  private faceClosed!: THREE.Texture;
  private skirt!: THREE.Mesh;
  private lap!: THREE.Mesh;
  private feet: THREE.Mesh[] = [];
  private arms!: { left: ReturnType<typeof makeArm>; right: ReturnType<typeof makeArm> };
  private meditationAura!: THREE.Mesh;
  private palms = new THREE.Group();
  private halo: THREE.Mesh | null = null;
  private titleName = '';
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();

  // Đạo cụ
  private props: Record<'incense' | 'flower' | 'lantern' | 'mo' | 'mallet' | 'drumL' | 'drumR' | 'broom', THREE.Object3D> = {} as any;

  // Billboard tên và bong bóng chat
  private nameSprite: THREE.Sprite | null = null;
  private bubbleSprite: THREE.Sprite | null = null;
  private bubbleExpireTimer = 0;

  // Nội suy vị trí từ mạng
  public targetPos = new THREE.Vector3();
  public targetRy = 0;
  public currentAnim: ActionType = 'idle';

  private lastAnim: ActionType = 'idle';
  private animTime = 0;
  private finishedNotified = false;
  private lastBeat = -1;
  private pose: Pose = { ...IDLE_POSE };

  // Sự kiện cho App: phát âm thanh, báo hết hành động
  public onSound?: (type: AvatarSoundEvent, avatar: PlayerAvatar) => void;
  public onActionFinished?: (anim: ActionType) => void;

  constructor(data: PlayerData, isSelf = false) {
    this.data = data;
    this.isSelf = isSelf;
    this.group = new THREE.Group();
    this.group.position.set(data.x, data.y || 0, data.z);
    this.group.rotation.y = data.ry;
    this.targetPos.copy(this.group.position);
    this.targetRy = data.ry;
    this.currentAnim = data.anim || 'idle';
    this.lastAnim = this.currentAnim;

    this.buildMesh();
    this.buildProps();
    this.buildNameTag();
  }

  private has(item: string) {
    return (this.data.items || []).includes(item);
  }

  private buildMesh() {
    const goldRobe = this.has('robe_gold');
    const robeColor = new THREE.Color(goldRobe ? 0xc99a2e : ROBE_COLORS[this.data.robe]?.hex ?? 0x5e371d);
    const style: AvatarStyle = this.data.style === 'lay' ? 'lay' : 'monk';

    const skinMat = new THREE.MeshStandardMaterial({ color: SKIN_HEX, roughness: 0.7 });
    const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85 });
    const torsoMat = new THREE.MeshStandardMaterial({
      map: makeTorsoTexture(robeColor, goldRobe),
      roughness: goldRobe ? 0.45 : 0.85,
      metalness: goldRobe ? 0.25 : 0
    });
    const skirtMat = new THREE.MeshStandardMaterial({ map: makeSkirtTexture(robeColor), roughness: 0.85 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85, side: THREE.DoubleSide });

    // Bóng mờ dưới chân
    const shadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.012;
    this.group.add(shadowMesh);

    // 1. Vạt áo tràng dài chấm gót (gắn với thân gốc, không cúi theo khi lạy)
    const skirtProfile = [
      new THREE.Vector2(0.0, 0.05),
      new THREE.Vector2(0.33, 0.05),
      new THREE.Vector2(0.345, 0.08),
      new THREE.Vector2(0.32, 0.2),
      new THREE.Vector2(0.28, 0.34),
      new THREE.Vector2(0.255, 0.46),
      new THREE.Vector2(0.0, 0.46)
    ];
    this.skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 32, Math.PI), skirtMat);
    this.skirt.scale.z = 0.92;
    this.skirt.castShadow = true;
    this.group.add(this.skirt);

    // Đùi xếp bằng (chỉ hiện khi ngồi thiền / gõ mõ)
    this.lap = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.36, 6, 16), robeMat);
    this.lap.rotation.z = Math.PI / 2;
    this.lap.position.set(0, 0.11, 0.13);
    this.lap.castShadow = true;
    this.group.add(this.lap);

    // Đôi giày vải nhô ra dưới gấu áo
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.8 });
    for (const side of [1, -1]) {
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), shoeMat);
      shoe.scale.set(0.85, 0.5, 1.35);
      shoe.position.set(side * 0.1, 0.035, 0.06);
      this.group.add(shoe);
      this.feet.push(shoe);
    }

    // 2. Hông và thân trên
    this.hips.position.y = 0.42;
    this.group.add(this.hips);

    const torsoProfile = [
      new THREE.Vector2(0.0, -0.03),
      new THREE.Vector2(0.262, -0.03),
      new THREE.Vector2(0.262, 0.12),
      new THREE.Vector2(0.245, 0.27),
      new THREE.Vector2(0.215, 0.37),
      new THREE.Vector2(0.165, 0.44),
      new THREE.Vector2(0.1, 0.485),
      new THREE.Vector2(0.0, 0.5)
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 32, Math.PI), torsoMat);
    torso.scale.z = 0.86;
    torso.castShadow = true;
    this.hips.add(torso);

    // Vai tròn nối liền thân với tay áo
    for (const side of [1, -1]) {
      const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.083, 16, 12), robeMat);
      shoulderCap.position.set(side * 0.19, 0.385, 0.0);
      this.hips.add(shoulderCap);
    }

    // Tràng hạt đeo cổ
    const agarwood = this.has('mala_tram');
    const beadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(agarwood ? 0.024 : 0.019, 10, 8), beadMat, 22);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      // Vòng hạt rủ xuống phía trước ngực
      const front = Math.max(0, Math.cos(a));
      dummy.position.set(Math.sin(a) * 0.15, 0.44 - front * front * 0.15, Math.cos(a) * 0.13 + 0.015 + front * 0.03);
      dummy.updateMatrix();
      beads.setMatrixAt(i, dummy.matrix);
      // Gỗ trầm nâu sẫm, cứ 5 hạt có 1 hạt vàng
      beads.setColorAt(i, new THREE.Color(agarwood ? (i % 5 === 0 ? 0xd4a537 : 0x3b1d0e) : 0x5a1f12));
    }
    this.hips.add(beads);
    const tassel = new THREE.Mesh(
      new THREE.ConeGeometry(agarwood ? 0.03 : 0.022, agarwood ? 0.09 : 0.06, 8),
      new THREE.MeshStandardMaterial({ color: agarwood ? 0xb91c1c : 0xd97706 })
    );
    tassel.position.set(0, 0.26, 0.19);
    tassel.rotation.x = Math.PI;
    this.hips.add(tassel);

    // 3. Đầu chibi tròn trịa, mặt vẽ texture
    this.head.position.y = 0.5;
    this.hips.add(this.head);
    this.faceOpen = getFaceTexture(style, false);
    this.faceClosed = getFaceTexture(style, true);
    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 40, 28),
      new THREE.MeshStandardMaterial({ map: this.faceOpen, roughness: 0.65 })
    );
    this.headMesh.scale.set(1.05, 0.98, 1.0);
    this.headMesh.position.y = 0.29;
    this.headMesh.castShadow = true;
    this.head.add(this.headMesh);

    for (const side of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), skinMat);
      ear.scale.set(0.45, 1, 0.8);
      ear.position.set(side * 0.35, 0.27, -0.01);
      this.head.add(ear);
    }

    if (style === 'lay') {
      // Búi tóc sau gáy
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x2b211c, roughness: 0.75 });
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), hairMat);
      bun.position.set(0, 0.5, -0.2);
      this.head.add(bun);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 16), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
      tie.position.set(0, 0.45, -0.17);
      tie.rotation.x = 0.9;
      this.head.add(tie);
    } else {
      // Chú tiểu: 6 chấm giới hương trên đỉnh đầu
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xc69a78 });
      for (let r = 0; r < 3; r++) {
        for (const dx of [-0.05, 0.05]) {
          const dot = new THREE.Mesh(new THREE.CircleGeometry(0.014, 10), dotMat);
          const p = new THREE.Vector3(dx, 0.62, 0.05 - r * 0.075);
          const n = p.clone().sub(new THREE.Vector3(0, 0.29, 0)).normalize();
          dot.position.copy(n.clone().multiplyScalar(0.338)).add(new THREE.Vector3(0, 0.29, 0));
          dot.lookAt(dot.position.clone().add(n));
          this.head.add(dot);
        }
      }
    }

    if (this.has('non_la')) {
      // Nón lá: chóp nón lá cọ, các vòng nan, quai đỏ dưới cằm
      const hatMat = new THREE.MeshStandardMaterial({ color: 0xe9d7a5, roughness: 0.85, side: THREE.DoubleSide });
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.3, 40, 1, true), hatMat);
      hat.position.y = 0.68;
      this.head.add(hat);
      const ribMat = new THREE.MeshStandardMaterial({ color: 0xc9b07a, roughness: 0.9 });
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.56 * (1 - k) + 0.005, 0.006, 4, 40), ribMat);
        rib.rotation.x = Math.PI / 2;
        rib.position.y = 0.53 + 0.3 * k;
        this.head.add(rib);
      }
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.008, 4, 32, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xb91c1c })
      );
      strap.rotation.z = Math.PI;
      strap.position.set(0, 0.42, 0.05);
      strap.scale.set(1.05, 1.25, 1);
      this.head.add(strap);
    }

    if (this.has('halo')) {
      // Hào quang tỏa sáng sau đầu
      this.halo = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 1.15),
        new THREE.MeshBasicMaterial({
          map: createHaloTexture(),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.85
        })
      );
      this.halo.position.set(0, 0.3, -0.36);
      this.head.add(this.halo);
    }

    // 4. Hai cánh tay liền khối (mặt nhân vật hướng +z, tay trái nằm bên +x)
    const left = makeArm(sleeveMat, skinMat);
    const right = makeArm(sleeveMat, skinMat);
    left.mesh.position.set(0.2, 0.39, 0.0);
    right.mesh.position.set(-0.2, 0.39, 0.0);
    this.hips.add(left.mesh, right.mesh);
    this.arms = { left, right };

    // Đôi bàn tay chắp: hai lòng bàn tay áp vào nhau, đầu ngón hướng lên
    for (const side of [1, -1]) {
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), skinMat);
      palm.scale.set(0.5, 1.25, 0.85);
      palm.position.set(side * 0.022, 0.035, 0);
      this.palms.add(palm);
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), skinMat);
      thumb.position.set(side * 0.03, 0.0, 0.03);
      this.palms.add(thumb);
    }
    this.palms.rotation.x = 0.15;
    this.palms.visible = false;
    this.hips.add(this.palms);

    // 5. Vòng hào quang thiền định
    this.meditationAura = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.85, 48),
      new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.meditationAura.rotation.x = -Math.PI / 2;
    this.meditationAura.position.y = 0.04;
    this.meditationAura.visible = false;
    this.group.add(this.meditationAura);
  }

  // ===================== ĐẠO CỤ =====================
  private buildProps() {
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x5b2c12, roughness: 0.6 });
    const glowSpriteMat = (color: number) => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
    };
    const { left, right } = this.arms;

    // 3 nén hương kẹp giữa hai bàn tay chắp (nối dài theo cẳng tay trái)
    const incense = new THREE.Group();
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 });
    const tipGlow = glowSpriteMat(0xff6a1a);
    for (let i = -1; i <= 1; i++) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.44, 5), stickMat);
      stick.position.set(i * 0.02, 0.18, 0);
      stick.rotation.z = -i * 0.06;
      incense.add(stick);
      const tip = new THREE.Sprite(tipGlow);
      tip.scale.set(0.06, 0.06, 1);
      tip.position.set(i * 0.033, 0.4, 0);
      incense.add(tip);
    }
    incense.position.y = 0.04;
    this.palms.add(incense);
    this.props.incense = incense;

    // Hoa sen dâng cúng (nâng ngang ngực)
    const flower = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.5, emissive: 0xf472b6, emissiveIntensity: 0.15 });
    for (const [count, radius, tilt, h] of [[8, 0.055, 0.5, 0.05], [6, 0.03, 0.25, 0.07]] as const) {
      for (let i = 0; i < count; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), petalMat);
        petal.scale.set(0.7, 1.5, 0.35);
        const a = (i / count) * Math.PI * 2;
        petal.position.set(Math.cos(a) * radius, h, Math.sin(a) * radius);
        petal.rotation.order = 'YXZ';
        petal.rotation.set(tilt, -a + Math.PI / 2, 0);
        flower.add(petal);
      }
    }
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    pod.position.y = 0.08;
    flower.add(pod);
    const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 16), new THREE.MeshStandardMaterial({ color: 0x4d7c0f }));
    flower.add(leaf);
    this.hips.add(flower);
    this.props.flower = flower;

    // Đèn hoa đăng cầm trên tay
    const lantern = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x4d7c0f }));
    lantern.add(base);
    const lPetal = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, emissive: 0xf472b6, emissiveIntensity: 0.35 });
    for (let i = 0; i < 7; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lPetal);
      petal.scale.set(0.7, 1.4, 0.35);
      const a = (i / 7) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.09, 0.06, Math.sin(a) * 0.09);
      petal.rotation.order = 'YXZ';
      petal.rotation.set(0.5, -a + Math.PI / 2, 0);
      lantern.add(petal);
    }
    const lGlow = new THREE.Sprite(glowSpriteMat(0xffa94d));
    lGlow.scale.set(0.45, 0.45, 1);
    lGlow.position.y = 0.12;
    lantern.add(lGlow);
    this.hips.add(lantern);
    this.props.lantern = lantern;

    // Mõ gỗ hình cá đặt trên gối đỏ trước mặt
    const mo = new THREE.Group();
    const moBody = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.4 }));
    moBody.scale.set(1.15, 0.85, 1);
    mo.add(moBody);
    const moMouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0x1c0d06 }));
    moMouth.position.set(0, -0.015, 0.14);
    moMouth.rotation.z = Math.PI;
    mo.add(moMouth);
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
    cushion.position.y = -0.13;
    mo.add(cushion);
    mo.position.set(0, 0.15, 0.48);
    this.group.add(mo);
    this.props.mo = mo;

    // Dùi mõ nối dài theo bàn tay phải
    const mallet = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.26, 6), woodDark);
    handle.position.y = -0.11;
    mallet.add(handle);
    const malletHead = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 8), woodDark);
    malletHead.position.y = -0.25;
    mallet.add(malletHead);
    right.hand.add(mallet);
    this.props.mallet = mallet;

    // Dùi trống hai tay
    for (const [key, arm] of [['drumL', left], ['drumR', right]] as const) {
      const stick = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.42, 6), woodDark);
      body.position.y = -0.17;
      stick.add(body);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
      knob.position.y = -0.38;
      stick.add(knob);
      arm.hand.add(stick);
      this.props[key] = stick;
    }

    // Chổi tre quét lá: cán cầm ở hai tay, bó chổi chạm đất phía trước
    const broom = new THREE.Group();
    broom.rotation.order = 'YXZ';
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xa3793f, roughness: 0.7 });
    const broomHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.8, 8), handleMat);
    broomHandle.position.y = -0.36;
    broom.add(broomHandle);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0x5b3a1a }));
    tie.position.y = -0.74;
    broom.add(tie);
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.17, 0.36, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xc8a24a, roughness: 0.95, side: THREE.DoubleSide })
    );
    straw.scale.z = 0.4;
    straw.position.y = -0.9;
    broom.add(straw);
    broom.position.set(0, 0.22, 0.3);
    this.hips.add(broom);
    this.props.broom = broom;

    for (const p of Object.values(this.props)) p.visible = false;
  }

  // ===================== BILLBOARD TÊN + DANH HIỆU =====================
  private buildNameTag() {
    if (this.nameSprite) {
      this.group.remove(this.nameSprite);
      this.nameSprite.material.map?.dispose();
      this.nameSprite.material.dispose();
    }
    const title = getTitle(this.data.merit || 0);
    this.titleName = title.name;

    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 112;
    const ctx = canvas.getContext('2d')!;
    const text = this.data.name || 'Phật tử';

    // Danh hiệu
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 22px "Be Vietnam Pro", sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(20, 14, 10, 0.85)';
    ctx.strokeText(`〈${title.name}〉`, 192, 18);
    ctx.fillStyle = title.color;
    ctx.fillText(`〈${title.name}〉`, 192, 18);

    // Tên
    ctx.font = 'bold 30px "Be Vietnam Pro", sans-serif';
    const w = Math.min(360, ctx.measureText(text).width + 48);
    const x = (384 - w) / 2;
    ctx.fillStyle = this.isSelf ? 'rgba(180, 83, 9, 0.92)' : 'rgba(28, 25, 23, 0.78)';
    ctx.strokeStyle = this.isSelf ? '#fde68a' : 'rgba(253, 230, 138, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, 46, w, 52, 26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fffbeb';
    ctx.fillText(text, 192, 73, 330);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    this.nameSprite.scale.set(1.25, 0.365, 1);
    this.nameSprite.position.set(0, 1.68, 0);
    this.nameSprite.renderOrder = 10;
    this.group.add(this.nameSprite);
  }

  // ===================== BONG BÓNG LỜI NÓI (SPEECH BUBBLE) =====================
  public showSpeechBubble(text: string) {
    if (this.bubbleSprite) {
      this.group.remove(this.bubbleSprite);
      this.bubbleSprite.material.map?.dispose();
      this.bubbleSprite.material.dispose();
      this.bubbleSprite = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '500 26px "Be Vietnam Pro", sans-serif';

    // Ngắt dòng tối đa 2 dòng
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > 430 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (lines.length > 2) {
      lines.length = 2;
      lines[1] = lines[1].slice(0, Math.max(0, lines[1].length - 3)) + '…';
    }

    const boxH = 30 + lines.length * 36;
    const boxW = Math.min(480, Math.max(...lines.map(l => ctx.measureText(l).width)) + 48);
    const bx = (512 - boxW) / 2;
    const by = 150 - boxH;

    ctx.fillStyle = 'rgba(255, 251, 240, 0.96)';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 22);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(242, 150);
    ctx.lineTo(256, 176);
    ctx.lineTo(270, 150);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(244, 146, 24, 6);

    ctx.fillStyle = '#292524';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 256, by + 33 + i * 36));

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.bubbleSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    this.bubbleSprite.scale.set(2.4, 0.94, 1);
    this.bubbleSprite.position.set(0, 2.25, 0);
    this.bubbleSprite.renderOrder = 11;
    this.group.add(this.bubbleSprite);

    this.bubbleExpireTimer = 6.0;
  }

  // Chạy lại từ đầu hành động đang làm (ví dụ bấm "Lạy Phật" thêm lần nữa)
  public restartAnim() {
    this.animTime = 0;
    this.finishedNotified = false;
    this.lastBeat = -1;
  }

  // ===================== CẬP NHẬT HOẠT ẢNH & NỘI SUY MẠNG =====================
  public update(delta: number, elapsed: number) {
    // 1. Bong bóng chat
    if (this.bubbleSprite) {
      this.bubbleExpireTimer -= delta;
      const mat = this.bubbleSprite.material;
      mat.opacity = Math.min(1, this.bubbleExpireTimer * 2);
      if (this.bubbleExpireTimer <= 0) {
        this.group.remove(this.bubbleSprite);
        mat.map?.dispose();
        mat.dispose();
        this.bubbleSprite = null;
      }
    }

    if (getTitle(this.data.merit || 0).name !== this.titleName) this.buildNameTag();

    // 2. Nội suy vị trí người chơi khác
    if (!this.isSelf) {
      const k = 1 - Math.exp(-delta * 12);
      this.group.position.lerp(this.targetPos, k);
      let diffRy = this.targetRy - this.group.rotation.y;
      while (diffRy > Math.PI) diffRy -= Math.PI * 2;
      while (diffRy < -Math.PI) diffRy += Math.PI * 2;
      this.group.rotation.y += diffRy * k;
    }

    // 3. Đổi hành động -> bắt đầu đếm lại thời gian
    if (this.currentAnim !== this.lastAnim) {
      this.lastAnim = this.currentAnim;
      this.animTime = 0;
      this.finishedNotified = false;
      this.lastBeat = -1;
    } else {
      this.animTime += delta;
    }

    let anim = this.currentAnim;
    const duration = ACTION_DURATION[anim];
    if (duration !== undefined && this.animTime >= duration) {
      if (!this.finishedNotified) {
        this.finishedNotified = true;
        this.onActionFinished?.(anim);
      }
      anim = 'idle';
    }

    const target = this.computePose(anim, this.animTime, elapsed);
    const fast = anim === 'walk' || anim === 'run' || anim === 'wooden_fish' || anim === 'drum' || anim === 'wave';
    this.applyPose(target, 1 - Math.exp(-delta * (fast ? 20 : 8)));
  }

  // Phát sự kiện âm thanh một lần cho mỗi "nhịp"
  private beat(index: number, type: AvatarSoundEvent) {
    if (index > this.lastBeat) {
      this.lastBeat = index;
      this.onSound?.(type, this);
    }
  }

  // Ngồi xếp bằng (thiền, gõ mõ)
  private static seated(p: Pose) {
    p.hipY = -0.3;
    p.skirtY = 0.3;
    p.skirtXZ = 1.3;
    p.lap = 1;
    p.feet = 0;
  }

  // Quỳ gối (lạy, thả đèn)
  private static kneel(p: Pose, k: number) {
    p.hipY = -0.22 * k;
    p.skirtY = 1 - 0.5 * k;
    p.skirtXZ = 1 + 0.12 * k;
    p.feet = 1 - k;
  }

  private computePose(anim: ActionType, t: number, elapsed: number): Pose {
    const p: Pose = { ...IDLE_POSE };
    const show = { incense: false, flower: false, lantern: false, mo: false, mallet: false, drumL: false, drumR: false, broom: false };

    switch (anim) {
      case 'idle': {
        // Đứng thở nhẹ, thỉnh thoảng nghiêng đầu dễ thương
        const breath = Math.sin(elapsed * 2.0);
        setArms(p, ARM.idle);
        p.hipY = breath * 0.006;
        p.headX = breath * 0.025;
        p.headZ = Math.sin(elapsed * 0.45) * 0.06;
        p.lsz += breath * 0.02;
        p.rsz -= breath * 0.02;
        break;
      }

      case 'walk':
      case 'run': {
        // Bước chân lộ dưới gấu áo, tay vung nhẹ, người nhún và lắc
        const rate = anim === 'run' ? 12 : 8;
        const amp = anim === 'run' ? 1 : 0.65;
        const s = Math.sin(elapsed * rate);
        const c = Math.cos(elapsed * rate);
        setArms(p, ARM.idle);
        p.hipY = Math.abs(c) * 0.03 * amp;
        p.bend = anim === 'run' ? 0.16 : 0.04;
        p.sway = s * 0.04 * amp;
        p.headZ = -s * 0.03;
        p.lsx = 0.25 - s * 0.6 * amp;
        p.rsx = 0.25 + s * 0.6 * amp;
        p.le = -0.9 - Math.max(0, s) * 0.4 * amp;
        p.re = -0.9 - Math.max(0, -s) * 0.4 * amp;
        p.footL = s * 0.13 * amp;
        p.footR = -s * 0.13 * amp;
        p.liftL = Math.max(0, c) * 0.05 * amp;
        p.liftR = Math.max(0, -c) * 0.05 * amp;
        break;
      }

      case 'namaste': {
        // Chắp tay trước ngực, cúi đầu nhẹ, thỉnh thoảng nhắm mắt
        setArms(p, ARM.pray);
        p.palms = 1;
        p.headX = 0.16;
        p.bend = 0.05 + Math.sin(elapsed * 1.3) * 0.012;
        p.eyes = Math.sin(elapsed * 0.7) > -0.3 ? 1 : 0;
        break;
      }

      case 'bow': {
        // Quỳ xuống chắp tay, rồi lạy sát đất 3 lạy (mỗi lạy có tiếng khánh)
        PlayerAvatar.kneel(p, smooth(t / 0.5));
        const cycle = Math.max(0, t - 0.5);
        const idx = Math.floor(cycle / 1.9);
        const c = idx < 3 ? (cycle % 1.9) / 1.9 : 1;
        const down = idx < 3 ? smooth(c / 0.4) * (1 - smooth((c - 0.65) / 0.35)) : 0;
        setArms(p, mixArm(ARM.pray, ARM.bowDown, down));
        p.palms = 1 - down;
        p.bend = 1.05 * down;
        p.headX = 0.15 + 0.35 * down;
        p.eyes = 0;
        if (idx < 3 && c > 0.4) this.beat(idx, 'chime');
        break;
      }

      case 'incense': {
        // Chắp tay kẹp 3 nén hương, vái 3 vái ngang trán
        const idx = Math.floor(t / 1.5);
        const c = idx < 3 ? (t % 1.5) / 1.5 : 0;
        const raise = idx < 3 ? Math.sin(c * Math.PI) : 0;
        setArms(p, mixArm(ARM.pray, ARM.prayHigh, raise));
        p.bend = 0.22 * raise;
        p.headX = 0.08 + 0.12 * raise;
        p.eyes = raise > 0.4 ? 0 : 1;
        p.palms = 1;
        // Nghiêng tay ra trước để nén hương chĩa lên phía trước, không bị đầu che
        this.palms.rotation.x = 0.15 + 0.55 * raise;
        show.incense = t < 4.8;
        break;
      }

      case 'flower': {
        // Hai tay nâng đóa sen ngang ngực, cúi dâng lên bàn thờ
        const offer = smooth((t - 1.2) / 0.8) * (1 - smooth((t - 2.7) / 0.6));
        setArms(p, mixArm(ARM.hold, ARM.holdUp, offer));
        p.bend = 0.08 + 0.32 * offer;
        p.headX = 0.12 + 0.2 * offer;
        show.flower = t < 2.6;
        this.props.flower.position.set(0, 0.24 + offer * 0.09, 0.3 + offer * 0.05);
        break;
      }

      case 'wooden_fish': {
        // Ngồi xếp bằng, tay trái đặt lên mõ, tay phải gõ đều nhịp
        PlayerAvatar.seated(p);
        p.bend = 0.12;
        p.headX = 0.22;
        const period = 0.55;
        const phase = (t % period) / period;
        const strike = phase < 0.75 ? smooth(phase / 0.75) : 1 - smooth((phase - 0.75) / 0.25);
        setArms(p, ARM.moRest, mixArm(ARM.moDown, ARM.moUp, strike));
        p.eyes = 0;
        show.mo = true;
        show.mallet = true;
        if (phase > 0.95 || phase < 0.05) this.beat(Math.round(t / period), 'mo');
        break;
      }

      case 'meditate': {
        // Ngồi kiết già, hai bàn tay chồng trước bụng, nhắm mắt
        const breath = Math.sin(elapsed * 1.3);
        PlayerAvatar.seated(p);
        setArms(p, ARM.belly);
        p.hipY += breath * 0.006;
        p.headX = 0.12;
        p.eyes = 0;
        p.aura = 0.65 + breath * 0.2;
        break;
      }

      case 'bell': {
        // Hai tay nắm dây thừng trên cao, kéo xuống rồi thả cho chày đánh vào chuông
        const reach = smooth(t / 0.4);
        const pull = smooth((t - 0.35) / 0.4) * (1 - smooth((t - 0.85) / 0.25));
        setArms(p, mixArm(mixArm(ARM.idle, ARM.reachUp, reach), ARM.pullDown, pull));
        p.bend = -0.1 * reach + 0.14 * pull;
        p.headX = -0.25 * reach + 0.15 * pull;
        break;
      }

      case 'drum': {
        // Hai dùi thay nhau đánh 3 tiếng trống
        const hits = [0.6, 1.2, 1.8];
        let lift = 0.15;
        for (const h of hits) lift = Math.max(lift, pulse(t, h - 0.35, h));
        const leftTurn = Math.floor((t + 0.3) / 0.6) % 2 === 0;
        setArms(
          p,
          mixArm(ARM.drumLow, ARM.drumHigh, leftTurn ? lift : 0.1),
          mixArm(ARM.drumLow, ARM.drumHigh, leftTurn ? 0.1 : lift)
        );
        p.bend = 0.06;
        p.sway = leftTurn ? 0.03 : -0.03;
        show.drumL = true;
        show.drumR = true;
        break;
      }

      case 'lantern': {
        // Quỳ bên bờ hồ, hai tay nâng đèn rồi đẩy nhẹ xuống nước
        PlayerAvatar.kneel(p, smooth(t / 0.6));
        const release = smooth((t - 1.4) / 1.0);
        setArms(p, mixArm(ARM.holdLow, ARM.pushOut, release));
        p.bend = 0.25 + 0.4 * release;
        p.headX = 0.3;
        show.lantern = t < 2.6;
        this.props.lantern.position.set(0, 0.22, 0.32 + release * 0.04);
        break;
      }

      case 'sweep': {
        // Cúi người, hai tay cầm chổi tre quét qua lại sát mặt sân
        const active = smooth(t / 0.4) * (1 - smooth((t - 3.0) / 0.4));
        const swing = Math.sin(t * 4.4) * 0.55 * active;
        setArms(p, ARM.holdLow);
        p.lsy += swing * 0.35;
        p.rsy += swing * 0.35;
        p.lsx -= 0.15 * active;
        p.rsx -= 0.15 * active;
        p.bend = 0.3 * active;
        p.sway = -swing * 0.08;
        p.headX = 0.35 * active;
        p.footL = 0.06;
        p.footR = -0.04;
        show.broom = true;
        this.props.broom.rotation.set(-1.25 + 0.3 * (1 - active), swing, 0);
        break;
      }

      case 'wave': {
        // Giơ tay phải lên vẫy chào, đầu nghiêng
        const up = smooth(t / 0.3);
        setArms(p, ARM.idle);
        p.rsx = 0.37 - 0.62 * up;
        p.rsy = 0.17 + 0.13 * up;
        p.rsz = -0.54 - 1.9 * up;
        p.re = -0.94 * (1 - up) + (-0.5 + Math.sin(t * 11) * 0.45) * up;
        p.headZ = 0.14 * up;
        p.sway = -0.04 * up;
        break;
      }
    }

    for (const key of Object.keys(show) as (keyof typeof show)[]) this.props[key].visible = show[key];
    return p;
  }

  private applyPose(target: Pose, k: number) {
    const p = this.pose;
    for (const key of Object.keys(target) as (keyof Pose)[]) {
      p[key] += (target[key] - p[key]) * k;
    }

    this.hips.position.y = 0.42 + p.hipY;
    this.hips.rotation.set(p.bend, 0, p.sway);
    this.head.rotation.set(p.headX, 0, p.headZ);

    const { left, right } = this.arms;
    left.shoulder.rotation.set(p.lsx, p.lsy, p.lsz);
    left.elbow.rotation.x = p.le;
    right.shoulder.rotation.set(p.rsx, p.rsy, p.rsz);
    right.elbow.rotation.x = p.re;

    // Chắp tay: ẩn 2 bàn tay rời, hiện đôi tay áp vào nhau đúng giữa hai cổ tay
    const joined = p.palms > 0.6;
    left.hand.children[0].visible = left.hand.children[1].visible = !joined;
    right.hand.children[0].visible = right.hand.children[1].visible = !joined;
    this.palms.visible = joined;
    if (this.currentAnim !== 'incense') this.palms.rotation.x = 0.15;
    if (joined) {
      this.group.updateMatrixWorld(true);
      left.hand.getWorldPosition(this._v1);
      right.hand.getWorldPosition(this._v2);
      this.hips.worldToLocal(this._v1.add(this._v2).multiplyScalar(0.5));
      this.palms.position.copy(this._v1);
    }

    // Vạt áo co lại khi ngồi/quỳ, lắc nhẹ theo người
    this.skirt.scale.set(p.skirtXZ, p.skirtY, p.skirtXZ * 0.92);
    this.skirt.rotation.z = p.sway * 0.5;
    this.lap.visible = p.lap > 0.05;
    this.lap.scale.setScalar(Math.max(0.01, p.lap));

    const [footL, footR] = this.feet;
    footL.visible = footR.visible = p.feet > 0.1;
    footL.position.set(0.1, 0.035 + p.liftL, 0.06 + p.footL);
    footR.position.set(-0.1, 0.035 + p.liftR, 0.06 + p.footR);

    const mat = this.headMesh.material as THREE.MeshStandardMaterial;
    const faceMap = p.eyes < 0.5 ? this.faceClosed : this.faceOpen;
    if (mat.map !== faceMap) {
      mat.map = faceMap;
      mat.needsUpdate = true;
    }

    if (this.halo) this.halo.rotation.z += 0.004;

    const aura = this.meditationAura;
    aura.visible = p.aura > 0.02;
    if (aura.visible) {
      (aura.material as THREE.MeshBasicMaterial).opacity = p.aura;
      aura.rotation.z += 0.01;
      const s = 1 + (1 - p.aura) * 0.3;
      aura.scale.set(s, s, 1);
    }
  }

  public dispose() {
    this.group.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    for (const sprite of [this.nameSprite, this.bubbleSprite]) {
      if (sprite) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
    }
  }
}
