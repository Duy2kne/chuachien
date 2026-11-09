// Bản đồ (cảnh) của từng phòng: dùng chung cho server (điểm xuất hiện, giới hạn đi lại, chỗ cắm nhang/đặt hoa,
// hành động được phép) và client (dựng cảnh, chỗ đứng làm hành động, lộ trình tự đi).
// Muốn đổi phòng nào dùng cảnh nào: sửa BASE_ROOMS trong server.ts.

import type { ActionType } from '../types.js';
import { DINING } from './dining.js';

export type MapId = 'main' | 'pagoda' | 'hell' | 'zen';

export interface MapSpot { x: number; z: number; ry: number }

export interface MapSpec {
  id: MapId;
  name: string;
  icon: string;
  spawn: { x: number; z: number; spread: number; ry: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  // Nút hành động hiện trên thanh hành động (server cũng chỉ nhận các hành động này)
  actions: ActionType[];
  // Lư hương: tâm lư (x, z), độ cao mặt tro, bán kính cắm nhang
  incense?: { x: number; z: number; y: number; r: number };
  // Mặt bàn thờ đặt hoa: góc (x, z), rộng w (theo x), sâu d (theo z), độ cao mặt bàn y
  flower?: { x: number; z: number; y: number; w: number; d: number };
  // Chỗ đứng làm hành động
  spots: Partial<Record<ActionType, MapSpot>>;
  // Tượng chính: lạy Phật / ngồi thiền quay mặt về đây
  focus: { x: number; z: number };
  // Vùng lá rụng [minX, maxX, minZ, maxZ, trọng số] và vật cản [x, z, bán kính]
  leafZones?: [number, number, number, number, number][];
  leafBlockers?: [number, number, number][];
  // Camera quay ngắm cảnh lúc chưa vào: tâm (x, z), bán kính, độ cao, điểm nhìn y
  orbit: { x: number; z: number; r: number; h: number; y: number };
  // Ngồi thiền ở cảnh này được thêm công đức mỗi 30 giây
  meditateMerit: number;
  // Cảnh luôn cố định ánh sáng (không có nút ngày/đêm)
  fixedLight?: boolean;
}

const BASIC: ActionType[] = ['namaste', 'bow', 'incense', 'flower', 'wooden_fish', 'meditate'];

export const MAPS: Record<MapId, MapSpec> = {
  // Chùa chính: sân chùa, chính điện, lầu chuông, hồ sen, cây đa, nhà ăn
  main: {
    id: 'main',
    name: 'Chùa Tâm An',
    icon: '🛕',
    spawn: { x: 0, z: 23, spread: 3, ry: Math.PI },
    bounds: { minX: -35, maxX: 35, minZ: -35, maxZ: 45 },
    actions: [...BASIC, 'bell', 'drum', 'lantern', 'wish', 'sweep', 'kitchen', 'wave'],
    incense: { x: 0, z: 0.4, y: 1.63, r: 0.8 },
    flower: { x: -1.4, z: -13.95, y: 2.15, w: 2.8, d: 0.75 },
    spots: {
      incense: { x: 0, z: 2.2, ry: Math.PI },
      flower: { x: 0, z: -11.9, ry: Math.PI },
      bell: { x: 20.55, z: 8, ry: -Math.PI / 2 },
      drum: { x: 18, z: 9.35, ry: Math.PI }
    },
    focus: { x: 0, z: -14.5 },
    leafZones: [
      [-24, -12, 8, 16, 4],   // dưới tán bồ đề
      [-14, -5, -2, 30, 3],   // sân bên trái
      [5, 14, -2, 30, 3],     // sân bên phải
      [-2.5, 2.5, 4, 30, 2],  // lối đi giữa
      [-27, -21, -16, 4, 2],  // dưới hàng cây bên trái
      [21, 27, -16, 2, 2],    // dưới hàng cây bên phải
      [-11, 11, -3.2, -0.8, 1] // trước bậc thềm chính điện
    ],
    leafBlockers: [
      [-18, 24, 9.2], [-18, 14, 3.6], [0, 0.4, 2.2], [18, 8, 5.2],
      [-3.8, 0, 1], [3.8, 0, 1], [-3.8, 8, 1], [3.8, 8, 1], [-3.8, 16, 1], [3.8, 16, 1], [-3.8, 24, 1], [3.8, 24, 1],
      [-5.2, -2.5, 1], [5.2, -2.5, 1], [-8.5, 4, 1], [8.5, 4, 1], [-8.5, 16, 1], [8.5, 16, 1], [-8.5, 28, 1], [8.5, 28, 1],
      [-24, 4, 1.3], [-25, -8, 1.3], [-20, -18, 1.3], [24, 4, 1.3], [25, -8, 1.3], [20, -18, 1.3], [24, 14, 1.3], [24, 34, 1.3],
      [-24, 34, 1.3], [26, 24, 1.3],
      [20, 23.5, 8], [-23, -15, 3.2], [-17, -11, 2.8], [18, -12, 5.2], [-12.5, 33, 1.8] // bảo tháp, tượng Quan Âm, hồ sen 2, bia công đức
    ],
    orbit: { x: 0, z: 10, r: 32, h: 12, y: 3 },
    meditateMerit: 1
  },

  // Chùa tháp: tượng Phật Bà Quan Âm nghìn tay nghìn mắt, bảo tháp 7 tầng, vườn tháp
  pagoda: {
    id: 'pagoda',
    name: 'Chùa Tháp Thiên Thủ',
    icon: '🪷',
    spawn: { x: 0, z: 24, spread: 3, ry: Math.PI },
    bounds: { minX: -29, maxX: 29, minZ: -32, maxZ: 30 },
    actions: [...BASIC, 'sweep', 'wave'],
    incense: { x: 0, z: 6, y: 1.63, r: 0.8 },
    flower: { x: -1.3, z: -1.0, y: 1.12, w: 2.6, d: 0.7 },
    spots: {
      incense: { x: 0, z: 7.8, ry: Math.PI },
      flower: { x: 0, z: 0.95, ry: Math.PI }
    },
    focus: { x: 0, z: -7 },
    leafZones: [
      [-19, -9, -4, 24, 3],
      [9, 19, -4, 24, 3],
      [-2.5, 2.5, 10, 24, 2],
      [-14, 14, -18, -12, 1]
    ],
    leafBlockers: [
      [0, 6, 2.2], [0, -7, 5.6], [0, -22, 5], [0, -0.6, 2.2],
      [-12, 4, 1.4], [12, 4, 1.4], [-12, 16, 1.4], [12, 16, 1.4], [-3.5, 20, 1], [3.5, 20, 1], [-3.5, 13, 1], [3.5, 13, 1],
      [-14, -15, 3.2], [14, -15, 3.2]
    ],
    orbit: { x: 0, z: 0, r: 30, h: 13, y: 5 },
    meditateMerit: 1
  },

  // 18 tầng địa ngục: hang đá 3 hành lang, cuối hang là điện Địa Tạng Bồ Tát
  hell: {
    id: 'hell',
    name: 'Địa Ngục Nhân Quả',
    icon: '🔥',
    spawn: { x: -31, z: 18, spread: 2, ry: Math.PI / 2 },
    bounds: { minX: -34, maxX: 34, minZ: -34, maxZ: 24.5 },
    actions: ['namaste', 'bow', 'incense', 'repent', 'wooden_fish', 'meditate', 'wave'],
    incense: { x: 0, z: -21, y: 1.63, r: 0.8 },
    spots: {
      incense: { x: 0, z: -19.2, ry: Math.PI },
      repent: { x: 0, z: -24.4, ry: Math.PI }
    },
    focus: { x: 0, z: -29 },
    orbit: { x: -4, z: 4, r: 26, h: 16, y: 1 },
    meditateMerit: 1,
    fixedLight: true
  },

  // Điện thiền: chánh điện thờ Đức Phật Thích Ca, 30 bồ đoàn ngồi thiền
  zen: {
    id: 'zen',
    name: 'Thiền Đường',
    icon: '🧘',
    spawn: { x: 0, z: 8.5, spread: 2, ry: Math.PI },
    bounds: { minX: -13, maxX: 13, minZ: -24, maxZ: 20 },
    actions: [...BASIC, 'wave'],
    incense: { x: 0, z: -12.2, y: 1.14, r: 0.5 },
    flower: { x: -1.4, z: -16.55, y: 1.25, w: 2.8, d: 0.75 },
    spots: {
      incense: { x: 0, z: -10.7, ry: Math.PI },
      flower: { x: 0, z: -14.5, ry: Math.PI }
    },
    focus: { x: 0, z: -21.5 },
    orbit: { x: 0, z: -4, r: 8.5, h: 5, y: 3.5 },
    meditateMerit: 2,
    fixedLight: true
  }
};

export const getMapSpec = (id?: string): MapSpec => MAPS[(id as MapId) || 'main'] || MAPS.main;
export const isMapId = (id: unknown): id is MapId => typeof id === 'string' && id in MAPS;

// ===================== LỘ TRÌNH TỰ ĐI =====================
type P = { x: number; z: number };

// Chùa chính: ra/vào nhà ăn qua cửa, lên nền chính điện qua bậc thềm
const DOOR_Z = (DINING.doorZ[0] + DINING.doorZ[1]) / 2;
export const insideDining = (x: number, z: number) => x > DINING.minX && x < DINING.maxX && z > DINING.minZ && z < DINING.maxZ;
const onTerrace = (x: number, z: number) => Math.abs(x) <= 11 && z >= -20 && z <= -4;

function mainRoute(fromX: number, fromZ: number, toX: number, toZ: number): P[] {
  const via: P[] = [];
  let x = fromX;
  let z = fromZ;
  if (insideDining(x, z) && !insideDining(toX, toZ)) {
    via.push({ x: DINING.minX + 1.2, z: DOOR_Z }, { x: DINING.minX - 1.2, z: DOOR_Z });
    x = DINING.minX - 1.2;
    z = DOOR_Z;
  }
  // Đang trong chính điện mà đi ra ngoài: ra hiên trước rồi mới đi tiếp (tránh vách hông)
  if (onTerrace(x, z) && !onTerrace(toX, toZ) && Math.abs(x) < 9.5 && z < -5) {
    via.push({ x: Math.max(-8, Math.min(8, x)), z: -3.2 });
    x = Math.max(-8, Math.min(8, x));
    z = -3.2;
  }
  if (onTerrace(toX, toZ) && !onTerrace(x, z)) {
    const sx = Math.max(-2.5, Math.min(2.5, toX));
    via.push({ x: sx, z: -1.2 }, { x: sx, z: -4.6 });
  }
  if (insideDining(toX, toZ) && !insideDining(x, z)) {
    via.push({ x: DINING.minX - 1.2, z: DOOR_Z }, { x: DINING.minX + 1.2, z: DOOR_Z });
  }
  return via;
}

// Địa ngục: 4 khu nối tiếp nhau (hành lang 1, 2, 3, điện Địa Tạng), mỗi chỗ nối là một khe hở cuối vách đá
export const HELL_WALLS = { w1: 11, w2: -2, w3: -15 };
const hellZone = (z: number) => (z > HELL_WALLS.w1 ? 0 : z > HELL_WALLS.w2 ? 1 : z > HELL_WALLS.w3 ? 2 : 3);
// Khe hở giữa khu i và khu i+1: [x, z vách]
const HELL_GAPS: [number, number][] = [[30.5, HELL_WALLS.w1], [-30.5, HELL_WALLS.w2], [30.5, HELL_WALLS.w3]];

// Lối đi giữa mỗi khu (tránh bệ các tầng ở phía vách bắc)
const HELL_WALK = [19.5, 7, -6, -20];

function hellRoute(fromZ: number, toZ: number): P[] {
  const via: P[] = [];
  let a = hellZone(fromZ);
  const b = hellZone(toZ);
  while (a !== b) {
    const down = b > a;
    const next = down ? a + 1 : a - 1;
    const gx = HELL_GAPS[down ? a : next][0];
    // đi dọc lối giữa hành lang tới đầu có khe hở, qua khe sang lối giữa khu kế tiếp
    via.push({ x: gx, z: HELL_WALK[a] }, { x: gx, z: HELL_WALK[next] });
    a = next;
  }
  return via;
}

// Thiền đường: ra/vào qua cửa chính giữa (z = 12.3)
export const ZEN_DOOR_Z = 12.3;
function zenRoute(fromZ: number, toZ: number): P[] {
  const inA = fromZ < ZEN_DOOR_Z;
  const inB = toZ < ZEN_DOOR_Z;
  if (inA === inB) return [];
  return inA ? [{ x: 0, z: ZEN_DOOR_Z - 1.6 }, { x: 0, z: ZEN_DOOR_Z + 1.6 }] : [{ x: 0, z: ZEN_DOOR_Z + 1.6 }, { x: 0, z: ZEN_DOOR_Z - 1.6 }];
}

export function planRoute(map: MapId, fromX: number, fromZ: number, toX: number, toZ: number): P[] {
  if (map === 'main') return mainRoute(fromX, fromZ, toX, toZ);
  if (map === 'hell') return hellRoute(fromZ, toZ);
  if (map === 'zen') return zenRoute(fromZ, toZ);
  return [];
}
