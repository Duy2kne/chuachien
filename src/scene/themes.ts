// Cảnh của từng phòng: cùng một ngôi chùa nhưng khác mùa, khác giờ, khác thời tiết.
// Server gán theme cho phòng (server.ts: BASE_ROOMS / randomTheme), client đổi màu trời, cây, hạt rơi theo theme.

export type ParticleKind = 'petal' | 'leaf' | 'snow' | 'firefly' | 'ember' | 'dust';

export interface TempleTheme {
  id: string;
  name: string;
  icon: string;
  description: string;
  forceNight?: boolean;
  // Ánh sáng cố định (cảnh trong hang / trong điện): không đổi ngày đêm, không hiện trong danh sách chọn cảnh
  fixed?: boolean;
  glow?: number;          // độ sáng đèn lồng, nến (emissive) khi ánh sáng cố định
  lights?: number;        // cường độ đèn điểm (nến, đèn lồng) khi ánh sáng cố định
  bloom?: [number, number]; // [độ toả sáng, ngưỡng] của hiệu ứng bloom
  sky: { top: number; bottom: number };
  fog: { color: number; near: number; far: number };
  sun: { color: number; intensity: number; position: [number, number, number] };
  hemi: { sky: number; ground: number; intensity: number };
  grass: number;          // màu nhân với texture cỏ
  grassBlade: number;     // bụi cỏ
  foliage: number[];      // tán cây (xoay vòng theo từng cây)
  palm: number;           // lá cau / dừa
  blossom: number;        // hoa trên cây bonsai
  treeFlower: number;     // hoa trên cây hoa sứ
  mountains: [number, number, number];
  particles: { kind: ParticleKind; color: number; count: number; size: number; fallSpeed: number };
  leafPile: number[];     // màu lá đa trong các đống lá rụng
}

export const THEMES: Record<string, TempleTheme> = {
  'chieu-vang': {
    id: 'chieu-vang',
    name: 'Chiều vàng',
    icon: '🌅',
    description: 'Nắng chiều vàng ấm, cánh hoa rơi nhẹ',
    sky: { top: 0x6fa8dc, bottom: 0xf3e6cc },
    fog: { color: 0xdfe6df, near: 90, far: 520 },
    sun: { color: 0xffd9a0, intensity: 2.2, position: [-38, 34, 30] },
    hemi: { sky: 0xfff1d6, ground: 0x6b5a3a, intensity: 0.55 },
    grass: 0xffffff,
    grassBlade: 0x5b8a3e,
    foliage: [0x2d6a4f, 0x40916c, 0x52b788, 0x1b4332, 0x386641],
    palm: 0x386641,
    blossom: 0xfacc15,
    treeFlower: 0xffffff,
    mountains: [0x6f8f72, 0x7f9ea0, 0x9fb4c0],
    particles: { kind: 'petal', color: 0xffd1dc, count: 150, size: 1, fallSpeed: 1 },
    leafPile: [0x9a7b2f, 0x6b8e23, 0xb5862b, 0x7c6a2a]
  },
  'xuan-hoa-dao': {
    id: 'xuan-hoa-dao',
    name: 'Xuân hoa đào',
    icon: '🌸',
    description: 'Mùa xuân, cây trổ hoa đào hồng, cánh hoa bay khắp sân',
    sky: { top: 0x8ec5ff, bottom: 0xffe4ef },
    fog: { color: 0xf6e3ea, near: 90, far: 520 },
    sun: { color: 0xfff0e0, intensity: 2.3, position: [30, 40, 35] },
    hemi: { sky: 0xffeef5, ground: 0x6b7a3a, intensity: 0.6 },
    grass: 0xd9f7c4,
    grassBlade: 0x6fbf4a,
    foliage: [0xf9a8d4, 0x6ab04c, 0xf472b6, 0x8bc34a, 0xfbcfe8],
    palm: 0x5aa04a,
    blossom: 0xf472b6,
    treeFlower: 0xffc0d9,
    mountains: [0x7fae7a, 0x92b8a8, 0xbcd0d8],
    particles: { kind: 'petal', color: 0xffb7d0, count: 320, size: 1.1, fallSpeed: 0.9 },
    leafPile: [0x8bc34a, 0xc0ca33, 0xf8bbd0, 0x7cb342]
  },
  'thu-la-vang': {
    id: 'thu-la-vang',
    name: 'Thu lá vàng',
    icon: '🍂',
    description: 'Mùa thu, cây chuyển vàng cam, lá đa rụng đầy sân',
    sky: { top: 0x7aa6c8, bottom: 0xffd59a },
    fog: { color: 0xf0d7b0, near: 80, far: 480 },
    sun: { color: 0xffb870, intensity: 2.4, position: [-45, 25, 20] },
    hemi: { sky: 0xffe2b8, ground: 0x6b4a2a, intensity: 0.55 },
    grass: 0xeadba6,
    grassBlade: 0x9a8a3a,
    foliage: [0xd97706, 0xb45309, 0xeab308, 0x9a3412, 0xc2410c],
    palm: 0x6b7a2a,
    blossom: 0xfbbf24,
    treeFlower: 0xfde68a,
    mountains: [0x9a7b4f, 0xa58f6f, 0xc4b4a0],
    particles: { kind: 'leaf', color: 0xd97706, count: 230, size: 1.5, fallSpeed: 0.8 },
    leafPile: [0xd97706, 0xb45309, 0xeab308, 0x92400e]
  },
  'dong-suong-tuyet': {
    id: 'dong-suong-tuyet',
    name: 'Đông sương tuyết',
    icon: '❄️',
    description: 'Mùa đông trên núi, sương mù bảng lảng, tuyết rơi trắng sân',
    sky: { top: 0x9fb3c8, bottom: 0xe8eef3 },
    fog: { color: 0xdfe6ec, near: 25, far: 260 },
    sun: { color: 0xdde8ff, intensity: 1.6, position: [-30, 40, 20] },
    hemi: { sky: 0xe6f0ff, ground: 0x8a8f99, intensity: 0.75 },
    grass: 0xf2f6f8,
    grassBlade: 0xdfe8ec,
    foliage: [0x2f4f4f, 0x3b5f55, 0x4a6b62, 0x1f3b36, 0x55776b],
    palm: 0x4a6355,
    blossom: 0xe11d48,
    treeFlower: 0xffffff,
    mountains: [0xc9d6df, 0xdbe4ea, 0xeef3f6],
    particles: { kind: 'snow', color: 0xffffff, count: 420, size: 0.7, fallSpeed: 0.5 },
    leafPile: [0x7c5a3a, 0x8a6b4a, 0x5b4636, 0x6b5440]
  },
  'dem-trang': {
    id: 'dem-trang',
    name: 'Đêm trăng',
    icon: '🌕',
    description: 'Đêm rằm trăng sáng, đèn lồng lung linh, đom đóm bay',
    forceNight: true,
    sky: { top: 0x6fa8dc, bottom: 0xf3e6cc },
    fog: { color: 0xdfe6df, near: 90, far: 520 },
    sun: { color: 0xffd9a0, intensity: 2.2, position: [-38, 34, 30] },
    hemi: { sky: 0xfff1d6, ground: 0x6b5a3a, intensity: 0.55 },
    grass: 0xffffff,
    grassBlade: 0x5b8a3e,
    foliage: [0x2d6a4f, 0x40916c, 0x52b788, 0x1b4332, 0x386641],
    palm: 0x386641,
    blossom: 0xfacc15,
    treeFlower: 0xffffff,
    mountains: [0x6f8f72, 0x7f9ea0, 0x9fb4c0],
    particles: { kind: 'firefly', color: 0xfff3a0, count: 140, size: 0.6, fallSpeed: 0.15 },
    leafPile: [0x9a7b2f, 0x6b8e23, 0xb5862b, 0x7c6a2a]
  }
};

