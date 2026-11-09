import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import compression from 'compression';
import helmet from 'helmet';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanText } from './src/server/profanity.js';
import { DINING, TRAY_SLOTS, TRAY_TTL_MS, BUNS_PER_PLATE, KITCHEN_REACH, SERVE_REACH, traySlot, type TrayItem } from './src/shared/dining.js';
import { SHOP_ITEMS, COMMUNAL_PROJECTS, getShopItem, weekKey, type CommunalState, type MeritProfile, type WeeklyWinner } from './src/shared/merit.js';
import { getMapSpec, type MapId } from './src/shared/maps.js';
import { seasonThemeId } from './src/scene/themes.js';
import type { PlayerData, RoomInfo, IncenseItem, FlowerItem, LanternItem, WishItem, ChatMessage, OverallStats, ActionType, LeafPile, LeaderboardEntry, LeaderboardData, RobeColor } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_PER_ROOM = parseInt(process.env.MAX_PER_ROOM || '50', 10);
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '20', 10);
const ROOM_IDLE_MS = parseInt(process.env.ROOM_IDLE_MINUTES || '5', 10) * 60 * 1000;
const isProd = process.env.NODE_ENV === 'production';

// Tải hoặc khởi tạo thống kê
const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
let stats: OverallStats = {
  totalVisits: 156,
  incenseCount: 420,
  bellCount: 112,
  bowCount: 310,
  lanternCount: 95,
  flowerCount: 78,
  drumCount: 54
};

try {
  if (fs.existsSync(STATS_FILE)) {
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    stats = { ...stats, ...JSON.parse(raw) };
  }
} catch (err) {
  console.warn('Không thể đọc data/stats.json, dùng giá trị mặc định:', err);
}

function saveStats() {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi lưu data/stats.json:', err);
  }
}

// ===================== CÔNG ĐỨC (lưu ở server theo mã người dùng) =====================
// Mỗi trình duyệt có 1 mã ngẫu nhiên (uid) lưu trong localStorage; công đức gắn với mã này.
const MERIT_FILE = path.join(__dirname, 'data', 'merit.json');
interface MeritRecord {
  name: string;
  merit: number;        // công đức tích luỹ (xếp hạng, danh hiệu)
  robe: RobeColor;
  updatedAt: number;
  spent?: number;       // đã dùng để đổi vật phẩm / cúng dường
  owned?: string[];
  equipped?: string[];
}
const meritStore = new Map<string, MeritRecord>();
// Công đức trong tuần hiện tại (reset mỗi thứ Hai, giờ Việt Nam)
let currentWeek = weekKey();
const weeklyStore = new Map<string, { name: string; merit: number; robe: RobeColor }>();
// Người đứng đầu các tuần trước: được khắc tên lên bia công đức
let weeklyWinners: WeeklyWinner[] = [];
// Cúng dường chung: cả chùa góp công đức xây công trình mới
let communal: CommunalState = { current: COMMUNAL_PROJECTS[0].id, progress: {}, built: [] };

try {
  if (fs.existsSync(MERIT_FILE)) {
    const raw = JSON.parse(fs.readFileSync(MERIT_FILE, 'utf-8'));
    // Định dạng cũ: { uid: record }; định dạng mới: { version: 2, players, weekly, ... }
    const playersRaw: Record<string, MeritRecord> = raw.version === 2 ? raw.players : raw;
    for (const [uid, rec] of Object.entries(playersRaw)) meritStore.set(uid, rec);
    if (raw.version === 2) {
      currentWeek = raw.week || currentWeek;
      for (const [uid, rec] of Object.entries(raw.weekly || {})) weeklyStore.set(uid, rec as any);
      weeklyWinners = raw.winners || [];
      communal = { ...communal, ...(raw.communal || {}) };
    }
  }
} catch (err) {
  console.warn('Không thể đọc data/merit.json:', err);
}
let meritDirty = false;

function saveMerit() {
  if (!meritDirty) return;
  try {
    const dir = path.dirname(MERIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MERIT_FILE, JSON.stringify({
      version: 2,
      players: Object.fromEntries(meritStore),
      week: currentWeek,
      weekly: Object.fromEntries(weeklyStore),
      winners: weeklyWinners,
      communal
    }), 'utf-8');
    meritDirty = false;
  } catch (err) {
    console.error('Lỗi lưu data/merit.json:', err);
  }
}

// Cập nhật bản ghi công đức (giữ nguyên số đã dùng, vật phẩm)
function touchRecord(uid: string, patch: Partial<MeritRecord>) {
  const old = meritStore.get(uid);
  meritStore.set(uid, { name: '', merit: 0, robe: 'brown', ...old, ...patch, updatedAt: Date.now() });
  meritDirty = true;
}

function getProfile(uid: string): MeritProfile {
  const r = meritStore.get(uid);
  const merit = r?.merit || 0;
  const spent = r?.spent || 0;
  return { merit, spent, balance: Math.max(0, merit - spent), owned: r?.owned || [], equipped: r?.equipped || [] };
}

// Lưu stats + công đức định kỳ mỗi 60 giây
setInterval(() => {
  saveStats();
  saveMerit();
}, 60000);

// ===================== CẢNH CỦA TỪNG PHÒNG =====================
const THEMES = ['chieu-vang', 'xuan-hoa-dao', 'thu-la-vang', 'dong-suong-tuyet', 'dem-trang'];
const randomTheme = () => THEMES[Math.floor(Math.random() * THEMES.length)];

interface RoomState {
  id: string;
  name: string;
  isBase: boolean;
  emptySince: number | null;
  players: Map<string, PlayerData>;
  incense: IncenseItem[];
  flowers: FlowerItem[];
  lanterns: LanternItem[];
  wishes: WishItem[];     // dải lụa cầu duyên buộc trên cây đa
  lastBellTime: number;
  lastDrumTime: number;
  leaves: LeafPile[];
  theme: string;
  map: MapId;
  trays: TrayItem[];
}

// Mỗi phòng gốc một cảnh riêng (xem src/shared/maps.ts). Chùa tháp đổi mùa theo tháng thật.
const BASE_ROOMS: { id: string; name: string; theme: string; map: MapId }[] = [
  { id: 'tu-bi', name: 'Từ Bi', theme: 'chieu-vang', map: 'main' },
  { id: 'hy-xa', name: 'Hỷ Xả', theme: seasonThemeId(), map: 'pagoda' },
  { id: 'an-lac', name: 'An Lạc', theme: 'dia-nguc', map: 'hell' },
  { id: 'thanh-tinh', name: 'Thanh Tịnh', theme: 'dien-thien', map: 'zen' }
];

const EXTRA_ROOM_NAMES = [
  'Trí Tuệ', 'An Nhiên', 'Viên Mãn', 'Tịnh Tâm', 'Bồ Đề', 'Liên Hoa',
  'Phước Đức', 'Quang Minh', 'Bát Nhã', 'Thiện Duyên', 'Vô Lượng'
];

const rooms = new Map<string, RoomState>();

// Khởi tạo phòng gốc
for (const base of BASE_ROOMS) {
  rooms.set(base.id, {
    id: base.id,
    name: base.name,
    isBase: true,
    emptySince: null,
    players: new Map(),
    incense: [],
    flowers: [],
    lanterns: [],
    wishes: [],
    lastBellTime: 0,
    lastDrumTime: 0,
    leaves: [],
    trays: [],
    theme: base.theme,
    map: base.map
  });
}

