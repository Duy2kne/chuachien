import * as THREE from 'three';
import type { PlayerData, ActionType, RobeColor, AvatarStyle } from '../types.js';

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

export class PlayerAvatar {
  public group: THREE.Group;
  public data: PlayerData;
  public isSelf: boolean;

  // Cấu trúc phân cấp các bộ phận để làm hoạt ảnh
  private head: THREE.Group;
  private torso: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private meditationAura: THREE.Mesh | null = null;
  private holdingItem: THREE.Group | null = null;

  // Billboard tên và bong bóng chat
  private nameSprite: THREE.Sprite | null = null;
  private bubbleSprite: THREE.Sprite | null = null;
  private bubbleExpireTimer = 0;

  // Nội suy vị trí từ mạng
  public targetPos = new THREE.Vector3();
  public targetRy = 0;
  public currentAnim: ActionType = 'idle';
  private animTimer = 0;
  private bowCycle = 0;

  constructor(data: PlayerData, isSelf = false) {
    this.data = data;
    this.isSelf = isSelf;
    this.group = new THREE.Group();
    this.group.position.set(data.x, data.y || 0, data.z);
    this.group.rotation.y = data.ry;
    this.targetPos.copy(this.group.position);
    this.targetRy = data.ry;
    this.currentAnim = data.anim || 'idle';

    // Tạo các nhóm bộ phận
    this.head = new THREE.Group();
    this.torso = new THREE.Group();
    this.leftArm = new THREE.Group();
    this.rightArm = new THREE.Group();
    this.leftLeg = new THREE.Group();
    this.rightLeg = new THREE.Group();

    this.buildMesh();
    this.buildNameTag();
  }

