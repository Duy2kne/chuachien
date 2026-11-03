import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import compression from 'compression';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanText } from './src/server/profanity.js';
import type { PlayerData, RoomInfo, IncenseItem, FlowerItem, LanternItem, ChatMessage, OverallStats, ActionType } from './src/types.js';

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

// Lưu stats định kỳ mỗi 60 giây
setInterval(saveStats, 60000);

interface RoomState {
  id: string;
  name: string;
  isBase: boolean;
  emptySince: number | null;
  players: Map<string, PlayerData>;
  incense: IncenseItem[];
  flowers: FlowerItem[];
  lanterns: LanternItem[];
  lastBellTime: number;
  lastDrumTime: number;
}

const BASE_ROOMS: { id: string; name: string }[] = [
  { id: 'tu-bi', name: 'Từ Bi' },
  { id: 'hy-xa', name: 'Hỷ Xả' },
  { id: 'an-lac', name: 'An Lạc' },
  { id: 'thanh-tinh', name: 'Thanh Tịnh' }
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
    lastBellTime: 0,
    lastDrumTime: 0
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
}

const players = new Map<string, PlayerSession>();
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

// Helper lấy danh sách phòng
function getRoomList(): RoomInfo[] {
  const list: RoomInfo[] = [];
  for (const r of rooms.values()) {
    list.push({
      id: r.id,
      name: r.name,
      count: r.players.size,
      max: MAX_PER_ROOM,
      isBase: r.isBase
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

app.get('/api/stats', (_req, res) => {
  res.json(stats);
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
        if (file.endsWith('.mp3') || file.endsWith('.ogg')) {
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
          lastBellTime: 0,
          lastDrumTime: 0
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
      lastBellTime: 0,
      lastDrumTime: 0
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
  socket.on('room:create', (data: { name?: string }, callback) => {
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
      lastBellTime: 0,
      lastDrumTime: 0
    };

    rooms.set(newId, newRoom);
    ipRoomCreations.set(clientIp, now);
    io.emit('rooms:list', getRoomList());

    if (typeof callback === 'function') {
      callback({ ok: true, room: { id: newRoom.id, name: newRoom.name } });
    }
  });

  // Sự kiện vào chùa (join)
  socket.on('join', (data: { name?: string; robe?: any; style?: any; room?: string; merit?: number }, callback) => {
    const rawName = (data?.name || '').trim();
    const name = cleanText(rawName, 20) || 'Phật tử';
    const robe = ['blue', 'brown', 'orange', 'grey', 'yellow', 'white', 'moss'].includes(data?.robe) ? data.robe : 'blue';
    const style = ['monk', 'lay'].includes(data?.style) ? data.style : 'monk';
    const merit = Math.max(0, Math.min(1000000, Number(data?.merit) || 0));

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

    // Vị trí xuất hiện: sân chùa tiền điện (x: ±1.5, z: 22 ~ 24, nhìn về chính điện ry: Math.PI)
    const spawnX = (Math.random() - 0.5) * 3;
    const spawnZ = 22 + Math.random() * 2;

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
      ry: Math.PI, // Nhìn về phía bắc (Chính điện)
      anim: 'idle'
    };

    room.players.set(socket.id, playerData);

    const session: PlayerSession = {
      socket,
      ip: clientIp,
      room: room.id,
      data: playerData,
      lastActionTime: 0,
      lastChatTime: 0
    };
    players.set(socket.id, session);

    // Cập nhật thống kê
    stats.totalVisits += 1;

    // Thông báo cho người khác trong phòng
    socket.to(room.id).emit('player:join', playerData);

    // Danh sách người chơi hiện có
    const roomPlayers = Array.from(room.players.values());

    const payload = {
      self: playerData,
      players: roomPlayers,
      room: { id: room.id, name: room.name, count: room.players.size, max: MAX_PER_ROOM },
      incense: room.incense,
      flowers: room.flowers,
      lanterns: room.lanterns,
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

    // Giới hạn trong khuôn viên chùa (x: ±35, z: -35 đến 45)
    const clampedX = Math.max(-35, Math.min(35, Number(data.x) || 0));
    const clampedZ = Math.max(-35, Math.min(45, Number(data.z) || 0));
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

    session.lastActionTime = now;
    const actionType = data.type;
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
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.15 + Math.random() * 0.65;
        const incenseItem: IncenseItem = {
          id: `incense-${now}-${Math.random().toString(36).substr(2, 4)}`,
          x: Math.cos(angle) * radius,
          y: 1.63,
          z: 0.4 + Math.sin(angle) * radius,
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
          x: -1.4 + Math.random() * 2.8,
          y: 2.15,
          z: -13.95 + Math.random() * 0.75,
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

      case 'wave':
        meritGain = 0;
        session.data.anim = 'wave';
        break;

      default:
        session.data.anim = actionType;
    }

    session.data.merit += meritGain;

    // Phát action tới mọi người trong phòng
    io.to(room.id).emit('player:action', {
      playerId: socket.id,
      anim: session.data.anim,
      meritGain,
      merit: session.data.merit,
      text: broadCastText
    });

    if (typeof callback === 'function') {
      callback({ ok: true, meritGain, merit: session.data.merit });
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

    // Vào phòng mới
    session.room = targetRoom.id;
    session.data.room = targetRoom.id;
    targetRoom.emptySince = null;
    socket.join(targetRoom.id);
    targetRoom.players.set(socket.id, session.data);

    // Thông báo cho phòng mới
    socket.to(targetRoom.id).emit('player:join', session.data);

    const payload = {
      ok: true,
      room: { id: targetRoom.id, name: targetRoom.name, count: targetRoom.players.size, max: MAX_PER_ROOM },
      players: Array.from(targetRoom.players.values()),
      incense: targetRoom.incense,
      flowers: targetRoom.flowers,
      lanterns: targetRoom.lanterns
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

    if (
      prevIncenseCount !== room.incense.length ||
      prevFlowerCount !== room.flowers.length ||
      prevLanternCount !== room.lanterns.length
    ) {
      io.to(room.id).emit('objects:sync', {
        incense: room.incense,
        flowers: room.flowers,
        lanterns: room.lanterns
      });
    }

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
  });
}

// Graceful shutdown
function shutdown() {
  console.log('Đang lưu công đức và tắt máy chủ trang nghiêm...');
  saveStats();
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
