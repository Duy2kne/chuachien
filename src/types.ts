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
  actionText?: string;
  currentAction?: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  count: number;
  max: number;
  isBase: boolean;
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
}
