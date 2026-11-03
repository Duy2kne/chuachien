// Nhà ăn (trai đường) bên phải sân chùa: dùng chung cho server (kiểm tra vị trí) và client (dựng cảnh, tự đi).
// Nhà quay cửa về phía lối đi chính (hướng -x). Bếp ở cuối nhà, 2 dãy bàn ăn hai bên lối giữa.

export const DINING = {
  minX: 14,
  maxX: 26,
  minZ: 19,
  maxZ: 28,
  doorZ: [22.5, 24.5] as [number, number],    // khoảng cửa trên tường phía tây (x = 14)
  // Chỗ đứng ở quầy bếp để bê mâm (quay mặt vào bếp, hướng +x)
  kitchenSpot: { x: 23.2, z: 23.5, ry: Math.PI / 2 },
  counter: { minX: 24.2, maxX: 25.8, minZ: 20, maxZ: 27 },
  // 2 bàn ăn dài
  tables: [
    { minX: 16.5, maxX: 21.5, minZ: 20.2, maxZ: 21.4 },
    { minX: 16.5, maxX: 21.5, minZ: 25.6, maxZ: 26.8 }
  ],
  tableTop: 0.72
};

// 8 chỗ đặt mâm cơm: 4 chỗ mỗi bàn, ở mép bàn gần lối đi
export const TRAY_SLOTS = 8;

export function traySlot(slot: number) {
  const table = slot < 4 ? 0 : 1;
  const k = slot % 4;
  const x = 17.1 + k * 1.27;
  return table === 0
    ? { table, x, z: 20.95, spot: { x, z: 22.1, ry: Math.PI } }
    : { table, x, z: 26.05, spot: { x, z: 24.9, ry: 0 } };
}

export interface TrayItem {
  id: string;
  slot: number;
  playerName: string;
  createdAt: number;
}

// Mâm cơm để trên bàn 5 phút rồi được "thọ trai" xong, dọn đi
export const TRAY_TTL_MS = 5 * 60 * 1000;
