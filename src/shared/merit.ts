// Cấu hình công đức dùng chung cho server và client.
// "Công đức tích luỹ" (merit) dùng để xếp hạng và tính danh hiệu, không bao giờ giảm.
// "Công đức khả dụng" = tích luỹ - đã dùng (đổi vật phẩm, cúng dường chung).

// ===================== DANH HIỆU THEO CẤP =====================
export interface MeritTitle {
  min: number;
  name: string;
  color: string;
}

export const TITLES: MeritTitle[] = [
  { min: 0, name: 'Phật tử sơ cơ', color: '#d6d3d1' },
  { min: 100, name: 'Thiện tín', color: '#86efac' },
  { min: 500, name: 'Hộ pháp', color: '#7dd3fc' },
  { min: 2000, name: 'Đại thí chủ', color: '#fcd34d' }
];

export function getTitle(merit: number): MeritTitle {
  let current = TITLES[0];
  for (const t of TITLES) if (merit >= t.min) current = t;
  return current;
}

export function getNextTitle(merit: number): MeritTitle | null {
  return TITLES.find(t => t.min > merit) || null;
}

// ===================== VẬT PHẨM & MỞ KHOÁ =====================
export type ShopKind = 'wear' | 'music' | 'feature';

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  kind: ShopKind;
  description: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'mala_tram', name: 'Tràng hạt gỗ trầm', icon: '📿', cost: 100, kind: 'wear', description: 'Chuỗi hạt trầm hương nâu sẫm, hạt vàng điểm xuyết' },
  { id: 'non_la', name: 'Nón lá', icon: '👒', cost: 200, kind: 'wear', description: 'Nón lá truyền thống đội đầu khi đi lễ chùa' },
  { id: 'robe_gold', name: 'Áo tràng vàng kim', icon: '👘', cost: 500, kind: 'wear', description: 'Áo tràng màu vàng kim thêu hoa sen' },
  { id: 'halo', name: 'Hào quang', icon: '✨', cost: 1000, kind: 'wear', description: 'Vầng hào quang tỏa sáng sau đầu' },
  { id: 'music_bowl', name: 'Nhạc: Chuông xoay thiền định', icon: '🎵', cost: 300, kind: 'music', description: 'Tiếng chuông xoay (singing bowl) ngân dài, êm dịu' },
  { id: 'music_zither', name: 'Nhạc: Đàn tranh ngũ cung', icon: '🎶', cost: 300, kind: 'music', description: 'Giai điệu đàn tranh dìu dặt theo thang ngũ cung' },
  { id: 'room_theme', name: 'Phòng riêng tự chọn cảnh', icon: '🏞️', cost: 500, kind: 'feature', description: 'Khi mở phòng mới được tự chọn cảnh: xuân, thu, đông, đêm trăng…' }
];

export const getShopItem = (id: string) => SHOP_ITEMS.find(i => i.id === id);

// Bài nhạc tổng hợp có thể mở khoá: id bài -> id vật phẩm cần sở hữu
export const LOCKED_TRACKS: Record<string, { item: string; name: string }> = {
  synth_bowl: { item: 'music_bowl', name: 'Chuông xoay thiền định' },
  synth_zither: { item: 'music_zither', name: 'Đàn tranh ngũ cung' }
};

// ===================== CÚNG DƯỜNG CHUNG =====================
// Cả chùa cùng góp công đức, xây xong công trình này mới mở công trình tiếp theo.
export interface CommunalProject {
  id: string;
  name: string;
  icon: string;
  goal: number;
  description: string;
}

export const COMMUNAL_PROJECTS: CommunalProject[] = [
  { id: 'bao_thap', name: 'Bảo tháp 5 tầng', icon: '🛕', goal: 2000, description: 'Ngọn bảo tháp mái cong bên phải sân chùa' },
  { id: 'quan_am', name: 'Tượng Quan Âm lộ thiên', icon: '🪷', goal: 5000, description: 'Tượng Quan Âm bạch ngọc cao lớn trên đài sen' },
  { id: 'ho_sen_2', name: 'Hồ sen thứ hai', icon: '🌸', goal: 10000, description: 'Hồ sen nhỏ có cá koi phía sau lầu chuông' }
];

export interface CommunalState {
  current: string | null;              // công trình đang góp
  progress: Record<string, number>;    // số công đức đã góp
  built: string[];                     // công trình đã xây xong
}

// ===================== HỒ SƠ CÔNG ĐỨC CỦA MỖI NGƯỜI =====================
export interface MeritProfile {
  merit: number;      // tích luỹ
  spent: number;      // đã dùng
  balance: number;    // khả dụng
  owned: string[];    // vật phẩm đã đổi
  equipped: string[]; // vật phẩm đang mang
}

export interface WeeklyWinner {
  week: string;  // ví dụ "2026-11-02" (ngày thứ Hai đầu tuần)
  name: string;
  merit: number;
}

// Mã tuần theo giờ Việt Nam (UTC+7): ngày thứ Hai của tuần hiện tại
export function weekKey(now = Date.now()): string {
  const d = new Date(now + 7 * 3600 * 1000);
  const day = (d.getUTCDay() + 6) % 7; // 0 = thứ Hai
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