  private buildMesh() {
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf9d6b8, // Da hồng hào hiền hòa
      roughness: 0.8
    });

    const robeHex = ROBE_COLORS[this.data.robe]?.hex || 0x5e371d;
    const robeMat = new THREE.MeshStandardMaterial({
      color: robeHex,
      roughness: 0.75
    });

    const sashMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Dải y vắt chéo màu vàng nghệ
      roughness: 0.7
    });

    // 1. Thân áo tràng (torso)
    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.38, 0.65, 12);
    const torsoMesh = new THREE.Mesh(torsoGeo, robeMat);
    torsoMesh.position.y = 0.325;
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);

    // Cổ áo giao lĩnh viền trắng thanh nhã như trong ảnh mẫu
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6
    });
    const collarLeft = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.28, 0.02), collarMat);
    collarLeft.position.set(-0.065, 0.52, 0.24);
    collarLeft.rotation.z = -0.55;
    this.torso.add(collarLeft);

    const collarRight = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.28, 0.02), collarMat);
    collarRight.position.set(0.065, 0.52, 0.24);
    collarRight.rotation.z = 0.55;
    this.torso.add(collarRight);

    // Dải y vắt chéo qua vai màu vàng nghệ đậm nổi bật
    const sashGeo = new THREE.TorusGeometry(0.27, 0.042, 8, 16);
    const sashMesh = new THREE.Mesh(sashGeo, sashMat);
    sashMesh.rotation.x = Math.PI / 3.8;
    sashMesh.rotation.y = Math.PI / 5;
    sashMesh.position.y = 0.42;
    this.torso.add(sashMesh);

    this.torso.position.y = 0.4;
    this.group.add(this.torso);

    // 2. Đầu to tròn chibi
    const headGeo = new THREE.SphereGeometry(0.34, 18, 18);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Mắt to có điểm sáng trắng (Catchlight)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (const ex of [-0.11, 0.11]) {
      // Con ngươi đen tròn to
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), eyeMat);
      eye.position.set(ex, 0.04, 0.3);
      this.head.add(eye);

      // Điểm sáng lấp lánh trong mắt (sparkle catchlight)
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), shineMat);
      shine.position.set(ex + 0.012, 0.055, 0.33);
      this.head.add(shine);
    }

    // Má hồng phấn dễ thương
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.75 });
    for (const bx of [-0.18, 0.18]) {
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), blushMat);
      blush.scale.set(1.2, 0.65, 0.5);
      blush.position.set(bx, -0.06, 0.28);
      this.head.add(blush);
    }

    // Miệng cười nhỏ hiền hậu
    const smileGeo = new THREE.TorusGeometry(0.065, 0.012, 6, 12, Math.PI * 0.85);
    const smileMat = new THREE.MeshBasicMaterial({ color: 0x991b1b });
    const smile = new THREE.Mesh(smileGeo, smileMat);
    smile.rotation.x = Math.PI / 1.8;
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.1, 0.315);
    this.head.add(smile);

    // Đĩa bóng đổ dưới chân (Contact shadow) giúp nhân vật luôn grounded
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.015;
    this.group.add(shadowMesh);

    // Kiểu tóc: "monk" (Chú tiểu đầu trọc) hoặc "lay" (Phật tử búi tóc)
    if (this.data.style === 'lay') {
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
      // Tóc gọn và búi tròn đỉnh đầu
      const bunGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.position.set(0, 0.35, -0.05);
      this.head.add(bun);
    } else {
      // Chú tiểu: 6 chấm giới hương nhạt
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xe2b48d });
      for (let r = 0; r < 3; r++) {
        for (const dx of [-0.04, 0.04]) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), dotMat);
          dot.position.set(dx, 0.31, 0.05 - r * 0.06);
          this.head.add(dot);
        }
      }
    }

    this.head.position.y = 0.95;
    this.group.add(this.head);

    // 3. Tay áo rộng và bàn tay
    const armGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.38, 8);
    const handGeo = new THREE.SphereGeometry(0.065, 8, 8);

    // Tay trái
    const leftArmMesh = new THREE.Mesh(armGeo, robeMat);
    leftArmMesh.position.y = -0.19;
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.y = -0.38;
    this.leftArm.add(leftArmMesh);
    this.leftArm.add(leftHand);
    this.leftArm.position.set(-0.28, 0.82, 0);
    this.group.add(this.leftArm);

    // Tay phải
    const rightArmMesh = new THREE.Mesh(armGeo, robeMat);
    rightArmMesh.position.y = -0.19;
    const rightHand = new THREE.Mesh(handGeo, skinMat);
    rightHand.position.y = -0.38;
    this.rightArm.add(rightArmMesh);
    this.rightArm.add(rightHand);
    this.rightArm.position.set(0.28, 0.82, 0);
    this.group.add(this.rightArm);

    // 4. Chân và vạt áo dưới
    const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.35, 8);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3f2e22, roughness: 0.9 });
    const shoeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.18);

    // Chân trái
    const lLegMesh = new THREE.Mesh(legGeo, robeMat);
    lLegMesh.position.y = -0.175;
    const lShoe = new THREE.Mesh(shoeGeo, shoeMat);
    lShoe.position.set(0, -0.35, 0.04);
    this.leftLeg.add(lLegMesh);
    this.leftLeg.add(lShoe);
    this.leftLeg.position.set(-0.14, 0.4, 0);
    this.group.add(this.leftLeg);

    // Chân phải
    const rLegMesh = new THREE.Mesh(legGeo, robeMat);
    rLegMesh.position.y = -0.175;
    const rShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rShoe.position.set(0, -0.35, 0.04);
    this.rightLeg.add(rLegMesh);
    this.rightLeg.add(rShoe);
    this.rightLeg.position.set(0.14, 0.4, 0);
    this.group.add(this.rightLeg);

    // 5. Hào quang thiền định (ẩn mặc định, hiện khi ngồi thiền)
    const auraGeo = new THREE.RingGeometry(0.65, 0.95, 24);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.meditationAura = new THREE.Mesh(auraGeo, auraMat);
    this.meditationAura.rotation.x = -Math.PI / 2;
    this.meditationAura.position.y = 0.05;
    this.meditationAura.visible = false;
    this.group.add(this.meditationAura);

    // 6. Nhóm vật phẩm cầm trên tay (hương, hoa, mõ)
    this.holdingItem = new THREE.Group();
    this.group.add(this.holdingItem);
  }

  // ===================== BILLBOARD TÊN NGƯỜI CHƠI =====================
  private buildNameTag() {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    // Nền viên thuốc bo tròn màu hổ phách / đen mờ tinh tế như trong ảnh mẫu
    const text = this.data.name || 'Phật tử';
    ctx.fillStyle = this.isSelf ? 'rgba(217, 119, 6, 0.92)' : 'rgba(24, 24, 27, 0.85)';
    ctx.strokeStyle = this.isSelf ? '#fef08a' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;

    const r = 20;
    const w = 280;
    const h = 42;
    const x = 20;
    const y = 15;

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    // Chấm biểu tượng online xanh ngọc nếu là người khác
    if (!this.isSelf) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(38, 36, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Chữ tên người chơi
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 160, 36);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    this.nameSprite = new THREE.Sprite(spriteMat);
    this.nameSprite.scale.set(1.1, 0.25, 1);
    this.nameSprite.position.set(0, 1.42, 0);
    this.group.add(this.nameSprite);
  }

  // ===================== BONG BÓNG LỜI NÓI (SPEECH BUBBLE) =====================
  public showSpeechBubble(text: string) {
    if (this.bubbleSprite) {
      this.group.remove(this.bubbleSprite);
      this.bubbleSprite.material.dispose();
      this.bubbleSprite = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    // Bong bóng trắng viền vàng
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 100, 24);
    ctx.fill();
    ctx.stroke();

    // Mũi nhọn bong bóng trỏ xuống đầu
    ctx.beginPath();
    ctx.moveTo(240, 116);
    ctx.lineTo(256, 145);
    ctx.lineTo(272, 116);
    ctx.fill();
    ctx.stroke();

    // Nội dung chat
    ctx.fillStyle = '#1c1917';
    ctx.font = '500 24px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Cắt ngắn nếu quá dài
    const display = text.length > 32 ? text.substring(0, 30) + '...' : text;
    ctx.fillText(display, 256, 66);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    this.bubbleSprite = new THREE.Sprite(spriteMat);
    this.bubbleSprite.scale.set(2.4, 0.75, 1);
    this.bubbleSprite.position.set(0, 2.05, 0);
    this.group.add(this.bubbleSprite);

    this.bubbleExpireTimer = 6.0; // Hiện 6 giây
  }

  // ===================== CẬP NHẬT HOẠT ẢNH & NỘI SUY MẠNG =====================
  public update(delta: number, elapsed: number) {
    this.animTimer += delta;

    // 1. Giảm thời gian hiển thị bong bóng chat
    if (this.bubbleSprite) {
      this.bubbleExpireTimer -= delta;
      if (this.bubbleExpireTimer <= 0) {
        this.group.remove(this.bubbleSprite);
        this.bubbleSprite.material.dispose();
        this.bubbleSprite = null;
      }
    }

    // 2. Nội suy vị trí đối với người chơi khác
    if (!this.isSelf) {
      // Nội suy mượt mà tránh giật lag mạng (Exponential damping)
      this.group.position.lerp(this.targetPos, Math.min(1, delta * 14));

      // Nội suy góc quay
      let diffRy = this.targetRy - this.group.rotation.y;
      while (diffRy > Math.PI) diffRy -= Math.PI * 2;
      while (diffRy < -Math.PI) diffRy += Math.PI * 2;
      this.group.rotation.y += diffRy * Math.min(1, delta * 12);
    }

    // 3. Thi hành hoạt ảnh tương ứng
    this.animatePose(this.currentAnim, delta, elapsed);
  }

  private animatePose(anim: ActionType, delta: number, elapsed: number) {
    // Reset các biến dạng cơ bản
    const speed = 8.0;

    switch (anim) {
      case 'idle':
        // Đứng thở nhẹ nhàng: lồng ngực và đầu nhấp nhô rất êm
        this.torso.position.y = 0.4 + Math.sin(elapsed * 2.2) * 0.015;
        this.head.position.y = 0.95 + Math.sin(elapsed * 2.2) * 0.015;
        this.leftArm.rotation.set(0, 0, 0.1);
        this.rightArm.rotation.set(0, 0, -0.1);
        this.leftLeg.rotation.set(0, 0, 0);
        this.rightLeg.rotation.set(0, 0, 0);
        if (this.meditationAura) this.meditationAura.visible = false;
        break;

      case 'walk':
      case 'run': {
        const rate = anim === 'run' ? 14.0 : 8.5;
        const armAmp = anim === 'run' ? 0.75 : 0.45;
        const legAmp = anim === 'run' ? 0.85 : 0.5;

        // Cơ thể nhún nhảy theo bước chân
        const bounce = Math.abs(Math.sin(elapsed * rate)) * 0.04;
        this.torso.position.y = 0.4 + bounce;
        this.head.position.y = 0.95 + bounce;

        // Vung tay đối xứng bước chân
        this.leftArm.rotation.x = Math.sin(elapsed * rate) * armAmp;
        this.rightArm.rotation.x = -Math.sin(elapsed * rate) * armAmp;
        this.leftLeg.rotation.x = -Math.sin(elapsed * rate) * legAmp;
        this.rightLeg.rotation.x = Math.sin(elapsed * rate) * legAmp;
        if (this.meditationAura) this.meditationAura.visible = false;
        break;
      }

      case 'namaste':
        // Chắp hai tay trước ngực
        this.torso.position.y = 0.4;
        this.head.position.y = 0.94;
        this.head.rotation.x = 0.12; // Cúi đầu cung kính nhẹ
        this.leftArm.rotation.set(0.9, 0.6, 0.7);
        this.rightArm.rotation.set(0.9, -0.6, -0.7);
        this.leftLeg.rotation.set(0, 0, 0);
        this.rightLeg.rotation.set(0, 0, 0);
        if (this.meditationAura) this.meditationAura.visible = false;
        break;

      case 'bow':
        // Lạy Phật (quỳ phủ phục 3 lần)
        this.bowCycle += delta * 1.8;
        const bowT = (Math.sin(this.bowCycle) + 1) / 2; // 0 (đứng/ngồi) -> 1 (lạy sát đất)
        this.torso.position.y = 0.25 - bowT * 0.15;
        this.head.position.y = 0.65 - bowT * 0.35;
        this.head.rotation.x = bowT * 1.2;
        this.torso.rotation.x = bowT * 0.9;
        this.leftArm.rotation.set(bowT * 1.4, 0.2, 0.2);
        this.rightArm.rotation.set(bowT * 1.4, -0.2, -0.2);
        this.leftLeg.rotation.set(1.4, 0, 0);
        this.rightLeg.rotation.set(1.4, 0, 0);
        break;

      case 'incense': {
        // Cầm 3 nén hương vái trán
        const bowSin = Math.sin(elapsed * 4);
        this.torso.rotation.x = bowSin * 0.15;
        this.head.rotation.x = bowSin * 0.2;
        this.leftArm.rotation.set(1.3, 0.4, 0.3);
        this.rightArm.rotation.set(1.3, -0.4, -0.3);
        break;
      }

      case 'flower':
        // Hai tay nâng đóa hoa sen dâng cúng
        this.torso.position.y = 0.4;
        this.head.rotation.x = 0.1;
        this.leftArm.rotation.set(1.1, 0.3, 0.2);
        this.rightArm.rotation.set(1.1, -0.3, -0.2);
        break;

      case 'wooden_fish':
        // Ngồi xếp bằng gõ mõ
        this.torso.position.y = 0.2;
        this.head.position.y = 0.75;
        this.leftLeg.rotation.set(1.5, 0.4, 0);
        this.rightLeg.rotation.set(1.5, -0.4, 0);
        this.leftArm.rotation.set(0.6, 0.3, 0);
        // Tay phải gõ dùi mõ theo nhịp
        this.rightArm.rotation.set(0.6 + Math.abs(Math.sin(elapsed * 6)) * 0.4, -0.2, 0);
        break;

      case 'meditate':
        // Ngồi kiết già tĩnh lặng, hào quang tỏa sáng
        this.torso.position.y = 0.2 + Math.sin(elapsed * 1.5) * 0.008;
        this.head.position.y = 0.75;
        this.head.rotation.x = 0.08;
        this.leftLeg.rotation.set(1.5, 0.4, 0);
        this.rightLeg.rotation.set(1.5, -0.4, 0);
        // Hai tay đặt thủ ấn trên đùi
        this.leftArm.rotation.set(0.6, 0.5, 0.3);
        this.rightArm.rotation.set(0.6, -0.5, -0.3);

        if (this.meditationAura) {
          this.meditationAura.visible = true;
          this.meditationAura.rotation.z += delta * 0.8;
          const auraScale = 1.0 + Math.sin(elapsed * 2.5) * 0.08;
          this.meditationAura.scale.set(auraScale, auraScale, 1);
        }
        break;

      case 'bell':
        // Động tác kéo chày thỉnh chuông
        this.torso.position.y = 0.4;
        this.leftArm.rotation.set(0.3, 0.2, 0);
        this.rightArm.rotation.set(1.4, -0.3, Math.sin(elapsed * 5) * 0.3);
        break;

      case 'drum':
        // Đánh trống bát nhã (hai tay thay nhau đập dùi)
        this.torso.position.y = 0.4;
        this.leftArm.rotation.set(1.0 + Math.sin(elapsed * 8) * 0.4, 0.2, 0);
        this.rightArm.rotation.set(1.0 + Math.cos(elapsed * 8) * 0.4, -0.2, 0);
        break;

      case 'lantern':
        // Quỳ gối thả đèn xuống mép nước
        this.torso.position.y = 0.22;
        this.head.position.y = 0.75;
        this.head.rotation.x = 0.3;
        this.leftLeg.rotation.set(1.4, 0, 0);
        this.rightLeg.rotation.set(1.4, 0, 0);
        this.leftArm.rotation.set(1.2, 0.3, 0.1);
        this.rightArm.rotation.set(1.2, -0.3, -0.1);
        break;

      case 'wave':
        // Vẫy tay chào
        this.torso.position.y = 0.4;
        this.leftArm.rotation.set(0, 0, 0.1);
        this.rightArm.rotation.set(2.4, 0, Math.sin(elapsed * 10) * 0.4 - 0.2);
        break;
    }
  }

  public dispose() {
    if (this.nameSprite) {
      this.nameSprite.material.dispose();
    }
    if (this.bubbleSprite) {
      this.bubbleSprite.material.dispose();
    }
  }
}