// Ánh sáng riêng của 2 cảnh đặc biệt (gán cố định cho phòng, xem src/shared/maps.ts)
export const FIXED_THEMES: Record<string, TempleTheme> = {
  'dia-nguc': {
    id: 'dia-nguc',
    name: 'Địa ngục',
    icon: '🔥',
    description: 'Hang đá u tối, lửa nghiệp đỏ rực, tàn lửa bay lên',
    fixed: true,
    glow: 1.3,
    lights: 1.4,
    bloom: [0.55, 0.72],
    sky: { top: 0x050102, bottom: 0x2e0a05 },
    fog: { color: 0x1a0604, near: 12, far: 78 },
    sun: { color: 0xff7a55, intensity: 0.75, position: [12, 40, 18] },
    hemi: { sky: 0xff9a7a, ground: 0x2a0806, intensity: 0.85 },
    grass: 0x3a2a24,
    grassBlade: 0x3a2a24,
    foliage: [0x3a2a24],
    palm: 0x3a2a24,
    blossom: 0x7a1a0a,
    treeFlower: 0x7a1a0a,
    mountains: [0x1a0a08, 0x1a0a08, 0x1a0a08],
    particles: { kind: 'ember', color: 0xff7a2a, count: 300, size: 0.55, fallSpeed: 0.9 },
    leafPile: [0x3a2a24]
  },
  'la-han': {
    id: 'la-han',
    name: 'La Hán đường',
    icon: '🏯',
    description: 'Chánh điện ấm áp, nắng sớm xuyên qua song cửa',
    fixed: true,
    glow: 1.0,
    lights: 1.15,
    bloom: [0.3, 0.86],
    sky: { top: 0x9fc4e6, bottom: 0xffe6c4 },
    fog: { color: 0x3a2a1c, near: 26, far: 140 },
    sun: { color: 0xffd49a, intensity: 1.35, position: [-22, 40, 16] },
    hemi: { sky: 0xffe6c4, ground: 0x5a3a22, intensity: 0.8 },
    grass: 0xd9f0c4,
    grassBlade: 0x6a9a4a,
    foliage: [0x2d6a4f, 0x40916c, 0x52b788, 0x386641],
    palm: 0x386641,
    blossom: 0xfacc15,
    treeFlower: 0xffffff,
    mountains: [0x6f8f72, 0x7f9ea0, 0x9fb4c0],
    particles: { kind: 'dust', color: 0xffe2a0, count: 170, size: 0.32, fallSpeed: 0.12 },
    leafPile: [0x9a7b2f, 0x6b8e23]
  }
};

// Mùa theo tháng dương lịch (cho chùa tháp đổi cảnh theo mùa thật)
export function seasonThemeId(date = new Date()): string {
  const m = date.getMonth() + 1;
  if (m <= 3) return 'xuan-hoa-dao';
  if (m <= 6) return 'chieu-vang';
  if (m <= 9) return 'thu-la-vang';
  return 'dong-suong-tuyet';
}

export const DEFAULT_THEME = THEMES['chieu-vang'];
export const getTheme = (id?: string) => (id && (THEMES[id] || FIXED_THEMES[id])) || DEFAULT_THEME;