// Theo dõi người chơi và giới hạn tần suất
interface PlayerSession {
  socket: Socket;
  ip: string;
  room: string;
  data: PlayerData;
  lastActionTime: number;
  lastChatTime: number;
  lastProfileTime?: number;
  carrying?: boolean;   // đang bưng đĩa bánh bao
  // Đĩa đang bày trên quầy bếp: null = chưa lấy đĩa, 0-3 = số bánh bao đã gắp
  kitchenPlate?: number | null;
  uid: string;
  meritCooldown: Map<string, number>;
}

const players = new Map<string, PlayerSession>();

// Cây đa se duyên: tối đa 60 dải lụa mỗi phòng, giữ 24 giờ
const WISH_SLOTS = 60;
const WISH_TTL_MS = 24 * 60 * 60 * 1000;

function syncRoomObjects(room: RoomState) {
  io.to(room.id).emit('objects:sync', {
    incense: room.incense,
    flowers: room.flowers,
    lanterns: room.lanterns,
    wishes: room.wishes
  });
}
const ipRoomCreations = new Map<string, number>();

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      mediaSrc: ["'self'", "data:", "blob:"],
      frameAncestors: ["*"]
    }
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));

app.use(compression());
app.use(express.json({ limit: '100kb' }));

// Sang tuần mới: người đứng đầu tuần cũ được khắc tên lên bia, bảng tuần reset
function checkWeekRollover() {
  const now = weekKey();
  if (now === currentWeek) return;
  const top = Array.from(weeklyStore.values()).sort((a, b) => b.merit - a.merit)[0];
  if (top && top.merit > 0) {
    weeklyWinners = [{ week: currentWeek, name: top.name, merit: top.merit }, ...weeklyWinners].slice(0, 12);
    io.emit('chat:message', {
      id: `sys-week-${Date.now()}`,
      playerId: 'system',
      playerName: 'Chùa',
      text: `🏆 ${top.name} đứng đầu công đức tuần qua (${top.merit}) và được khắc tên lên bia công đức 🙏`,
      time: Date.now(),
      isSystem: true
    } as ChatMessage);
  }
  currentWeek = now;
  weeklyStore.clear();
  meritDirty = true;
  scheduleLeaderboardBroadcast();
}
setInterval(checkWeekRollover, 60000);

function rank(entries: [string, { name: string; merit: number; robe: RobeColor }][], limit: number): LeaderboardEntry[] {
  const onlineUids = new Set(Array.from(players.values()).map(p => p.uid));
  return entries
    .filter(([, r]) => r.merit > 0)
    .sort((a, b) => b[1].merit - a[1].merit)
    .slice(0, limit)
    .map(([uid, r]) => ({ name: r.name, merit: r.merit, robe: r.robe, online: onlineUids.has(uid) }));
}

// Top công đức toàn chùa + tuần này + bia công đức
function getLeaderboard(limit = 20): LeaderboardData {
  return {
    all: rank(Array.from(meritStore.entries()), limit),
    weekly: rank(Array.from(weeklyStore.entries()), limit),
    winners: weeklyWinners,
    week: currentWeek
  };
}

let leaderboardTimer: NodeJS.Timeout | null = null;
function scheduleLeaderboardBroadcast() {
  if (leaderboardTimer) return;
  leaderboardTimer = setTimeout(() => {
    leaderboardTimer = null;
    io.emit('leaderboard', getLeaderboard());
  }, 2000);
}

function sendProfile(session: PlayerSession) {
  session.socket.emit('profile:self', getProfile(session.uid));
}

// Cộng công đức (nguồn sự thật duy nhất là server)
function addMerit(session: PlayerSession, gain: number) {
  if (gain <= 0) return;
  checkWeekRollover();
  session.data.merit += gain;
  stats.totalMerit = (stats.totalMerit || 0) + gain;
  touchRecord(session.uid, { name: session.data.name, merit: session.data.merit, robe: session.data.robe });
  const week = weeklyStore.get(session.uid);
  weeklyStore.set(session.uid, { name: session.data.name, robe: session.data.robe, merit: (week?.merit || 0) + gain });
  io.to(session.room).emit('merit:update', { id: session.data.id, merit: session.data.merit, gain });
  sendProfile(session);
  scheduleLeaderboardBroadcast();
}

// Hành động bật/tắt (chắp tay, thiền, gõ mõ) chỉ được cộng công đức 1 lần mỗi 20 giây
const TOGGLE_MERIT_COOLDOWN = 20000;

// ===================== LÁ ĐA RỤNG =====================
const MAX_LEAVES_PER_ROOM = 18;
// Vùng lá rơi và vật cản theo bản đồ (src/shared/maps.ts); bản đồ không có vùng lá thì không rụng lá
function randomLeafSpot(map: MapId): { x: number; z: number } | null {
  const spec = getMapSpec(map);
  const LEAF_ZONES = spec.leafZones;
  const LEAF_BLOCKERS = spec.leafBlockers || [];
  if (!LEAF_ZONES?.length) return null;
  const total = LEAF_ZONES.reduce((a, z) => a + z[4], 0);
  for (let attempt = 0; attempt < 20; attempt++) {
    let r = Math.random() * total;
    const zone = LEAF_ZONES.find(z => (r -= z[4]) < 0) || LEAF_ZONES[0];
    const x = zone[0] + Math.random() * (zone[1] - zone[0]);
    const z = zone[2] + Math.random() * (zone[3] - zone[2]);
    if (LEAF_BLOCKERS.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < br)) continue;
    return { x: +x.toFixed(2), z: +z.toFixed(2) };
  }
  return null;
}

