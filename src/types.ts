export type RobeColor = 'blue' | 'brown' | 'orange' | 'grey' | 'yellow' | 'white' | 'moss';
export type AvatarStyle = 'monk' | 'lay';

export type ActionType = 
  | 'idle'
  | 'walk'
  | 'run'
  | 'namaste'      // Chắp tay
  | 'bow'          // Lạy Phật
  | 'incense'      // Thắp hương
  | 'flower'       // Dâng hoa
  | 'wooden_fish'  // Gõ mõ
  | 'meditate'     // Ngồi thiền
  | 'bell'         // Thỉnh chuông
  | 'drum'         // Đánh trống
  | 'lantern'      // Thả đèn hoa đăng
  | 'sweep'        // Quét lá đa
  | 'pickup'       // Phụ bếp: bê mâm cơm ở bếp
  | 'carry'        // Đang bưng mâm cơm
  | 'serve'        // Đặt mâm cơm lên bàn trai đường
  | 'wave';        // Vẫy chào

export interface PlayerData {
  id: string;
  name: string;
  robe: RobeColor;
  style: AvatarStyle;
  room: string;
  merit: number;
  x: number;
  y: number;
  z: number;
  ry: number;
  anim: ActionType;
  items?: string[];   // vật phẩm đang mang (nón lá, hào quang...)
  actionText?: string;
  currentAction?: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  count: number;
  max: number;
  isBase?: boolean;
  theme?: string;       // Cảnh của phòng (xem src/scene/themes.ts)
}

// Đống lá đa rụng trên sân, quét đi để tích công đức
export interface LeafPile {
  id: string;
  x: number;
  z: number;
  seed: number;
  createdAt: number;
}

export type { MeritProfile, CommunalState, WeeklyWinner } from './shared/merit.js';

// Bảng xếp hạng: toàn thời gian, tuần này, và danh sách người được khắc tên trên bia
export interface LeaderboardData {
  all: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  winners: import('./shared/merit.js').WeeklyWinner[];
  week: string;
}

// Một dòng trong bảng Top công đức
export interface LeaderboardEntry {
  name: string;
  merit: number;
  robe: RobeColor;
  online: boolean;
}

export interface IncenseItem {
  id: string;
  x: number;
  y: number;
  z: number;
  createdAt: number;
  playerName: string;
}

export interface FlowerItem {
  id: string;
  x: number;
  y: number;
  z: number;
  createdAt: number;
  playerName: string;
}

export interface LanternItem {
  id: string;
  seed: number;
  x: number;
  z: number;
  text: string;
  createdAt: number;
  playerName: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  time: number;
  isSystem?: boolean;
}

export interface OverallStats {
  totalVisits: number;
  incenseCount: number;
  bellCount: number;
  bowCount: number;
  lanternCount: number;
  flowerCount: number;
  drumCount: number;
  sweepCount?: number;
  servedCount?: number;
  totalMerit?: number;
}
