import * as THREE from 'three';
import type { PlayerData, ActionType, RobeColor } from '../types.js';

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
  wave: 2.6
};

export type AvatarSoundEvent = 'mo' | 'chime';

// Tư thế: mọi khớp được nội suy mượt từ tư thế hiện tại sang tư thế đích
interface Pose {
  hipY: number;      // hạ thấp hông khi quỳ / ngồi
  bend: number;      // cúi người về phía trước
  headX: number;     // cúi / ngẩng đầu
  headZ: number;     // nghiêng đầu
  lax: number; lay: number; laz: number; // tay trái
  rax: number; ray: number; raz: number; // tay phải
  llx: number; lly: number;              // chân trái
  rlx: number; rly: number;              // chân phải
  skirtY: number;    // vạt áo co lại khi ngồi
  skirtXZ: number;   // vạt áo xòe khi ngồi xếp bằng
  eyes: number;      // 1 = mở, 0 = nhắm
  aura: number;      // độ sáng hào quang thiền
}

const IDLE_POSE: Pose = {
  hipY: 0, bend: 0, headX: 0, headZ: 0,
  lax: 0, lay: 0, laz: 0.12,
  rax: 0, ray: 0, raz: -0.12,
  llx: 0, lly: 0, rlx: 0, rly: 0,
  skirtY: 1, skirtXZ: 1, eyes: 1, aura: 0
};

// Tay chắp trước ngực
const PRAY_ARMS = { lax: -1.3, lay: 0, laz: -0.74, rax: -1.3, ray: 0, raz: 0.74 };

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
// Xung 0 -> 1 -> 0 trong khoảng [a, b]
const pulse = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));

export class PlayerAvatar {
  public group: THREE.Group;
  public data: PlayerData;
  public isSelf: boolean;

  // Hệ khung: hông là gốc của thân trên (cúi lạy xoay quanh hông)
  private hips = new THREE.Group();
  private head = new THREE.Group();
  private leftArm = new THREE.Group();
  private rightArm = new THREE.Group();
  private leftLeg = new THREE.Group();
  private rightLeg = new THREE.Group();
  private skirt!: THREE.Mesh;
  private eyes: THREE.Object3D[] = [];
  private meditationAura!: THREE.Mesh;

  // Đạo cụ cầm trên tay
  private props: Record<'incense' | 'flower' | 'lantern' | 'mo' | 'mallet' | 'drumL' | 'drumR', THREE.Object3D> = {} as any;

  // Billboard tên và bong bóng chat
  private nameSprite: THREE.Sprite | null = null;
  private bubbleSprite: THREE.Sprite | null = null;
  private bubbleExpireTimer = 0;

  // Nội suy vị trí từ mạng
  public targetPos = new THREE.Vector3();
  public targetRy = 0;
  public currentAnim: ActionType = 'idle';

  // Thời gian chạy hành động hiện tại
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

