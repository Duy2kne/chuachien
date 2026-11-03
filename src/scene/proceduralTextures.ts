import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture>();

// Sân chùa: gạch đá màu vàng cát ấm (#cbbba1 xen #bfae92) như trong ảnh mẫu
export function getCourtyardStoneTexture(): THREE.CanvasTexture {
  if (textureCache.has('courtyard_stone')) return textureCache.get('courtyard_stone')!;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Mạch vữa ấm
  ctx.fillStyle = '#8f8170';
  ctx.fillRect(0, 0, 1024, 1024);

  const rows = 12;
  const cols = 8;
  const tileW = 1024 / cols;
  const tileH = 1024 / rows;
  const gap = 2.5;

  for (let r = 0; r < rows; r++) {
    const shift = (r % 2 === 0) ? 0 : tileW * 0.5;
    for (let c = -1; c <= cols; c++) {
      // Màu đá vàng cát ấm áp đúng như ảnh mẫu
      const shade = 0.88 + (Math.random() - 0.5) * 0.12;
      const red = Math.floor(198 * shade);
      const green = Math.floor(182 * shade);
      const blue = Math.floor(156 * shade);

      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      const tx = c * tileW + shift + gap;
      const ty = r * tileH + gap;
      const tw = tileW - gap * 2;
      const th = tileH - gap * 2;
      ctx.fillRect(tx, ty, tw, th);

      // Vân xước đá nhẹ
      ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
      ctx.fillRect(tx, ty + th * 0.4, tw, th * 0.2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set('courtyard_stone', texture);
  return texture;
}

// Lối đi chính giữa sân: phiến đá xám ghi đậm (#767d86) như trong ảnh mẫu
export function getMainPathTexture(): THREE.CanvasTexture {
  if (textureCache.has('main_path')) return textureCache.get('main_path')!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#555b62';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 6;
  const cols = 3;
  const tileW = 512 / cols;
  const tileH = 512 / rows;
  const gap = 3;

  for (let r = 0; r < rows; r++) {
    const shift = (r % 2 === 0) ? 0 : tileW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const shade = 0.85 + (Math.random() - 0.5) * 0.1;
      const red = Math.floor(118 * shade);
      const green = Math.floor(125 * shade);
      const blue = Math.floor(133 * shade);

      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      const tx = c * tileW + shift + gap;
      const ty = r * tileH + gap;
      ctx.fillRect(tx, ty, tileW - gap * 2, tileH - gap * 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 8);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set('main_path', texture);
  return texture;
}


// Ngói đỏ nâu chùa Việt Nam (#7b3a25) với hàng ngói ống lượn sóng và viền nổi
export function getVietnameseCurvedRoofTexture(): THREE.CanvasTexture {
  if (textureCache.has('vn_curved_roof')) return textureCache.get('vn_curved_roof')!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Nền đỏ nâu ngói nung cổ truyền
  ctx.fillStyle = '#7b3a25';
  ctx.fillRect(0, 0, 512, 512);

  // Hàng ngói âm dương / ngói mũi hài
  const rows = 16;
  const cols = 16;
  const colW = 512 / cols;
  const rowH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    // Rãnh ngói tối màu
    ctx.fillStyle = '#562415';
    ctx.fillRect(0, y + rowH - 4, 512, 4);

    for (let c = 0; c < cols; c++) {
      const x = c * colW;
      // Thân ngói cong sáng ở giữa (ống ngói lồi)
      const grad = ctx.createLinearGradient(x, 0, x + colW, 0);
      grad.addColorStop(0, '#5a2617');
      grad.addColorStop(0.5, '#9a472f'); // Highlight ánh sáng
      grad.addColorStop(1, '#5a2617');

      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y, colW - 2, rowH - 4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set('vn_curved_roof', texture);
  return texture;
}

// Cột và xà gỗ sơn son thếp vàng (#9b1c12)
export function getLacqueredWoodTexture(): THREE.CanvasTexture {
  if (textureCache.has('lacquered_wood')) return textureCache.get('lacquered_wood')!;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Sơn son đỏ thắm
  ctx.fillStyle = '#9b1c12';
  ctx.fillRect(0, 0, 256, 256);

  // Vân gỗ lim chìm
  ctx.fillStyle = 'rgba(60, 10, 5, 0.2)';
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 256;
    const w = 4 + Math.random() * 12;
    ctx.fillRect(x, 0, w, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 4);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set('lacquered_wood', texture);
  return texture;
}

// Khói hương: Sprite tròn mờ (radial gradient trắng -> trong suốt)
export function getSmokeSpriteTexture(): THREE.CanvasTexture {
  if (textureCache.has('smoke_sprite')) return textureCache.get('smoke_sprite')!;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  grad.addColorStop(0, 'rgba(245, 240, 235, 0.85)');
  grad.addColorStop(0.35, 'rgba(230, 225, 220, 0.45)');
  grad.addColorStop(0.7, 'rgba(215, 210, 205, 0.15)');
  grad.addColorStop(1, 'rgba(200, 195, 190, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set('smoke_sprite', texture);
  return texture;
}

// Bảng hoành phi "ĐẠI HÙNG BẢO ĐIỆN" / "TÂM AN TỰ" (đỏ son viền vàng kim rực rỡ)
export function createPlaqueTexture(text: string, subText = ''): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;

  // Nền đỏ son sơn then đậm đà truyền thống
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(0, 0, 512, 140);

  // Viền vàng kim thếp kép chạm trổ
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 124);
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 476, 104);

  // Chữ vàng trang nghiêm
  ctx.fillStyle = '#fef08a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 46px "Noto Serif", Georgia, serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, 256, subText ? 56 : 70);

  if (subText) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.font = 'bold 18px "Be Vietnam Pro", sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText(subText, 256, 102);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Men sứ trắng lam Bát Tràng cho chậu bonsai
export function createBonsaiPotTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 6;
  for (let y = 30; y < 256; y += 60) {
    ctx.beginPath();
    ctx.arc(64, y, 20, 0, Math.PI * 2);
    ctx.arc(192, y, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
