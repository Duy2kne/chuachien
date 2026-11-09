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
  | 'wish'         // Buộc dải lụa cầu duyên lên Cây Đa
  | 'sweep'        // Quét lá đa
  | 'kitchen'      // Phụ bếp: đi vào bếp trai đường (chỉ ở giao diện, không gửi server)
  | 'take_plate'   // Lấy đĩa từ chồng đĩa đặt lên quầy
  | 'take_bun'     // Gắp 1 bánh bao từ xửng đặt lên đĩa
  | 'lift_plate'   // Bê đĩa bánh bao (đủ 3 cái) lên tay
  | 'carry'        // Đang bưng đĩa bánh bao
  | 'serve'        // Đặt đĩa bánh bao xuống bàn trai đường
  | 'repent'       // Sám hối trước tượng Địa Tạng Bồ Tát (cảnh địa ngục)
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
  theme?: string;       // Mùa / ánh sáng của phòng (xem src/scene/themes.ts)
  map?: string;         // Bản đồ của phòng (xem src/shared/maps.ts)
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

// Dải lụa đỏ cầu duyên buộc trên Cây Đa (slot = chỗ trên cành, 0..59)
export interface WishItem {
  id: string;
  slot: number;
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
  wishCount?: number;
  totalMerit?: number;
}