  private buildMesh() {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf6d2b3, roughness: 0.75 });
    const robeHex = ROBE_COLORS[this.data.robe]?.hex || 0x5e371d;
    const robeMat = new THREE.MeshStandardMaterial({ color: robeHex, roughness: 0.8 });
    const robeDark = new THREE.MeshStandardMaterial({
      color: new THREE.Color(robeHex).multiplyScalar(0.62),
      roughness: 0.8
    });
    const sashMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });

    // Bóng mờ dưới chân giúp nhân vật "đứng" trên mặt đất
    const shadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.012;
    this.group.add(shadowMesh);

    // 1. Vạt áo dưới (gắn với thân gốc, không cúi theo khi lạy)
    const skirtProfile = [
      new THREE.Vector2(0.0, 0.06),
      new THREE.Vector2(0.37, 0.06),
      new THREE.Vector2(0.35, 0.18),
      new THREE.Vector2(0.3, 0.36),
      new THREE.Vector2(0.27, 0.46),
      new THREE.Vector2(0.0, 0.46)
    ];
    this.skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 20), robeMat);
    this.skirt.castShadow = true;
    this.group.add(this.skirt);

    // 2. Hông (gốc thân trên)
    this.hips.position.y = 0.42;
    this.group.add(this.hips);

    const torsoProfile = [
      new THREE.Vector2(0.0, -0.02),
      new THREE.Vector2(0.28, -0.02),
      new THREE.Vector2(0.27, 0.2),
      new THREE.Vector2(0.24, 0.4),
      new THREE.Vector2(0.17, 0.5),
      new THREE.Vector2(0.1, 0.53),
      new THREE.Vector2(0.0, 0.53)
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 20), robeMat);
    torso.scale.z = 0.85;
    torso.castShadow = true;
    this.hips.add(torso);

    // Cổ áo giao lĩnh viền trắng
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ec, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.24, 0.02), collarMat);
      collar.position.set(side * 0.055, 0.38, 0.2);
      collar.rotation.set(-0.25, 0, side * 0.5);
      this.hips.add(collar);
    }

    // Dải y vắt chéo vai
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.035, 6, 24), sashMat);
    sash.scale.z = 0.85;
    sash.rotation.set(Math.PI / 2.6, 0, -0.6);
    sash.position.y = 0.3;
    this.hips.add(sash);

    // Đai lưng
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.025, 6, 24), robeDark);
    belt.rotation.x = Math.PI / 2;
    belt.scale.y = 0.85;
    belt.position.y = 0.06;
    this.hips.add(belt);

    // 3. Đầu chibi
    this.head.position.y = 0.52;
    this.hips.add(this.head);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 20), skinMat);
    headMesh.position.y = 0.3;
    headMesh.castShadow = true;
    this.head.add(headMesh);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const ex of [-0.11, 0.11]) {
      const eye = new THREE.Group();
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), eyeMat);
      pupil.scale.z = 0.5;
      eye.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), shineMat);
      shine.position.set(0.014, 0.016, 0.02);
      eye.add(shine);
      eye.position.set(ex, 0.33, 0.315);
      eye.lookAt(ex * 3, 0.33, 2);
      this.head.add(eye);
      this.eyes.push(eye);
    }

    const blushMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.55, depthWrite: false });
    for (const bx of [-0.19, 0.19]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), blushMat);
      blush.scale.set(1.25, 0.7, 1);
      blush.position.set(bx, 0.24, 0.29);
      blush.lookAt(bx * 4, 0.24, 2);
      this.head.add(blush);
    }

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.011, 6, 12, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x9f1239 })
    );
    smile.rotation.z = Math.PI;
    smile.position.set(0, 0.22, 0.322);
    this.head.add(smile);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skinMat);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(side * 0.33, 0.29, 0);
      this.head.add(ear);
    }

    if (this.data.style === 'lay') {
      // Phật tử: tóc đen ôm đầu + búi tóc
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f1a17, roughness: 0.85 });
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.355, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
      hair.position.y = 0.31;
      hair.rotation.x = -0.45;
      this.head.add(hair);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), hairMat);
      bun.position.set(0, 0.62, -0.12);
      this.head.add(bun);
    } else {
      // Chú tiểu: chỏm đầu xanh nhạt và 6 chấm giới hương
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.343, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32),
        new THREE.MeshStandardMaterial({ color: 0xd9c2ae, roughness: 0.8 })
      );
      cap.position.y = 0.3;
      cap.rotation.x = -0.25;
      this.head.add(cap);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xb98a63 });
      for (let r = 0; r < 3; r++) {
        for (const dx of [-0.045, 0.045]) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), dotMat);
          dot.position.set(dx, 0.64, 0.04 - r * 0.07);
          this.head.add(dot);
        }
      }
    }

    // 4. Tay áo rộng + bàn tay (khớp vai). Mặt nhân vật hướng +z nên tay trái nằm bên +x.
    const sleeveGeo = new THREE.CylinderGeometry(0.075, 0.11, 0.32, 10);
    const handGeo = new THREE.SphereGeometry(0.068, 10, 8);
    for (const [arm, side] of [[this.leftArm, 1], [this.rightArm, -1]] as const) {
      const sleeve = new THREE.Mesh(sleeveGeo, robeMat);
      sleeve.position.y = -0.16;
      sleeve.castShadow = true;
      arm.add(sleeve);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.y = -0.37;
      arm.add(hand);
      arm.position.set(side * 0.27, 0.43, 0.03);
      this.hips.add(arm);
    }

    // 5. Chân + giày (xoay theo thứ tự YXZ để ngồi xếp bằng được)
    const legGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.3, 8);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3f2e22, roughness: 0.9 });
    const shoeGeo = new THREE.BoxGeometry(0.13, 0.08, 0.2);
    for (const [leg, side] of [[this.leftLeg, 1], [this.rightLeg, -1]] as const) {
      leg.rotation.order = 'YXZ';
      const legMesh = new THREE.Mesh(legGeo, robeDark);
      legMesh.position.y = -0.15;
      leg.add(legMesh);
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(0, -0.34, 0.04);
      leg.add(shoe);
      leg.position.set(side * 0.13, 0.38, 0);
      this.group.add(leg);
    }

    // 6. Vòng hào quang thiền định (ẩn khi không thiền)
    this.meditationAura = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.85, 40),
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

    // 3 nén hương cầm trước trán
    const incense = new THREE.Group();
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 });
    const tipGlow = glowSpriteMat(0xff6a1a);
    for (let i = -1; i <= 1; i++) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 5), stickMat);
      stick.position.set(i * 0.025, 0.18, 0);
      stick.rotation.z = i * 0.08;
      incense.add(stick);
      const tip = new THREE.Sprite(tipGlow);
      tip.scale.set(0.06, 0.06, 1);
      tip.position.set(i * 0.042, 0.39, 0);
      incense.add(tip);
    }
    this.hips.add(incense);
    this.props.incense = incense;

    // Hoa sen dâng cúng
    const flower = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.5, emissive: 0xf472b6, emissiveIntensity: 0.15 });
    for (let i = 0; i < 8; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), petalMat);
      petal.scale.set(0.7, 1.5, 0.35);
      const a = (i / 8) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.05, 0.05, Math.sin(a) * 0.05);
      petal.rotation.order = 'YXZ';
      petal.rotation.set(0.45, -a + Math.PI / 2, 0);
      flower.add(petal);
    }
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    pod.position.y = 0.07;
    flower.add(pod);
    this.hips.add(flower);
    this.props.flower = flower;

    // Đèn hoa đăng cầm trên tay
    const lantern = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x4d7c0f }));
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

    // Mõ gỗ đặt dưới đất trước mặt + dùi mõ trên tay phải
    const mo = new THREE.Group();
    const moBody = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: 0x8b2e16, roughness: 0.45 }));
    moBody.scale.set(1.1, 0.8, 0.95);
    mo.add(moBody);
    const moMouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0x1c0d06 }));
    moMouth.position.set(0, -0.02, 0.16);
    moMouth.rotation.z = Math.PI;
    mo.add(moMouth);
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
    cushion.position.y = -0.14;
    mo.add(cushion);
    mo.position.set(0, 0.16, 0.5);
    this.group.add(mo);
    this.props.mo = mo;

    // Dùi nối dài theo hướng cánh tay (trục -y của khớp vai)
    const mallet = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), woodDark);
    handle.position.y = -0.15;
    mallet.add(handle);
    const malletHead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), woodDark);
    malletHead.position.y = -0.3;
    mallet.add(malletHead);
    mallet.position.y = -0.36;
    this.rightArm.add(mallet);
    this.props.mallet = mallet;

    // Dùi trống hai tay
    for (const [key, arm] of [['drumL', this.leftArm], ['drumR', this.rightArm]] as const) {
      const stick = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.45, 6), woodDark);
      body.position.y = -0.2;
      stick.add(body);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
      knob.position.y = -0.42;
      stick.add(knob);
      stick.position.y = -0.36;
      arm.add(stick);
      this.props[key] = stick;
    }

    for (const p of Object.values(this.props)) p.visible = false;
  }

  // ===================== BILLBOARD TÊN NGƯỜI CHƠI =====================
  private buildNameTag() {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    const text = this.data.name || 'Phật tử';

    ctx.font = 'bold 30px "Be Vietnam Pro", sans-serif';
    const w = Math.min(360, ctx.measureText(text).width + 48);
    const x = (384 - w) / 2;

    ctx.fillStyle = this.isSelf ? 'rgba(180, 83, 9, 0.92)' : 'rgba(28, 25, 23, 0.78)';
    ctx.strokeStyle = this.isSelf ? '#fde68a' : 'rgba(253, 230, 138, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, 14, w, 52, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fffbeb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 192, 41, 330);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    this.nameSprite.scale.set(1.25, 0.26, 1);
    this.nameSprite.position.set(0, 1.62, 0);
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
    this.bubbleSprite.position.set(0, 2.15, 0);
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
    this.applyPose(target, 1 - Math.exp(-delta * (fast ? 22 : 9)));
  }

  // Phát sự kiện âm thanh một lần cho mỗi "nhịp"
  private beat(index: number, type: AvatarSoundEvent) {
    if (index > this.lastBeat) {
      this.lastBeat = index;
      this.onSound?.(type, this);
    }
  }

  private computePose(anim: ActionType, t: number, elapsed: number): Pose {
    const p: Pose = { ...IDLE_POSE };
    const show = { incense: false, flower: false, lantern: false, mo: false, mallet: false, drumL: false, drumR: false };

    switch (anim) {
      case 'idle': {
        const breath = Math.sin(elapsed * 2.2);
        p.hipY = breath * 0.008;
        p.headX = breath * 0.03;
        p.laz = 0.12 + breath * 0.02;
        p.raz = -0.12 - breath * 0.02;
        break;
      }

      case 'walk':
      case 'run': {
        const rate = anim === 'run' ? 13 : 8.5;
        const amp = anim === 'run' ? 1 : 0.62;
        const s = Math.sin(elapsed * rate);
        p.hipY = Math.abs(Math.cos(elapsed * rate)) * 0.035 * amp;
        p.bend = anim === 'run' ? 0.18 : 0.05;
        p.lax = s * 0.75 * amp;
        p.rax = -s * 0.75 * amp;
        p.laz = 0.15;
        p.raz = -0.15;
        p.llx = -s * 0.65 * amp;
        p.rlx = s * 0.65 * amp;
        break;
      }

      case 'namaste': {
        // Chắp tay trước ngực, đầu hơi cúi
        Object.assign(p, PRAY_ARMS);
        p.headX = 0.18;
        p.bend = 0.06 + Math.sin(elapsed * 1.4) * 0.015;
        break;
      }

      case 'bow': {
        // Quỳ xuống rồi lạy 3 lạy (mỗi lạy 2 giây), mỗi lạy có tiếng khánh
        const kneel = smooth(t / 0.5);
        p.hipY = -0.24 * kneel;
        p.llx = 1.45 * kneel;
        p.rlx = 1.45 * kneel;
        p.skirtY = 1 - 0.45 * kneel;
        p.skirtXZ = 1 + 0.15 * kneel;

        const cycle = Math.max(0, t - 0.4);
        const idx = Math.floor(cycle / 1.9);
        const c = idx < 3 ? (cycle % 1.9) / 1.9 : 1;
        const down = idx < 3 ? smooth(c / 0.4) * (1 - smooth((c - 0.65) / 0.35)) : 0;
        p.bend = 1.15 * down;
        p.headX = 0.2 + 0.3 * down;
        p.lax = -1.3 - 0.45 * down;
        p.rax = -1.3 - 0.45 * down;
        p.laz = -0.74 + 0.5 * down;
        p.raz = 0.74 - 0.5 * down;
        p.eyes = 1 - down;
        if (idx < 3 && c > 0.4) this.beat(idx, 'chime');
        break;
      }

      case 'incense': {
        // Chắp tay cầm 3 nén hương, vái 3 vái ngang trán
        Object.assign(p, PRAY_ARMS);
        const idx = Math.floor(t / 1.5);
        const c = idx < 3 ? (t % 1.5) / 1.5 : 0;
        const raise = idx < 3 ? Math.sin(c * Math.PI) : 0;
        p.lax = -1.3 - 0.55 * raise;
        p.rax = -1.3 - 0.55 * raise;
        p.bend = 0.3 * raise;
        p.headX = 0.15 + 0.25 * raise;
        p.eyes = 1 - raise * 0.8;
        show.incense = t < 4.8;
        this.props.incense.position.set(0, 0.36 + raise * 0.14, 0.33);
        break;
      }

      case 'flower': {
        // Hai tay nâng đóa sen ngang ngực, cúi dâng rồi đặt lên bàn thờ
        const offer = smooth((t - 1.2) / 0.8) * (1 - smooth((t - 2.7) / 0.6));
        p.lax = -1.45 - 0.2 * offer;
        p.rax = -1.45 - 0.2 * offer;
        p.laz = -0.62;
        p.raz = 0.62;
        p.bend = 0.12 + 0.35 * offer;
        p.headX = 0.1 + 0.2 * offer;
        show.flower = t < 2.6;
        this.props.flower.position.set(0, 0.42 + offer * 0.08, 0.42 + offer * 0.08);
        break;
      }

      case 'wooden_fish': {
        // Ngồi xếp bằng, tay trái giữ mõ, tay phải gõ đều nhịp
        p.hipY = -0.27;
        p.llx = -1.45; p.lly = -0.95;
        p.rlx = -1.45; p.rly = 0.95;
        p.skirtY = 0.42;
        p.skirtXZ = 1.35;
        p.bend = 0.12;
        p.headX = 0.25;
        p.lax = -0.75; p.laz = -0.35;
        const period = 0.55;
        const phase = (t % period) / period;
        const strike = phase < 0.75 ? smooth(phase / 0.75) : 1 - smooth((phase - 0.75) / 0.25);
        p.rax = -0.65 - 0.65 * strike;
        p.raz = 0.3;
        p.eyes = 0.15;
        show.mo = true;
        show.mallet = true;
        if (phase > 0.95 || phase < 0.05) this.beat(Math.round(t / period), 'mo');
        break;
      }

      case 'meditate': {
        // Ngồi kiết già, tay đặt trong lòng, nhắm mắt, hào quang tỏa sáng
        const breath = Math.sin(elapsed * 1.3);
        p.hipY = -0.27 + breath * 0.006;
        p.llx = -1.45; p.lly = -0.95;
        p.rlx = -1.45; p.rly = 0.95;
        p.skirtY = 0.42;
        p.skirtXZ = 1.35;
        p.lax = -0.6; p.laz = -0.55;
        p.rax = -0.6; p.raz = 0.55;
        p.headX = 0.1;
        p.eyes = 0;
        p.aura = 0.65 + breath * 0.2;
        break;
      }

      case 'bell': {
        // Hai tay nắm dây kéo chày gỗ về sau rồi thả cho chày đánh vào chuông
        const pull = smooth(t / 0.6) * (1 - smooth((t - 0.75) / 0.2));
        const reach = smooth(t / 0.4);
        p.lax = -1.9 * reach + 0.7 * pull;
        p.rax = -1.9 * reach + 0.7 * pull;
        p.laz = -0.35;
        p.raz = 0.35;
        p.bend = -0.12 * pull + 0.1 * smooth((t - 1.0) / 0.3);
        p.headX = -0.15 * reach;
        break;
      }

      case 'drum': {
        // Hai dùi đánh 3 tiếng trống
        const hits = [0.6, 1.2, 1.8];
        let lift = 0.3;
        for (const h of hits) lift = Math.max(lift, pulse(t, h - 0.35, h));
        const left = Math.floor((t + 0.3) / 0.6) % 2 === 0;
        p.lax = -1.25 - (left ? lift * 0.9 : 0.2);
        p.rax = -1.25 - (left ? 0.2 : lift * 0.9);
        p.laz = -0.2;
        p.raz = 0.2;
        p.bend = 0.08;
        show.drumL = true;
        show.drumR = true;
        break;
      }

      case 'lantern': {
        // Quỳ bên bờ hồ, hai tay nâng đèn hoa đăng rồi thả xuống nước
        const kneel = smooth(t / 0.6);
        p.hipY = -0.24 * kneel;
        p.llx = 1.45 * kneel;
        p.rlx = 1.45 * kneel;
        p.skirtY = 1 - 0.45 * kneel;
        const release = smooth((t - 1.4) / 1.0);
        p.bend = 0.25 + 0.4 * release;
        p.headX = 0.3;
        p.lax = -1.0 - 0.3 * release;
        p.rax = -1.0 - 0.3 * release;
        p.laz = -0.6;
        p.raz = 0.6;
        show.lantern = t < 2.6;
        this.props.lantern.position.set(0, 0.2 + 0.05 * (1 - release), 0.42 + release * 0.12);
        break;
      }

      case 'wave': {
        // Vẫy tay phải chào mọi người
        const up = smooth(t / 0.3);
        p.rax = -0.35 * up;
        p.raz = -2.75 * up + Math.sin(t * 11) * 0.3 * up;
        p.headZ = 0.12 * up;
        p.laz = 0.15;
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
    this.hips.rotation.x = p.bend;
    this.head.rotation.set(p.headX, 0, p.headZ);
    this.leftArm.rotation.set(p.lax, p.lay, p.laz);
    this.rightArm.rotation.set(p.rax, p.ray, p.raz);
    this.leftLeg.rotation.set(p.llx, p.lly, 0);
    this.rightLeg.rotation.set(p.rlx, p.rly, 0);
    this.leftLeg.position.y = 0.38 + p.hipY;
    this.rightLeg.position.y = 0.38 + p.hipY;
    this.skirt.scale.set(p.skirtXZ, p.skirtY, p.skirtXZ);
    for (const eye of this.eyes) eye.scale.y = Math.max(0.12, p.eyes);

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