// Mỗi 6 giây, phòng có người thì có thể rụng thêm 1 đống lá
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.size === 0 || room.leaves.length >= MAX_LEAVES_PER_ROOM) continue;
    if (Math.random() > 0.55) continue;
    const spot = randomLeafSpot(room.map);
    if (!spot) continue;
    const leaf: LeafPile = {
      id: `leaf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      x: spot.x,
      z: spot.z,
      seed: Math.floor(Math.random() * 100000),
      createdAt: Date.now()
    };
    room.leaves.push(leaf);
    io.to(room.id).emit('leaves:add', leaf);
  }
}, 6000);

// Chùa tháp đổi cảnh theo mùa thật (kiểm tra mỗi giờ, người vào sau thấy mùa mới)
setInterval(() => {
  const season = seasonThemeId();
  for (const r of rooms.values()) if (r.map === 'pagoda' && r.isBase) r.theme = season;
}, 3600000);

// Thiền, gõ mõ, chắp tay liên tục: cứ 30 giây được thêm 1 công đức
setInterval(() => {
  for (const session of players.values()) {
    const anim = session.data.anim;
    if (anim === 'meditate') addMerit(session, getMapSpec(rooms.get(session.room)?.map).meditateMerit);
    else if (['wooden_fish', 'namaste'].includes(anim)) addMerit(session, 1);
  }
}, 30000);

// Helper lấy danh sách phòng
function getRoomList(): RoomInfo[] {
  const list: RoomInfo[] = [];
  for (const r of rooms.values()) {
    list.push({
      id: r.id,
      name: r.name,
      count: r.players.size,
      max: MAX_PER_ROOM,
      isBase: r.isBase,
      theme: r.theme,
      map: r.map
    });
  }
  return list;
}

// REST Endpoints
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: Math.floor(process.uptime()),
    players: players.size,
    rooms: rooms.size,
    timestamp: Date.now()
  });
});

app.get('/api/rooms', (_req, res) => {
  res.json({
    rooms: getRoomList(),
    stats,
    maxPerRoom: MAX_PER_ROOM
  });
});

app.get('/api/shop', (_req, res) => {
  res.json({ items: SHOP_ITEMS, projects: COMMUNAL_PROJECTS, communal });
});

app.get('/api/leaderboard', (_req, res) => {
  res.json(getLeaderboard());
});

app.get('/api/stats', (_req, res) => {
  res.json(stats);
});

// ===================== QUẢN TRỊ (ADMIN) =====================
// Mật khẩu đặt ở biến môi trường ADMIN_PASSWORD (vẫn nhận ADMIN_KEY cũ). Không đặt = tắt trang quản trị.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_KEY || '';
const adminFails = new Map<string, { n: number; until: number }>();

function checkAdmin(req: express.Request, res: express.Response): boolean {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: 'Server chưa đặt mật khẩu quản trị (biến môi trường ADMIN_PASSWORD)' });
    return false;
  }
  const ip = req.ip || 'unknown';
  const fail = adminFails.get(ip);
  if (fail && fail.until > Date.now()) {
    res.status(429).json({ error: 'Nhập sai quá nhiều lần, vui lòng thử lại sau 10 phút' });
    return false;
  }
  const provided = Buffer.from(String(req.body?.password ?? req.get('x-admin-key') ?? ''));
  const expected = Buffer.from(ADMIN_PASSWORD);
  const ok = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (!ok) {
    const n = (fail?.n || 0) + 1;
    adminFails.set(ip, n >= 8 ? { n: 0, until: Date.now() + 10 * 60 * 1000 } : { n, until: 0 });
    res.status(401).json({ error: 'Mật khẩu quản trị không đúng' });
    return false;
  }
  adminFails.delete(ip);
  return true;
}

// Cộng (delta > 0) hoặc trừ (delta < 0) công đức cho 1 người, báo ngay nếu đang online
function adminAdjustMerit(uid: string, delta: number, reason: string) {
  const rec = meritStore.get(uid);
  if (!rec) return null;
  const merit = Math.max(0, (rec.merit || 0) + delta);
  const spent = Math.min(rec.spent || 0, merit);
  touchRecord(uid, { merit, spent });
  saveMerit();
  console.log(`[Admin] ${delta > 0 ? '+' : ''}${delta} công đức cho ${rec.name} (${uid}) -> ${merit}${reason ? ` | ${reason}` : ''}`);
  for (const session of players.values()) {
    if (session.uid !== uid) continue;
    session.data.merit = merit;
    io.to(session.room).emit('merit:update', { id: session.data.id, merit, gain: Math.max(0, delta) });
    sendProfile(session);
    session.socket.emit('notice', {
      text: delta > 0
        ? `🙏 Ban quản trị chùa tặng bạn +${delta} công đức${reason ? ` (${reason})` : ''}`
        : `Công đức của bạn được điều chỉnh ${delta}${reason ? ` (${reason})` : ''}`
    });
  }
  scheduleLeaderboardBroadcast();
  return { uid, name: rec.name, ...getProfile(uid) };
}

app.post('/api/admin/verify', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ ok: true });
});

app.post('/api/admin/action', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const action = String(req.body?.action || '');
  const payload = req.body?.payload || {};

  if (action === 'overview') {
    let wishes = 0;
    let lanterns = 0;
    for (const r of rooms.values()) {
      wishes += r.wishes.length;
      lanterns += r.lanterns.length;
    }
    res.json({ ok: true, online: players.size, totalUsers: meritStore.size, rooms: getRoomList(), stats, wishes, lanterns });
  } else if (action === 'list_users') {
    const online = new Map<string, string>();
    for (const session of players.values()) online.set(session.uid, rooms.get(session.room)?.name || '');
    const users = Array.from(meritStore.entries())
      .map(([uid, r]) => ({
        uid,
        name: r.name || 'Phật tử',
        merit: r.merit || 0,
        balance: Math.max(0, (r.merit || 0) - (r.spent || 0)),
        isOnline: online.has(uid),
        room: online.get(uid) || '',
        updatedAt: r.updatedAt
      }))
      .sort((x, y) => Number(y.isOnline) - Number(x.isOnline) || y.merit - x.merit)
      .slice(0, 500);
    res.json({ ok: true, users });
  } else if (action === 'adjust_merit') {
    const uid = typeof payload.uid === 'string' ? payload.uid : '';
    const delta = Math.trunc(Number(payload.delta));
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1_000_000) {
      res.status(400).json({ error: 'Số công đức không hợp lệ (từ -1.000.000 đến 1.000.000, khác 0)' });
      return;
    }
    const reason = cleanText(typeof payload.reason === 'string' ? payload.reason : '', 80);
    const user = adminAdjustMerit(uid, delta, reason);
    if (!user) {
      res.status(404).json({ error: 'Không tìm thấy người này' });
      return;
    }
    res.json({ ok: true, message: `Đã ${delta > 0 ? 'cộng' : 'trừ'} ${Math.abs(delta)} công đức cho ${user.name} (còn ${user.merit})`, user });
  } else if (action === 'announce') {
    const text = cleanText(typeof payload.text === 'string' ? payload.text : '', 160);
    if (!text) {
      res.status(400).json({ error: 'Nội dung thông báo trống' });
      return;
    }
    io.emit('notice', { text: `📢 ${text}`, long: true });
    io.emit('chat:message', {
      id: `admin-${Date.now()}`,
      playerId: 'admin',
      playerName: 'Ban quản trị chùa',
      text,
      time: Date.now(),
      isSystem: true
    });
    console.log(`[Admin] Thông báo: ${text}`);
    res.json({ ok: true, message: 'Đã gửi thông báo tới toàn chùa' });
  } else if (action === 'list_offerings') {
    const items: { kind: 'wish' | 'lantern'; roomId: string; roomName: string; id: string; playerName: string; text: string; createdAt: number }[] = [];
    for (const r of rooms.values()) {
      for (const w of r.wishes) items.push({ kind: 'wish', roomId: r.id, roomName: r.name, id: w.id, playerName: w.playerName, text: w.text, createdAt: w.createdAt });
      for (const l of r.lanterns) items.push({ kind: 'lantern', roomId: r.id, roomName: r.name, id: l.id, playerName: l.playerName, text: l.text, createdAt: l.createdAt });
    }
    items.sort((x, y) => y.createdAt - x.createdAt);
    res.json({ ok: true, items });
  } else if (action === 'delete_offering') {
    const room = rooms.get(String(payload.roomId || ''));
    const id = String(payload.id || '');
    if (!room) {
      res.status(404).json({ error: 'Không tìm thấy phòng' });
      return;
    }
    const before = room.wishes.length + room.lanterns.length;
    room.wishes = room.wishes.filter(w => w.id !== id);
    room.lanterns = room.lanterns.filter(l => l.id !== id);
    if (before === room.wishes.length + room.lanterns.length) {
      res.status(404).json({ error: 'Lời cầu này đã được gỡ hoặc hết hạn' });
      return;
    }
    syncRoomObjects(room);
    res.json({ ok: true, message: 'Đã gỡ lời cầu' });
  } else {
    res.status(400).json({ error: 'Thao tác không hợp lệ' });
  }
});

// API cũ: cộng công đức bằng header x-admin-key (giữ lại cho script cũ)
app.post('/api/admin/merit', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const uid = String(req.body?.uid || '').trim();
  const amount = Number(req.body?.amount);
  if (!uid) return res.status(400).json({ error: 'Thiếu uid' });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return res.status(400).json({ error: 'amount phải là số dương hợp lệ' });
  }
  const user = adminAdjustMerit(uid, Math.trunc(amount), '');
  if (!user) return res.status(404).json({ error: 'Không tìm thấy uid' });
  res.json({ ok: true, uid, merit: user.merit });
});

// Âm thanh tuỳ chọn thay cho âm thanh tổng hợp (drum / bell / woodfish / chime)
app.get('/api/sfx', (_req, res) => {
  const sfxDir = path.join(__dirname, 'public', 'sfx');
  try {
    const files = fs.existsSync(sfxDir) ? fs.readdirSync(sfxDir).filter(f => /\.(mp3|ogg|wav)$/i.test(f)) : [];
    res.json(files);
  } catch {
    res.json([]);
  }
});

app.get('/api/music', (_req, res) => {
  const musicDir = path.join(__dirname, 'public', 'music');
  const tracks = [
    { id: 'synth_zen', name: 'Nhạc thiền ngũ cung tổng hợp (Mặc định)', type: 'synth' }
  ];

  try {
    if (fs.existsSync(musicDir)) {
      const files = fs.readdirSync(musicDir);
      for (const file of files) {
        if (/\.(mp3|ogg|m4a|wav)$/i.test(file)) {
          tracks.push({
            id: file,
            name: file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            type: 'audio'
          });
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc thư mục music:', err);
  }

  res.json(tracks);
});

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e4, // 10KB
  pingTimeout: 20000,
  pingInterval: 10000
});

// Điểm xuất hiện ngẫu nhiên quanh điểm spawn của bản đồ
function spawnPoint(map: MapId) {
  const sp = getMapSpec(map).spawn;
  return { x: sp.x + (Math.random() - 0.5) * sp.spread, z: sp.z + (Math.random() - 0.5) * sp.spread, ry: sp.ry };
}

// Tìm hoặc tạo phòng phù hợp khi vào
function resolveRoomForJoin(preferredRoomId?: string): RoomState {
  // Nếu có phòng mong muốn và còn chỗ
  if (preferredRoomId && rooms.has(preferredRoomId)) {
    const target = rooms.get(preferredRoomId)!;
    if (target.players.size < MAX_PER_ROOM) {
      return target;
    }
  }

  // Nếu phòng mong muốn bị đầy, tìm nhánh thứ tự (vd: tu-bi -> tu-bi-2)
  if (preferredRoomId && rooms.has(preferredRoomId)) {
    const baseTarget = rooms.get(preferredRoomId)!;
    for (let i = 2; i <= 10; i++) {
      const subId = `${preferredRoomId}-${i}`;
      if (rooms.has(subId)) {
        const sub = rooms.get(subId)!;
        if (sub.players.size < MAX_PER_ROOM) return sub;
      } else if (rooms.size < MAX_ROOMS) {
        // Tự tạo phòng tiếp theo
        const newRoom: RoomState = {
          id: subId,
          name: `${baseTarget.name} ${i}`,
          isBase: false,
          emptySince: null,
          players: new Map(),
          incense: [],
          flowers: [],
          lanterns: [],
          wishes: [],
          lastBellTime: 0,
          lastDrumTime: 0,
          leaves: [],
          trays: [],
          theme: baseTarget.theme,
          map: baseTarget.map
        };
        rooms.set(subId, newRoom);
        return newRoom;
      }
    }
  }

  // Tìm phòng đông nhất mà chưa đầy
  let bestRoom: RoomState | null = null;
  let maxCount = -1;
  for (const r of rooms.values()) {
    if (r.players.size < MAX_PER_ROOM && r.players.size > maxCount) {
      maxCount = r.players.size;
      bestRoom = r;
    }
  }

  if (bestRoom) return bestRoom;

  // Nếu tất cả phòng đều đầy, tạo phòng mới nếu chưa quá MAX_ROOMS
  if (rooms.size < MAX_ROOMS) {
    const nextName = EXTRA_ROOM_NAMES[rooms.size % EXTRA_ROOM_NAMES.length] || `Phòng ${rooms.size + 1}`;
    const newId = `room-${Date.now().toString(36)}`;
    const newRoom: RoomState = {
      id: newId,
      name: nextName,
      isBase: false,
      emptySince: null,
      players: new Map(),
      incense: [],
      flowers: [],
      lanterns: [],
      wishes: [],
      lastBellTime: 0,
      lastDrumTime: 0,
      leaves: [],
      trays: [],
      theme: randomTheme(),
      map: 'main'
    };
    rooms.set(newId, newRoom);
    return newRoom;
  }

  // Trường hợp hiếm hoi tất cả 20 phòng đều kịch 50 người
  return rooms.get('tu-bi')!;
}

// Xử lý Socket.IO
io.on('connection', (socket: Socket) => {
  const clientIp = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || socket.handshake.address || 'unknown';

  // Sự kiện gửi danh sách phòng khi đang ở màn hình chọn
  socket.on('rooms:get', () => {
    socket.emit('rooms:list', getRoomList());
  });

  // Sự kiện tạo phòng theo yêu cầu
  socket.on('room:create', (data: { name?: string; theme?: string; uid?: string }, callback) => {
    const now = Date.now();
    const lastCreation = ipRoomCreations.get(clientIp) || 0;
    if (now - lastCreation < 30000) {
      if (typeof callback === 'function') {
        callback({ error: 'Mỗi người chỉ tạo 1 phòng mới mỗi 30 giây 🙏' });
      }
      return;
    }

    if (rooms.size >= MAX_ROOMS) {
      if (typeof callback === 'function') {
        callback({ error: 'Chùa đang rất đông, số phòng đã đạt tối đa. Xin vào phòng có sẵn 🙏' });
      }
      return;
    }

    const cleanedName = cleanText(data?.name || '', 20) || `Tịnh Thất ${rooms.size + 1}`;
    // Chọn cảnh cho phòng riêng: phải đã đổi vật phẩm "Phòng riêng tự chọn cảnh"
    const canPickTheme = !!data?.uid && (meritStore.get(data.uid)?.owned || []).includes('room_theme');
    const roomTheme = canPickTheme && data?.theme && THEMES.includes(data.theme) ? data.theme : randomTheme();
    const newId = `room-${Date.now().toString(36)}`;
    const newRoom: RoomState = {
      id: newId,
      name: cleanedName,
      isBase: false,
      emptySince: null,
      players: new Map(),
      incense: [],
      flowers: [],
      lanterns: [],
      wishes: [],
      lastBellTime: 0,
      lastDrumTime: 0,
      leaves: [],
      trays: [],
      theme: roomTheme,
      map: 'main'
    };

    rooms.set(newId, newRoom);
    ipRoomCreations.set(clientIp, now);
    io.emit('rooms:list', getRoomList());

    if (typeof callback === 'function') {
      callback({ ok: true, room: { id: newRoom.id, name: newRoom.name } });
    }
  });

  // Sự kiện vào chùa (join)
  socket.on('join', (data: { name?: string; robe?: any; style?: any; room?: string; merit?: number; uid?: string }, callback) => {
    const rawName = (data?.name || '').trim();
    const name = cleanText(rawName, 20) || 'Phật tử';
    const robe = ['blue', 'brown', 'orange', 'grey', 'yellow', 'white', 'moss'].includes(data?.robe) ? data.robe : 'blue';
    const style = ['monk', 'lay'].includes(data?.style) ? data.style : 'monk';
    // Mã người dùng: hợp lệ thì dùng lại, không thì cấp mã mới
    const uid = typeof data?.uid === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(data.uid)
      ? data.uid
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    // Công đức lấy từ server; người cũ chưa có trên server thì nhận tối đa 300 từ máy cũ
    const stored = meritStore.get(uid);
    const merit = stored ? stored.merit : Math.max(0, Math.min(300, Math.floor(Number(data?.merit) || 0)));
    const items = stored?.equipped || [];

    // Lựa chọn phòng
    const room = resolveRoomForJoin(data?.room);
    const wasRedirected = data?.room && data.room !== room.id;

    // Rời phòng cũ nếu có
    const existingSession = players.get(socket.id);
    if (existingSession) {
      const oldRoom = rooms.get(existingSession.room);
      if (oldRoom) {
        oldRoom.players.delete(socket.id);
        socket.to(oldRoom.id).emit('player:leave', socket.id);
        if (oldRoom.players.size === 0 && !oldRoom.isBase) {
          oldRoom.emptySince = Date.now();
        }
      }
      socket.leave(existingSession.room);
    }

    // Đưa vào phòng mới
    socket.join(room.id);
    room.emptySince = null;

    // Vị trí xuất hiện theo bản đồ của phòng (chùa chính: sân tiền điện, nhìn về chính điện)
    const spawn = spawnPoint(room.map);
    const spawnX = spawn.x;
    const spawnZ = spawn.z;

    const playerData: PlayerData = {
      id: socket.id,
      name,
      robe,
      style,
      room: room.id,
      merit,
      x: spawnX,
      y: 0,
      z: spawnZ,
      ry: spawn.ry,
      anim: 'idle',
      items
    };

    room.players.set(socket.id, playerData);

    const session: PlayerSession = {
      socket,
      ip: clientIp,
      room: room.id,
      data: playerData,
      lastActionTime: 0,
      lastChatTime: 0,
      uid,
      meritCooldown: new Map()
    };
    players.set(socket.id, session);
    touchRecord(uid, { name, merit, robe });

    // Cập nhật thống kê
    stats.totalVisits += 1;

    // Thông báo cho người khác trong phòng
    socket.to(room.id).emit('player:join', playerData);

    // Danh sách người chơi hiện có
    const roomPlayers = Array.from(room.players.values());

    const payload = {
      self: playerData,
      players: roomPlayers,
      room: { id: room.id, name: room.name, count: room.players.size, max: MAX_PER_ROOM, theme: room.theme, map: room.map },
      incense: room.incense,
      flowers: room.flowers,
      lanterns: room.lanterns,
      wishes: room.wishes,
      leaves: room.leaves,
      trays: room.trays,
      uid,
      leaderboard: getLeaderboard(),
      profile: getProfile(uid),
      communal,
      serverTime: Date.now(),
      wasRedirected,
      stats
    };

    if (typeof callback === 'function') {
      callback(payload);
    } else {
      socket.emit('joined', payload);
    }

    // Phát cập nhật danh sách phòng
    io.emit('rooms:list', getRoomList());
  });

  // Di chuyển (move)
  socket.on('move', (data: { x: number; y?: number; z: number; ry: number; anim?: ActionType }) => {
    const session = players.get(socket.id);
    if (!session) return;

    // Giới hạn trong khuôn viên của bản đồ
    const B = getMapSpec(rooms.get(session.room)?.map).bounds;
    const clampedX = Math.max(B.minX, Math.min(B.maxX, Number(data.x) || 0));
    const clampedZ = Math.max(B.minZ, Math.min(B.maxZ, Number(data.z) || 0));
    const y = Math.max(0, Math.min(6, Number(data.y) || 0));
    const ry = Number(data.ry) || 0;
    const anim = data.anim || 'idle';

    session.data.x = clampedX;
    session.data.y = y;
    session.data.z = clampedZ;
    session.data.ry = ry;
    session.data.anim = anim;
  });

  // Hành động (action)
  socket.on('action', (data: { type: ActionType; text?: string }, callback) => {
    const session = players.get(socket.id);
    if (!session) return;

    const now = Date.now();
    if (now - session.lastActionTime < 900) {
      if (typeof callback === 'function') callback({ error: 'Xin thong thả, chánh niệm từng bước 🙏' });
      return;
    }

    const room = rooms.get(session.room);
    if (!room) return;

    const actionType = data.type;
    // Mỗi bản đồ chỉ có một số hành động (chùa chính có thêm các bước phụ bếp)
    const spec = getMapSpec(room.map);
    const kitchenStep = ['take_plate', 'take_bun', 'lift_plate', 'serve'].includes(actionType);
    if (!spec.actions.includes(actionType) && !(kitchenStep && spec.actions.includes('kitchen'))) {
      if (typeof callback === 'function') callback({ error: 'Nơi này không có hoạt động đó 🙏' });
      return;
    }
    session.lastActionTime = now;
    // Làm việc khác (không phải phụ bếp) thì coi như đặt đĩa đang bưng lại
    if (!['take_plate', 'take_bun', 'lift_plate', 'serve'].includes(actionType)) session.carrying = false;
    let meritGain = 0;
    let broadCastText = '';

    switch (actionType) {
      case 'namaste':
        meritGain = 1;
        session.data.anim = 'namaste';
        break;

      case 'bow':
        meritGain = 3;
        stats.bowCount += 1;
        session.data.anim = 'bow';
        break;

      case 'incense': {
        meritGain = 5;
        stats.incenseCount += 1;
        session.data.anim = 'incense';

        // Cắm 3 nén hương vào lòng tro của lư hương lớn (tâm lư: x=0, z=0.4, mặt tro y≈1.63)
        const urn = spec.incense || { x: 0, z: 0.4, y: 1.63, r: 0.8 };
        const angle = Math.random() * Math.PI * 2;
        const radius = urn.r * (0.18 + Math.random() * 0.8);
        const incenseItem: IncenseItem = {
          id: `incense-${now}-${Math.random().toString(36).substr(2, 4)}`,
          x: urn.x + Math.cos(angle) * radius,
          y: urn.y,
          z: urn.z + Math.sin(angle) * radius,
          createdAt: now,
          playerName: session.data.name
        };
        room.incense.push(incenseItem);
        if (room.incense.length > 40) room.incense.shift();
        io.to(room.id).emit('object:incense', incenseItem);
        broadCastText = `${session.data.name} vừa thắp nén tâm hương chí thành 🙏`;
        break;
      }

      case 'flower': {
        meritGain = 5;
        stats.flowerCount += 1;
        session.data.anim = 'flower';

        const flowerItem: FlowerItem = {
          id: `flower-${now}-${Math.random().toString(36).substr(2, 4)}`,
          // Đặt trên mặt bàn thờ (tâm bàn: z=-13.6, mặt bàn y≈2.15), tránh 2 cây nến ở x=±1.8
          x: (spec.flower?.x ?? -1.4) + Math.random() * (spec.flower?.w ?? 2.8),
          y: spec.flower?.y ?? 2.15,
          z: (spec.flower?.z ?? -13.95) + Math.random() * (spec.flower?.d ?? 0.75),
          createdAt: now,
          playerName: session.data.name
        };
        room.flowers.push(flowerItem);
        if (room.flowers.length > 24) room.flowers.shift();
        io.to(room.id).emit('object:flower', flowerItem);
        broadCastText = `${session.data.name} vừa dâng hoa sen cúng dường Tam Bảo 🪷`;
        break;
      }

      case 'wooden_fish':
        meritGain = 2;
        session.data.anim = 'wooden_fish';
        break;

      case 'meditate':
        meritGain = 3;
        session.data.anim = 'meditate';
        break;

      case 'bell': {
        // Cooldown chuông 7 giây cho cả phòng
        if (now - room.lastBellTime < 7000) {
          if (typeof callback === 'function') {
            const waitSec = Math.ceil((7000 - (now - room.lastBellTime)) / 1000);
            callback({ error: `Đại hồng chung vừa thỉnh, xin đợi ${waitSec} giây 🙏` });
          }
          return;
        }
        room.lastBellTime = now;
        meritGain = 3;
        stats.bellCount += 1;
        session.data.anim = 'bell';
        broadCastText = `🔔 ${session.data.name} vừa thỉnh Đại Hồng Chung`;
        io.to(room.id).emit('event:bell', {
          playerName: session.data.name,
          time: now
        });
        break;
      }

      case 'drum': {
        // Cooldown trống 6 giây cho cả phòng
        if (now - room.lastDrumTime < 6000) {
          if (typeof callback === 'function') {
            const waitSec = Math.ceil((6000 - (now - room.lastDrumTime)) / 1000);
            callback({ error: `Trống Bát Nhã vừa đánh, xin đợi ${waitSec} giây 🙏` });
          }
          return;
        }
        room.lastDrumTime = now;
        meritGain = 3;
        stats.drumCount += 1;
        session.data.anim = 'drum';
        broadCastText = `🥁 ${session.data.name} vừa đánh Trống Bát Nhã`;
        io.to(room.id).emit('event:drum', {
          playerName: session.data.name,
          time: now
        });
        break;
      }

      case 'lantern': {
        meritGain = 5;
        stats.lanternCount += 1;
        session.data.anim = 'lantern';

        const wishText = cleanText(data.text || '', 120) || 'Nguyện cầu thế giới hòa bình, muôn loài an lạc';
        const lanternItem: LanternItem = {
          id: `lantern-${now}-${Math.random().toString(36).substr(2, 4)}`,
          seed: Math.floor(Math.random() * 100000),
          // Thả trên mặt hồ sen (tâm hồ: x=-18, z=24; tránh hòn non bộ ở giữa)
          ...(() => {
            const a = Math.random() * Math.PI * 2;
            const r = 3.0 + Math.random() * 3.2;
            return { x: -18 + Math.cos(a) * r, z: 24 + Math.sin(a) * r };
          })(),
          text: wishText,
          createdAt: now,
          playerName: session.data.name
        };
        room.lanterns.push(lanternItem);
        if (room.lanterns.length > 36) room.lanterns.shift();
        io.to(room.id).emit('object:lantern', lanternItem);
        broadCastText = `🏮 ${session.data.name} vừa thả đèn hoa đăng: "${wishText.substring(0, 36)}${wishText.length > 36 ? '...' : ''}"`;
        break;
      }

      case 'wish': {
        // Buộc dải lụa đỏ cầu duyên lên cây đa: mỗi dải 1 chỗ trên cành, đầy thì thay dải cũ nhất
        meritGain = 5;
        stats.wishCount = (stats.wishCount || 0) + 1;
        session.data.anim = 'wish';
        const wishText = cleanText(data.text || '', 120) || 'Cầu cho con sớm gặp được người thương 💞';
        const used = new Set(room.wishes.map(w => w.slot));
        const free = Array.from({ length: WISH_SLOTS }, (_, i) => i).filter(i => !used.has(i));
        let replaced = false;
        let slot: number;
        if (free.length) {
          slot = free[Math.floor(Math.random() * free.length)];
        } else {
          const oldest = room.wishes.shift()!;
          slot = oldest.slot;
          replaced = true;
        }
        const wishItem: WishItem = {
          id: `wish-${now}-${Math.random().toString(36).slice(2, 6)}`,
          slot,
          text: wishText,
          createdAt: now,
          playerName: session.data.name
        };
        room.wishes.push(wishItem);
        if (replaced) syncRoomObjects(room);
        else io.to(room.id).emit('object:wish', wishItem);
        broadCastText = `💞 ${session.data.name} vừa buộc dải lụa cầu duyên lên Cây Đa: "${wishText.substring(0, 36)}${wishText.length > 36 ? '...' : ''}"`;
        break;
      }

      case 'wave':
        meritGain = 0;
        session.data.anim = 'wave';
        break;

      case 'repent':
        // Sám hối trước tượng Địa Tạng Bồ Tát (cảnh địa ngục)
        meritGain = 5;
        session.data.anim = 'repent';
        broadCastText = `${session.data.name} vừa thành tâm sám hối trước Địa Tạng Bồ Tát 🙏`;
        break;

      // ===== PHỤ BẾP: lấy đĩa -> lấy 3 bánh bao -> bê đĩa -> đặt xuống bàn =====
      case 'take_plate':
      case 'take_bun':
      case 'lift_plate': {
        const k = DINING.kitchenSpot;
        const fail = (msg: string) => {
          if (typeof callback === 'function') callback({ error: msg, kitchenPlate: session.kitchenPlate ?? null, carrying: !!session.carrying });
        };
        if (Math.hypot(session.data.x - k.x, session.data.z - k.z) > KITCHEN_REACH) return fail('Hãy đứng tại quầy bếp trai đường 🙏');
        if (session.carrying) return fail('Bạn đang bưng đĩa, hãy mang ra bàn đặt xuống trước 🙏');
        const plate = session.kitchenPlate ?? null;
        if (actionType === 'take_plate') {
          if (plate !== null) return fail('Đĩa đã có trên quầy rồi, hãy lấy bánh bao 🥟');
          session.kitchenPlate = 0;
        } else if (actionType === 'take_bun') {
          if (plate === null) return fail('Hãy lấy đĩa trước 🍽️');
          if (plate >= BUNS_PER_PLATE) return fail('Đĩa đã đủ 3 bánh bao, hãy bê đĩa 🤲');
          session.kitchenPlate = plate + 1;
        } else {
          if (plate === null || plate < BUNS_PER_PLATE) return fail(`Cần đủ ${BUNS_PER_PLATE} bánh bao trên đĩa mới bê được 🥟`);
          session.kitchenPlate = null;
          session.carrying = true;
        }
        session.data.anim = actionType;
        meritGain = 0;
        break;
      }

      case 'serve': {
        // Đặt mâm cơm lên bàn: phải đang bưng mâm và đứng cạnh chỗ đặt
        const slot = Math.floor(Number(data.text));
        if (!session.carrying || !(slot >= 0 && slot < TRAY_SLOTS)) {
          if (typeof callback === 'function') callback({ error: 'Hãy vào bếp bê đĩa bánh bao trước 🙏' });
          return;
        }
        const s = traySlot(slot);
        if (Math.hypot(session.data.x - s.spot.x, session.data.z - s.spot.z) > SERVE_REACH) {
          if (typeof callback === 'function') callback({ error: 'Hãy đến sát bàn để đặt đĩa 🙏' });
          return;
        }
        session.carrying = false;
        room.trays = room.trays.filter(t => t.slot !== slot);
        room.trays.push({
          id: `tray-${now}-${Math.random().toString(36).slice(2, 6)}`,
          slot,
          playerName: session.data.name,
          createdAt: now
        });
        io.to(room.id).emit('trays', room.trays);
        meritGain = 5;
        stats.servedCount = (stats.servedCount || 0) + 1;
        session.data.anim = 'serve';
        broadCastText = `${session.data.name} vừa dọn đĩa bánh bao lên bàn trai đường 🥟`;
        break;
      }

      case 'sweep': {
        // Quét đống lá ở gần: phải đứng cách đống lá dưới 3 mét
        const leafIdx = room.leaves.findIndex(l => l.id === data.text);
        const leaf = room.leaves[leafIdx];
        if (!leaf || Math.hypot(leaf.x - session.data.x, leaf.z - session.data.z) > 3) {
          if (typeof callback === 'function') callback({ error: 'Đống lá này đã được quét rồi 🙏' });
          return;
        }
        room.leaves.splice(leafIdx, 1);
        io.to(room.id).emit('leaves:remove', { id: leaf.id, by: session.data.id });
        meritGain = 2;
        stats.sweepCount = (stats.sweepCount || 0) + 1;
        session.data.anim = 'sweep';
        broadCastText = `${session.data.name} vừa quét sạch lá đa trên sân chùa 🍂`;
        break;
      }

      default:
        session.data.anim = actionType;
    }

    // Hành động bật/tắt: chỉ cộng công đức 1 lần mỗi 20 giây (tránh bấm liên tục để cày điểm)
    if (['namaste', 'meditate', 'wooden_fish'].includes(actionType)) {
      const last = session.meritCooldown.get(actionType) || 0;
      if (now - last < TOGGLE_MERIT_COOLDOWN) meritGain = 0;
      else session.meritCooldown.set(actionType, now);
    }
    addMerit(session, meritGain);

    // Phát action tới mọi người trong phòng
    io.to(room.id).emit('player:action', {
      playerId: socket.id,
      anim: session.data.anim,
      meritGain,
      merit: session.data.merit,
      text: broadCastText
    });

    if (typeof callback === 'function') {
      callback({ ok: true, meritGain, merit: session.data.merit, kitchenPlate: session.kitchenPlate ?? null, carrying: !!session.carrying });
    }
  });

  // Chat
  socket.on('chat', (text: string, callback) => {
    const session = players.get(socket.id);
    if (!session) return;

    const now = Date.now();
    if (now - session.lastChatTime < 700) {
      if (typeof callback === 'function') callback({ error: 'Xin đừng nhắn quá nhanh 🙏' });
      return;
    }

    const cleaned = cleanText(text, 160);
    if (!cleaned) return;

    session.lastChatTime = now;

    const chatMsg: ChatMessage = {
      id: `chat-${now}-${Math.random().toString(36).substr(2, 4)}`,
      playerId: socket.id,
      playerName: session.data.name,
      text: cleaned,
      time: now
    };

    io.to(session.room).emit('chat:message', chatMsg);
    if (typeof callback === 'function') callback({ ok: true });
  });

  // Đổi tên / màu áo / dáng nhân vật ngay trong chùa (không cần tải lại trang)
  socket.on('profile:update', (data: { name?: string; robe?: any; style?: any }, callback) => {
    const session = players.get(socket.id);
    if (!session) return;

    const now = Date.now();
    if (now - (session.lastProfileTime || 0) < 3000) {
      if (typeof callback === 'function') callback({ error: 'Xin chờ vài giây rồi đổi tiếp 🙏' });
      return;
    }

    const p = session.data;
    const oldName = p.name;
    if (typeof data?.name === 'string') {
      const name = cleanText(data.name.trim(), 20);
      if (!name) {
        if (typeof callback === 'function') callback({ error: 'Tên không hợp lệ' });
        return;
      }
      p.name = name;
    }
    if (['blue', 'brown', 'orange', 'grey', 'yellow', 'white', 'moss'].includes(data?.robe)) p.robe = data.robe;
    if (['monk', 'lay'].includes(data?.style)) p.style = data.style;
    session.lastProfileTime = now;
    touchRecord(session.uid, { name: p.name, merit: p.merit, robe: p.robe });
    const week = weeklyStore.get(session.uid);
    if (week) week.name = p.name;
    scheduleLeaderboardBroadcast();

    const update = { id: p.id, name: p.name, robe: p.robe, style: p.style, items: p.items || [] };
    socket.to(session.room).emit('player:update', update);

    if (oldName !== p.name) {
      io.to(session.room).emit('chat:message', {
        id: `sys-${now}`,
        playerId: 'system',
        playerName: 'Chùa',
        text: `${oldName} đã đổi pháp danh thành ${p.name} 🙏`,
        time: now,
        isSystem: true
      } as ChatMessage);
    }
    if (typeof callback === 'function') callback({ ok: true, self: update });
  });

  // ===================== ĐỔI CÔNG ĐỨC =====================
  let lastShopTime = 0;
  const shopGuard = (callback: any) => {
    const now = Date.now();
    if (now - lastShopTime < 400) {
      if (typeof callback === 'function') callback({ error: 'Xin thong thả 🙏' });
      return false;
    }
    lastShopTime = now;
    return true;
  };

  // Vật phẩm đang mang thay đổi -> mọi người trong phòng thấy ngay
  const broadcastItems = (session: PlayerSession) => {
    const p = session.data;
    p.items = getProfile(session.uid).equipped;
    session.socket.to(session.room).emit('player:update', { id: p.id, name: p.name, robe: p.robe, style: p.style, items: p.items });
  };

  socket.on('shop:buy', (data: { itemId?: string }, callback) => {
    const session = players.get(socket.id);
    if (!session || !shopGuard(callback)) return;
    const item = getShopItem(String(data?.itemId));
    const profile = getProfile(session.uid);
    if (!item) return callback?.({ error: 'Vật phẩm không tồn tại' });
    if (profile.owned.includes(item.id)) return callback?.({ error: 'Bạn đã có vật phẩm này rồi' });
    if (profile.balance < item.cost) return callback?.({ error: `Cần ${item.cost} công đức khả dụng, bạn đang có ${profile.balance} 🙏` });

    const owned = [...profile.owned, item.id];
    const equipped = item.kind === 'wear' ? [...profile.equipped, item.id] : profile.equipped;
    touchRecord(session.uid, { spent: profile.spent + item.cost, owned, equipped });
    if (item.kind === 'wear') broadcastItems(session);
    callback?.({ ok: true, profile: getProfile(session.uid) });
  });

  socket.on('shop:equip', (data: { itemId?: string; on?: boolean }, callback) => {
    const session = players.get(socket.id);
    if (!session || !shopGuard(callback)) return;
    const item = getShopItem(String(data?.itemId));
    const profile = getProfile(session.uid);
    if (!item || item.kind !== 'wear' || !profile.owned.includes(item.id)) return callback?.({ error: 'Không thể mang vật phẩm này' });
    const equipped = profile.equipped.filter(id => id !== item.id);
    if (data?.on) equipped.push(item.id);
    touchRecord(session.uid, { equipped });
    broadcastItems(session);
    callback?.({ ok: true, profile: getProfile(session.uid) });
  });

  socket.on('communal:donate', (data: { amount?: number }, callback) => {
    const session = players.get(socket.id);
    if (!session || !shopGuard(callback)) return;
    const project = COMMUNAL_PROJECTS.find(p => p.id === communal.current);
    if (!project) return callback?.({ error: 'Các công trình đã được xây xong hết 🙏' });
    const profile = getProfile(session.uid);
    const done = communal.progress[project.id] || 0;
    const amount = Math.min(Math.floor(Number(data?.amount) || 0), profile.balance, project.goal - done);
    if (amount <= 0) return callback?.({ error: 'Công đức khả dụng không đủ 🙏' });

    touchRecord(session.uid, { spent: profile.spent + amount });
    communal.progress[project.id] = done + amount;
    const now = Date.now();

    if (communal.progress[project.id] >= project.goal) {
      communal.built.push(project.id);
      const next = COMMUNAL_PROJECTS.find(p => !communal.built.includes(p.id));
      communal.current = next ? next.id : null;
      io.emit('chat:message', {
        id: `sys-built-${now}`,
        playerId: 'system',
        playerName: 'Chùa',
        text: `🎉 Nhờ công đức của mọi người, ${project.name} đã được xây xong! ${session.data.name} góp phần hoàn thành 🙏`,
        time: now,
        isSystem: true
      } as ChatMessage);
    } else if (amount >= 20) {
      io.to(session.room).emit('chat:message', {
        id: `sys-donate-${now}`,
        playerId: 'system',
        playerName: 'Chùa',
        text: `${session.data.name} cúng dường ${amount} công đức xây ${project.name} 🙏`,
        time: now,
        isSystem: true
      } as ChatMessage);
    }
    meritDirty = true;
    io.emit('communal', communal);
    callback?.({ ok: true, profile: getProfile(session.uid) });
  });

  // Chuyển phòng (room:switch)
  socket.on('room:switch', (targetRoomId: string, callback) => {
    const session = players.get(socket.id);
    if (!session) return;

    if (session.room === targetRoomId) {
      if (typeof callback === 'function') callback({ ok: true, room: targetRoomId });
      return;
    }

    const targetRoom = resolveRoomForJoin(targetRoomId);

    // Rời phòng cũ
    const oldRoom = rooms.get(session.room);
    if (oldRoom) {
      oldRoom.players.delete(socket.id);
      socket.to(oldRoom.id).emit('player:leave', socket.id);
      if (oldRoom.players.size === 0 && !oldRoom.isBase) {
        oldRoom.emptySince = Date.now();
      }
    }
    socket.leave(session.room);

    // Sang phòng có bản đồ khác: đưa tới điểm xuất hiện của bản đồ mới
    if (!oldRoom || oldRoom.map !== targetRoom.map) {
      const sp = spawnPoint(targetRoom.map);
      session.data.x = sp.x;
      session.data.z = sp.z;
      session.data.y = 0;
      session.data.ry = sp.ry;
    }

    // Vào phòng mới (mâm đang bưng ở phòng cũ coi như đã đặt lại bếp)
    session.carrying = false;
    session.kitchenPlate = null;
    session.room = targetRoom.id;
    session.data.room = targetRoom.id;
    targetRoom.emptySince = null;
    socket.join(targetRoom.id);
    targetRoom.players.set(socket.id, session.data);

    // Thông báo cho phòng mới
    socket.to(targetRoom.id).emit('player:join', session.data);

    const payload = {
      ok: true,
      room: { id: targetRoom.id, name: targetRoom.name, count: targetRoom.players.size, max: MAX_PER_ROOM, theme: targetRoom.theme, map: targetRoom.map },
      self: { x: session.data.x, z: session.data.z, ry: session.data.ry },
      players: Array.from(targetRoom.players.values()),
      incense: targetRoom.incense,
      flowers: targetRoom.flowers,
      lanterns: targetRoom.lanterns,
      wishes: targetRoom.wishes,
      leaves: targetRoom.leaves,
      trays: targetRoom.trays
    };

    if (typeof callback === 'function') {
      callback(payload);
    } else {
      socket.emit('room:switched', payload);
    }

    io.emit('rooms:list', getRoomList());
  });

  // Ngắt kết nối (disconnect)
  socket.on('disconnect', () => {
    const session = players.get(socket.id);
    if (!session) return;

    const room = rooms.get(session.room);
    if (room) {
      room.players.delete(socket.id);
      socket.to(room.id).emit('player:leave', socket.id);
      if (room.players.size === 0 && !room.isBase) {
        room.emptySince = Date.now();
      }
    }

    players.delete(socket.id);
    io.emit('rooms:list', getRoomList());
  });
});

// Broadcast trạng thái vị trí (state loop) mỗi ~80ms (12Hz)
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.size === 0) continue;

    const compactState: [string, number, number, number, number, ActionType][] = [];
    for (const p of room.players.values()) {
      compactState.push([
        p.id,
        Math.round(p.x * 100) / 100,
        Math.round(p.y * 100) / 100,
        Math.round(p.z * 100) / 100,
        Math.round(p.ry * 1000) / 1000,
        p.anim
      ]);
    }

    // Dùng volatile để không nghẽn mạng khi có packet drop
    io.to(room.id).volatile.emit('state', compactState);
  }
}, 80);

// Dọn dẹp đồ vật hết hạn và phòng trống định kỳ mỗi 30 giây
setInterval(() => {
  const now = Date.now();

  for (const [roomId, room] of rooms.entries()) {
    // 1. Hương tồn tại 4 phút (240s)
    const prevIncenseCount = room.incense.length;
    room.incense = room.incense.filter(i => now - i.createdAt < 240000);
    // 2. Hoa tồn tại 12 phút (720s)
    const prevFlowerCount = room.flowers.length;
    room.flowers = room.flowers.filter(f => now - f.createdAt < 720000);
    // 3. Đèn tồn tại 20 phút (1200s)
    const prevLanternCount = room.lanterns.length;
    room.lanterns = room.lanterns.filter(l => now - l.createdAt < 1200000);
    // 4. Dải lụa cầu duyên tồn tại 24 giờ
    const prevWishCount = room.wishes.length;
    room.wishes = room.wishes.filter(w => now - w.createdAt < WISH_TTL_MS);

    if (
      prevIncenseCount !== room.incense.length ||
      prevFlowerCount !== room.flowers.length ||
      prevLanternCount !== room.lanterns.length ||
      prevWishCount !== room.wishes.length
    ) {
      syncRoomObjects(room);
    }

    // Mâm cơm để trên bàn 5 phút thì được dọn đi
    const prevTrays = room.trays.length;
    room.trays = room.trays.filter(t => now - t.createdAt < TRAY_TTL_MS);
    if (prevTrays !== room.trays.length) io.to(room.id).emit('trays', room.trays);

    // 4. Dọn phòng phụ trống quá ROOM_IDLE_MS (5 phút)
    if (!room.isBase && room.players.size === 0 && room.emptySince && (now - room.emptySince > ROOM_IDLE_MS)) {
      rooms.delete(roomId);
      io.emit('rooms:list', getRoomList());
    }
  }
}, 30000);

// Thiết lập chế độ chạy (Vite dev middleware vs Express static)
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { maxAge: '1d' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`🙏 Chùa Online 3D đang phụng sự tại http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`[Chế độ: ${isProd ? 'Production' : 'Development'} | Max/phòng: ${MAX_PER_ROOM}]`);
    startKeepAlive();
  });
}

// Render bản miễn phí cho server "ngủ" sau 15 phút không có ai truy cập.
// Server tự gọi /health của chính nó mỗi 10 phút để luôn thức.
// Trên Render tự có RENDER_EXTERNAL_URL; nơi khác đặt KEEP_ALIVE_URL. KEEP_ALIVE=off để tắt.
function startKeepAlive() {
  const base = (process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
  if (!base || process.env.KEEP_ALIVE === 'off') return;
  const url = `${base}/health`;
  const ping = async () => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'chua-keep-alive' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) console.warn(`[KeepAlive] ${url} -> ${res.status}`);
    } catch (e: any) {
      console.warn(`[KeepAlive] Không gọi được ${url}: ${e?.message || e}`);
    }
  };
  setInterval(ping, 10 * 60 * 1000);
  console.log(`[KeepAlive] Tự gọi ${url} mỗi 10 phút để server không ngủ`);
}

// Graceful shutdown
function shutdown() {
  console.log('Đang lưu công đức và tắt máy chủ trang nghiêm...');
  saveStats();
  saveMerit();
  httpServer.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer().catch(err => {
  console.error('Lỗi khởi động máy chủ:', err);
  process.exit(1);
});
