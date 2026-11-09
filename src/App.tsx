import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TempleWorld } from './scene/templeWorld.js';
import { createWorld } from './scene/maps/index.js';
import { getInfo } from './scene/maps/infoContent.js';
import { getMapSpec, planRoute, isMapId, type MapId } from './shared/maps.js';
import { InfoPanel } from './components/InfoPanel.js';
import { MeditationGuide } from './components/MeditationGuide.js';
import { MiniMap } from './components/MiniMap.js';
import { PlayerAvatar, ACTION_DURATION, type AvatarSoundEvent } from './scene/playerAvatar.js';
import { network } from './network/networkClient.js';
import { sound } from './audio/soundEngine.js';
import type { PlayerData, ActionType, RobeColor, AvatarStyle, RoomInfo, OverallStats, ChatMessage, LanternItem, WishItem, LeaderboardData } from './types.js';
import { EntranceScreen } from './components/EntranceScreen.js';
import { ActionBar } from './components/ActionBar.js';
import { ChatPanel } from './components/ChatPanel.js';
import { RoomModal } from './components/RoomModal.js';
import { LanternDialog } from './components/LanternDialog.js';
import { WishDialog } from './components/WishDialog.js';
import { AdminModal } from './components/AdminModal.js';
import { AudioSettingsModal } from './components/AudioSettingsModal.js';
import { ProfileModal } from './components/ProfileModal.js';
import { LeaderboardModal } from './components/LeaderboardModal.js';
import { ShopModal } from './components/ShopModal.js';
import { COMMUNAL_PROJECTS, type MeritProfile, type CommunalState } from './shared/merit.js';
import { getTheme } from './scene/themes.js';
import { DINING, KITCHEN_REACH, SERVE_REACH, TRAY_SLOTS, traySlot, type TrayItem } from './shared/dining.js';
import { KitchenPanel, kitchenStepEnabled, nextKitchenStep, type KitchenState } from './components/KitchenPanel.js';
import { Sun, Moon, Music, Maximize2, Sparkles, UserPen, Trophy, Gift } from 'lucide-react';

const _targetLook = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _camPivot = new THREE.Vector3();
const _camRay = new THREE.Raycaster();

// Các hành động dạng bật/tắt (bấm lần nữa để dừng)
const TOGGLE_ACTIONS: ActionType[] = ['namaste', 'meditate', 'wooden_fish'];

// Toạ độ các điểm trong chùa (khớp với templeWorld.ts)
const POND_CENTER = { x: -18, z: 24 };   // Hồ sen
const POND_EDGE_RADIUS = 9.0;           // Đứng ngay bên ngoài bờ đá
const faceTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

interface AutoWalkTarget {
  x: number;
  z: number;
  ry: number;
  anim: ActionType;
  text?: string;
  walkTime: number;    // số giây đã tự đi (theo thời gian game, không theo đồng hồ thật)
  bestDist: number;
  stuckTime: number;   // số giây liên tục không tiến gần hơn tới đích
  turnSign: number; // hướng vòng tránh vật cản đang dùng (1 / -1), giữ cố định để không lắc qua lại
  via: { x: number; z: number }[]; // các điểm phải đi qua trước (bậc thềm, cửa nhà ăn)
}

// Leo lên chỗ cao hơn 30cm thì phải đi bậc thềm; bước xuống thì chỗ nào cũng được
const MAX_STEP_UP = 0.3;

// Nút tròn viền vàng trên HUD (giống nút game mobile)
const HUD_BTN =
  'w-9 h-9 sm:w-11 sm:h-11 items-center justify-center rounded-full bg-gradient-to-b from-stone-700/95 to-stone-950/95 border-2 border-amber-500/60 text-amber-200 shadow-[0_4px_12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] hover:border-amber-300 hover:text-amber-100 active:scale-95 transition cursor-pointer';

// Máy có màn cảm ứng: luôn hiện vòng joystick ở góc trái dưới để người chơi biết chỗ chạm
const HAS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
const joystickRest = (h: number) => ({ x: 96, y: h - (h < 520 ? 150 : 210) });

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  // Trạng thái giao diện
  const [hasEntered, setHasEntered] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<{ id: string; name: string; count: number; max: number; theme?: string; map?: string }>({ id: 'tu-bi', name: 'Từ Bi', count: 1, max: 50 });
  // Bản đồ của phòng hiện tại (chùa chính, chùa tháp, địa ngục, thiền đường)
  const mapRef = useRef<MapId>('main');
  const [mapId, setMapId] = useState<MapId>('main');
  // Bảng thông tin của bia / biển tầng đang đứng gần (bấm X để ẩn)
  const [infoId, setInfoId] = useState<string | null>(null);
  const infoIdRef = useRef<string | null>(null);
  const [infoClosed, setInfoClosed] = useState<string | null>(null);
  useEffect(() => { if (!infoId) setInfoClosed(null); }, [infoId]);
  // Nhớ công trình đã xây + bảng xếp hạng để dựng lại khi quay về chùa chính
  const builtRef = useRef<string[]>([]);
  const steleRef = useRef<LeaderboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData>({ all: [], weekly: [], winners: [], week: '' });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // Đổi công đức
  const [profile, setProfile] = useState<MeritProfile>({ merit: 0, spent: 0, balance: 0, owned: [], equipped: [] });
  const [communal, setCommunal] = useState<CommunalState>({ current: COMMUNAL_PROJECTS[0].id, progress: {}, built: [] });
  const [shopTab, setShopTab] = useState<'items' | 'communal' | 'unlock' | null>(null);
  // Đứng gần đống lá -> hiện nhắc "nhấn F để quét"
  const [nearLeaf, setNearLeaf] = useState(false);
  const nearLeafRef = useRef(false);
  const triggerActionRef = useRef<(type: ActionType) => void>(() => {});
  // Phụ bếp: đang bưng mâm cơm, danh sách mâm trên bàn
  const carryingRef = useRef(false);
  const traysRef = useRef<TrayItem[]>([]);
  // Đĩa trên quầy (null = chưa lấy, 0-3 bánh bao) + vị trí so với quầy/bàn để bật tắt nút
  const [kitchen, setKitchen] = useState<KitchenState>({ plate: null, carrying: false });
  const kitchenRef = useRef<KitchenState>({ plate: null, carrying: false });
  const [kitchenCtx, setKitchenCtx] = useState({ inside: false, atCounter: false, serveSlot: null as number | null });
  const kitchenCtxKey = useRef('');
  const kitchenStepRef = useRef<(step: number) => void>(() => {});
  const [roomList, setRoomList] = useState<RoomInfo[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalVisits: 156,
    incenseCount: 420,
    bellCount: 112,
    bowCount: 310,
    lanternCount: 95,
    flowerCount: 78,
    drumCount: 54
  });

  const [merit, setMerit] = useState<number>(0);

  const [floatingMerit, setFloatingMerit] = useState<{ id: number; amount: number }[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentAnim, setCurrentAnim] = useState<ActionType>('idle');
  const [isNavigating, setIsNavigating] = useState(false);

  // Modals
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [wishModal, setWishModal] = useState<{ open: boolean; mode: 'tie' | 'view'; item?: WishItem | null }>({ open: false, mode: 'tie' });
  // Trang quản trị: mở từ nút 🛡️ ở màn hình vào chùa hoặc địa chỉ có #admin
  const [showAdmin, setShowAdmin] = useState(() => typeof window !== 'undefined' && window.location.hash === '#admin');
  const [lanternModalState, setLanternModalState] = useState<{
    open: boolean;
    mode: 'release' | 'view';
    viewingItem?: LanternItem | null;
  }>({ open: false, mode: 'release' });

  // Chat & Players
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isNight, setIsNight] = useState(false);
  const [onlinePlayersList, setOnlinePlayersList] = useState<PlayerData[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [viewH, setViewH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Joystick ảo động (Dynamic Virtual Joystick)
  const [dynamicJoystick, setDynamicJoystick] = useState<{
    visible: boolean;
    originX: number;
    originY: number;
    knobX: number;
    knobY: number;
  }>({ visible: false, originX: 0, originY: 0, knobX: 0, knobY: 0 });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<TempleWorld | null>(null);
  const selfAvatarRef = useRef<PlayerAvatar | null>(null);
  const otherAvatarsRef = useRef<Map<string, PlayerAvatar>>(new Map());
  const destinationMarkerRef = useRef<THREE.Mesh | null>(null);

  // Input state
  const keysPressed = useRef<Record<string, boolean>>({});
  const joystickVector = useRef<{ x: number; y: number; isRunning: boolean }>({ x: 0, y: 0, isRunning: false });
  const cameraAngle = useRef({ theta: 0, phi: 0.25, dist: 5.4 });
  const autoWalkTarget = useRef<AutoWalkTarget | null>(null);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Pointer IDs tracking for multi-touch (Left = Joystick, Right = Camera/Pinch)
  const joystickPointerId = useRef<number | null>(null);
  const cameraPointerId = useRef<number | null>(null);
  const secondPointerId = useRef<number | null>(null);
  const lastCameraPointerPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPinchDistance = useRef<number | null>(null);
  const tapCandidate = useRef<{ startTime: number; startX: number; startY: number } | null>(null);

  // Tải danh sách phòng ban đầu & phát hiện thiết bị cảm ứng
  useEffect(() => {
    // Công trình đã xây + bia công đức hiện ngay cả ở màn hình chờ
    fetch('/api/shop')
      .then(res => res.json())
      .then(data => {
        if (!data?.communal) return;
        setCommunal(data.communal);
        setBuilt(data.communal.built, false);
      })
      .catch(() => {});
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then((data: LeaderboardData) => {
        if (!data?.all) return;
        setLeaderboard(data);
        updateSteleFrom(data);
      })
      .catch(() => {});

    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        if (data.rooms) setRoomList(data.rooms);
        if (data.stats) setOverallStats(data.stats);
      })
      .catch(() => {});

    const hour = new Date().getHours();
    setIsNight(hour < 6 || hour >= 18);

    if (typeof window !== 'undefined') {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768);
    }
  }, []);

  // Thiết lập mạng Socket.IO callbacks
  useEffect(() => {
    network.onRoomsList = (rooms) => setRoomList(rooms);

    network.onPlayerJoined = (player) => {
      if (sceneRef.current && !otherAvatarsRef.current.has(player.id)) {
        otherAvatarsRef.current.set(player.id, createAvatar(player, false));
        updateOnlinePlayers();
      }
    };

    network.onPlayerLeft = (playerId) => {
      const avatar = otherAvatarsRef.current.get(playerId);
      if (avatar && sceneRef.current) {
        sceneRef.current.remove(avatar.group);
        avatar.dispose();
        otherAvatarsRef.current.delete(playerId);
        updateOnlinePlayers();
      }
    };

    network.onStateUpdate = (compactState) => {
      for (const [id, x, y, z, ry, anim] of compactState) {
        if (id === network.selfData?.id) continue;
        const avatar = otherAvatarsRef.current.get(id);
        if (avatar) {
          avatar.targetPos.set(x, y, z);
          avatar.targetRy = ry;
          avatar.currentAnim = anim;
        }
      }
    };

    network.onPlayerAction = (data) => {
      if (data.playerId !== network.selfData?.id) {
        const avatar = otherAvatarsRef.current.get(data.playerId);
        if (avatar) avatar.currentAnim = data.anim;
      }
      if (data.text) showToast(data.text);
    };

    network.onMeritUpdate = ({ id, merit: value, gain }) => {
      setOverallStats(prev => ({ ...prev, totalMerit: (prev.totalMerit || 0) + gain }));
      if (id === network.selfData?.id) {
        setMerit(value);
        if (selfAvatarRef.current) selfAvatarRef.current.data.merit = value;
        addMeritEffect(gain);
      } else {
        const avatar = otherAvatarsRef.current.get(id);
        if (avatar) avatar.data.merit = value;
      }
      updateOnlinePlayers();
    };
    network.onLeaderboard = (data) => {
      setLeaderboard(data);
      updateSteleFrom(data);
    };
    network.onProfile = (p) => setProfile(p);
    network.onCommunal = (state) => {
      setCommunal(prev => {
        const newly = state.built.filter(id => !prev.built.includes(id));
        for (const id of newly) {
          const proj = COMMUNAL_PROJECTS.find(p => p.id === id);
          if (proj) showToast(`🎉 ${proj.icon} ${proj.name} đã được xây xong!`);
        }
        return state;
      });
      setBuilt(state.built, true);
    };
    network.onLeafAdded = (leaf) => worldRef.current?.addLeafPile(leaf, true);
    network.onTrays = (trays) => {
      traysRef.current = trays;
      worldRef.current?.syncTrays(trays);
    };
    // Lá biến mất sau khi chổi quét được vài nhịp
    network.onLeafRemoved = ({ id }) => worldRef.current?.removeLeafPile(id, 1700);

    network.onPlayerUpdated = (data) => {
      const avatar = otherAvatarsRef.current.get(data.id);
      if (!avatar) return;
      otherAvatarsRef.current.set(data.id, rebuildAvatar(avatar, data));
      updateOnlinePlayers();
    };

    network.onChatMessage = (msg) => {
      setMessages(prev => [...prev.slice(-40), msg]);
      if (msg.playerId === network.selfData?.id) {
        selfAvatarRef.current?.showSpeechBubble(msg.text);
      } else {
        const avatar = otherAvatarsRef.current.get(msg.playerId);
        avatar?.showSpeechBubble(msg.text);
      }
    };

    network.onBellRung = (data) => {
      // Chày gỗ chạm chuông sau động tác kéo dây (~0.9s)
      setTimeout(() => {
        worldRef.current?.triggerBellRing();
        sound.playBigBell(1.0);
      }, 900);
      showToast(`🔔 ${data.playerName} vừa thỉnh Đại Hồng Chung`);
    };

    network.onDrumBeaten = (data) => {
      // 3 tiếng trống khớp với 3 nhịp dùi của nhân vật
      for (const ms of [600, 1200, 1800]) {
        setTimeout(() => {
          worldRef.current?.triggerDrumBeat();
          sound.playDrum(1.0);
        }, ms);
      }
      showToast(`🥁 ${data.playerName} vừa đánh Trống Bát Nhã`);
    };

    network.onNewIncense = (item) => worldRef.current?.addObjects([item], [], []);
    network.onNewFlower = (item) => worldRef.current?.addObjects([], [item], []);
    network.onNewLantern = (item) => worldRef.current?.addObjects([], [], [item]);
    network.onObjectsSync = (data) => {
      worldRef.current?.syncObjects(data.incense, data.flowers, data.lanterns);
      if (data.wishes) worldRef.current?.syncWishes(data.wishes);
    };
    network.onNewWish = (item) => worldRef.current?.addWishes([item], true);
    network.onNotice = ({ text }) => showToast(text);
    network.onConnectionStateChange = (_connected, msg) => { if (msg) showToast(msg); };
  }, []);

  const playAvatarSound = (type: AvatarSoundEvent, avatar: PlayerAvatar) => {
    const self = selfAvatarRef.current;
    const dist = self ? self.group.position.distanceTo(avatar.group.position) : 0;
    if (dist > 30) return;
    if (type === 'mo') sound.playWoodenFish(Math.max(1, dist / 4));
    else if (dist < 14) sound.playChime();
  };

  const createAvatar = (data: PlayerData, isSelf: boolean) => {
    const avatar = new PlayerAvatar(data, isSelf);
    avatar.onSound = playAvatarSound;
    if (isSelf) {
      avatar.onActionFinished = (anim) => {
        if (avatar.currentAnim !== anim) return;
        avatar.currentAnim = carryingRef.current ? 'carry' : 'idle';
        setCurrentAnim(avatar.currentAnim);
      };
    }
    sceneRef.current?.add(avatar.group);
    return avatar;
  };

  const rebuildAvatar = (old: PlayerAvatar, patch: Partial<PlayerData>) => {
    const data: PlayerData = {
      ...old.data,
      ...patch,
      x: old.group.position.x,
      y: old.group.position.y,
      z: old.group.position.z,
      ry: old.group.rotation.y,
      anim: old.currentAnim
    };
    sceneRef.current?.remove(old.group);
    old.dispose();
    const fresh = createAvatar(data, old.isSelf);
    fresh.targetPos.copy(old.targetPos);
    fresh.targetRy = old.targetRy;
    return fresh;
  };

  // Lưu hồ sơ mới: gửi lên server, đổi nhân vật của mình ngay lập tức
  useEffect(() => {
    const self = selfAvatarRef.current;
    if (!self) return;
    const now = [...profile.equipped].sort().join(',');
    const was = [...(self.data.items || [])].sort().join(',');
    if (now !== was) {
      selfAvatarRef.current = rebuildAvatar(self, { items: profile.equipped });
      updateOnlinePlayers();
    }
  }, [profile.equipped]);

  const handleSaveProfile = async (data: { name: string; robe: RobeColor; style: AvatarStyle }) => {
    const res = await network.updateProfile(data);
    if (res.error) return res.error;
    const self = selfAvatarRef.current;
    if (self) selfAvatarRef.current = rebuildAvatar(self, data);
    try {
      localStorage.setItem('chua_name', data.name);
      localStorage.setItem('chua_robe', data.robe);
      localStorage.setItem('chua_style', data.style);
    } catch {}
    updateOnlinePlayers();
    showToast(`Đã cập nhật hồ sơ: ${data.name} 🙏`);
    return null;
  };

  // Khắc tên người đứng đầu các tuần lên bia công đức trong sân chùa
  const setBuilt = (ids: string[], animate: boolean) => {
    builtRef.current = ids;
    worldRef.current?.setBuiltProjects(ids, animate);
  };

  const updateSteleFrom = (data: LeaderboardData) => {
    steleRef.current = data;
    const leader = data.weekly[0] ? { name: data.weekly[0].name, merit: data.weekly[0].merit } : null;
    worldRef.current?.updateStele(data.winners, leader);
  };

  // Gọi API đổi công đức, cập nhật hồ sơ; trả về thông báo lỗi (nếu có)
  const shopAction = async (call: Promise<{ ok?: boolean; error?: string; profile?: MeritProfile }>) => {
    const res = await call;
    if (res.profile) setProfile(res.profile);
    return res.error || null;
  };

  const handleEquipSelf = async (itemId: string, on: boolean) => {
    const err = await shopAction(network.equipItem(itemId, on));
    return err;
  };

  const updateOnlinePlayers = () => {
    const list: PlayerData[] = [];
    if (selfAvatarRef.current) list.push(selfAvatarRef.current.data);
    for (const a of otherAvatarsRef.current.values()) list.push(a.data);
    setOnlinePlayersList(list);
  };

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage(prev => prev === text ? null : prev);
    }, 4500);
  };

  // Hiệu ứng "+N" bay lên khi được cộng công đức (con số thật do server gửi qua merit:update)
  const addMeritEffect = (gain: number) => {
    if (gain <= 0) return;

    const id = Date.now();
    setFloatingMerit(prev => [...prev, { id, amount: gain }]);
    setTimeout(() => {
      setFloatingMerit(prev => prev.filter(m => m.id !== id));
    }, 1800);
  };

  // Khởi tạo Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;

    // 1. Renderer với colorSpace, ACESFilmicToneMapping & PCFSoftShadowMap
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    // Giới hạn devicePixelRatio tối đa 1.5 trên mobile
    renderer.setPixelRatio(isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2.0));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.3,
      1000
    );
    cameraRef.current = camera;

    // RoomEnvironment + PMREMGenerator để vật liệu kim loại phản chiếu đẹp
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Vòng tròn chỉ thị điểm đến khi chạm (Destination marker)
    const destGeo = new THREE.RingGeometry(0.2, 0.45, 24);
    const destMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0
    });
    const destMarker = new THREE.Mesh(destGeo, destMat);
    destMarker.rotation.x = -Math.PI / 2;
    destMarker.position.y = 0.05;
    scene.add(destMarker);
    destinationMarkerRef.current = destMarker;

    // 4. Dựng Thế giới Chùa 3D hoàn chỉnh
    const world = createWorld(scene, mapRef.current);
    worldRef.current = world;
    world.setDayNight(isNight);
    // Chỉ khi chạy dev: cho script kiểm tra giao diện điều khiển camera
    if (import.meta.env.DEV) (window as any).__chua = { scene, camera, world };

    // Hiệu ứng toả sáng (bloom): đèn lồng, đèn đá, trăng, đèn trời có quầng sáng lung linh
    const composer = new EffectComposer(renderer);
    if (!isMobile) {
      composer.renderTarget1.samples = 4; // khử răng cưa trên máy tính
      composer.renderTarget2.samples = 4;
    }
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.5, 0.45, 0.82);
    if (isMobile) {
      // điện thoại: tính bloom ở nửa độ phân giải cho nhẹ máy
      const setBloomSize = bloom.setSize.bind(bloom);
      bloom.setSize = (w: number, h: number) => setBloomSize(Math.max(2, w * 0.5), Math.max(2, h * 0.5));
    }
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setSize(container.clientWidth, container.clientHeight);

    // 5. Vòng lặp Render (Animation loop)
    let frameId = 0;
    const clock = new THREE.Clock();

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      // Thế giới có thể được dựng lại khi đổi sang phòng có bản đồ khác
      const w = worldRef.current!;

      // Cập nhật hoạt ảnh môi trường (khói hương, mây trôi, cánh hoa rơi)
      w.update(delta, elapsed);

      // Cập nhật vòng đánh dấu điểm đến (nếu đang đi tới)
      if (destinationMarkerRef.current && destinationMarkerRef.current.material) {
        const mat = destinationMarkerRef.current.material as THREE.MeshBasicMaterial;
        if (autoWalkTarget.current) {
          mat.opacity = 0.6 + Math.sin(elapsed * 6) * 0.3;
          destinationMarkerRef.current.rotation.z += delta * 2;
        } else {
          mat.opacity = THREE.MathUtils.damp(mat.opacity, 0.0, 10, delta);
        }
      }

      if (selfAvatarRef.current) {
        handlePlayerMovement(delta, elapsed);
        selfAvatarRef.current.update(delta, elapsed);

        const sp = selfAvatarRef.current.group.position;
        w.updateInterior(sp.x, sp.z);
        const inside = w.isInsideDining(sp.x, sp.z);
        const k = DINING.kitchenSpot;
        const atCounter = Math.hypot(sp.x - k.x, sp.z - k.z) < KITCHEN_REACH - 0.2;
        const serveSlot = kitchenRef.current.carrying ? findServeSlot(sp.x, sp.z) : null;
        const key = `${inside ? 1 : 0}${atCounter ? 1 : 0}${serveSlot ?? '-'}`;
        if (key !== kitchenCtxKey.current) {
          kitchenCtxKey.current = key;
          setKitchenCtx({ inside, atCounter, serveSlot });
        }
        const pile = w.getNearestLeafPile(sp.x, sp.z);
        const near = !!pile && Math.hypot(pile.x - sp.x, pile.z - sp.z) < 3 && selfAvatarRef.current.currentAnim !== 'sweep';
        if (near !== nearLeafRef.current) {
          nearLeafRef.current = near;
          setNearLeaf(near);
        }
        // Đứng gần bia / biển tầng thì hiện bảng thông tin
        let info: string | null = null;
        let best = Infinity;
        for (const ip of w.infoPoints) {
          const d = Math.hypot(ip.x - sp.x, ip.z - sp.z);
          if (d < ip.r && d < best) {
            best = d;
            info = ip.id;
          }
        }
        if (info !== infoIdRef.current) {
          infoIdRef.current = info;
          setInfoId(info);
        }
      } else {
        // Camera quay chậm ngắm cảnh chùa ban đầu
        const o = w.spec.orbit;
        cameraAngle.current.theta += delta * 0.1;
        const camX = o.x + Math.sin(cameraAngle.current.theta) * o.r;
        const camZ = o.z + Math.cos(cameraAngle.current.theta) * o.r;
        camera.position.set(camX, o.h, camZ);
        camera.lookAt(o.x, o.y, o.z);
      }

      for (const other of otherAvatarsRef.current.values()) {
        other.update(delta, elapsed);
      }

      // ban đêm toả sáng mạnh, ban ngày chỉ nhẹ để không chói
      const bl = w.theme.bloom;
      bloom.strength = bl ? bl[0] : w.isNight ? 0.35 : 0.12;
      bloom.threshold = bl ? bl[1] : w.isNight ? 0.88 : 0.95;
      composer.render(delta);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      composer.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    worldRef.current?.setDayNight(isNight);
  }, [isNight]);

  // Bắt đầu tự đi tới một vị trí (bấm hành động hoặc chạm mặt đất)
  const startAutoWalk = (x: number, z: number, ry: number, anim: ActionType, text?: string) => {
    const from = selfAvatarRef.current?.group.position;
    const via = from ? planRoute(mapRef.current, from.x, from.z, x, z) : [];
    autoWalkTarget.current = { x, z, ry, anim, text, walkTime: 0, bestDist: Infinity, stuckTime: 0, turnSign: 0, via };
    setIsNavigating(true);
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.position.set(x, (worldRef.current?.getGroundHeight(x, z) || 0) + 0.05, z);
    }
  };

  // Điều khiển di chuyển nhân vật
  const handlePlayerMovement = (delta: number, elapsed: number) => {
    const avatar = selfAvatarRef.current;
    const world = worldRef.current;
    if (!avatar || !world || !cameraRef.current) return;
    const pos = avatar.group.position;

    let moveX = 0;
    let moveZ = 0;
    let isRunning = false;

    const hasManualInput =
      keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] ||
      keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'] ||
      keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft'] ||
      keysPressed.current['KeyD'] || keysPressed.current['ArrowRight'] ||
      Math.hypot(joystickVector.current.x, joystickVector.current.y) > 0.1;

    // 1. Tự động đi tới vị trí khi bấm hành động hoặc chạm vào mặt đất
    if (autoWalkTarget.current && hasManualInput) {
      autoWalkTarget.current = null;
      setIsNavigating(false);
    }

    // Tới điểm đi qua (bậc thềm, cửa) thì chuyển sang điểm tiếp theo
    const wp = autoWalkTarget.current?.via[0];
    if (wp && Math.hypot(wp.x - pos.x, wp.z - pos.z) < 0.45) {
      autoWalkTarget.current!.via.shift();
      autoWalkTarget.current!.bestDist = Infinity;
      autoWalkTarget.current!.stuckTime = 0;
    }

    if (autoWalkTarget.current) {
      const target = autoWalkTarget.current;
      const goal = target.via[0] || target;
      const dx = goal.x - pos.x;
      const dz = goal.z - pos.z;
      const dist = target.via.length ? Math.max(0.31, Math.hypot(dx, dz)) : Math.hypot(dx, dz);

      target.walkTime += delta;
      if (dist < target.bestDist - 0.05) {
        target.bestDist = dist;
        target.stuckTime = 0;
      } else {
        target.stuckTime += delta;
      }
      // Bị kẹt quá 1.5 giây (hoặc đi quá 8 giây) thì dịch chuyển thẳng tới đích
      const stuck = target.stuckTime > 1.5 || target.walkTime > 12;

      if (dist < 0.3 || stuck) {
        pos.x = target.x;
        pos.z = target.z;
        pos.y = world.getGroundHeight(target.x, target.z);
        avatar.group.rotation.y = target.ry;
        autoWalkTarget.current = null;
        setIsNavigating(false);
        if (target.anim !== 'walk') {
          triggerActionDirect(target.anim, target.text);
        } else if (['walk', 'run'].includes(avatar.currentAnim)) {
          avatar.currentAnim = 'idle';
          setCurrentAnim('idle');
        }
      } else {
        moveX = dx / dist;
        moveZ = dz / dist;
        isRunning = dist > 6.0;
      }
    } else {
      // 2. Di chuyển bằng phím hoặc Joystick ảo (tiến/lùi theo hướng camera, trái/phải theo màn hình)
      let forward = 0;
      let strafe = 0;

      if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) forward += 1;
      if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) forward -= 1;
      if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) strafe -= 1;
      if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) strafe += 1;

      const joyLen = Math.hypot(joystickVector.current.x, joystickVector.current.y);
      if (joyLen > 0.1) {
        strafe += joystickVector.current.x;
        forward -= joystickVector.current.y;
        isRunning = joystickVector.current.isRunning;
      }

      if (keysPressed.current['ShiftLeft'] || keysPressed.current['ShiftRight']) {
        isRunning = true;
      }

      if (forward !== 0 || strafe !== 0) {
        const angle = cameraAngle.current.theta;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Camera nằm ở hướng (sin, cos) so với nhân vật: tiến = ngược hướng đó, phải = (cos, -sin)
        moveX = -forward * sin + strafe * cos;
        moveZ = -forward * cos - strafe * sin;

        const len = Math.hypot(moveX, moveZ);
        if (len > 0.01) {
          moveX /= len;
          moveZ /= len;
        }
      }
    }

    const speed = (isRunning ? 5.2 : 3.0) * delta;

    if (Math.hypot(moveX, moveZ) > 0.05) {
      const groundNow = world.getGroundHeight(pos.x, pos.z);
      const tryMove = (mx: number, mz: number) => {
        const col = world.checkCollision(pos.x + mx, pos.z + mz);
        if (!col.allowed) return false;
        // Không leo thẳng lên mép cao (nền chính điện cao 0.9m): phải đi bậc thềm
        if (world.getGroundHeight(pos.x + mx, pos.z + mz) - groundNow > MAX_STEP_UP) return false;
        pos.x += mx;
        pos.z += mz;
        return true;
      };

      const target = autoWalkTarget.current;
      if (target) {
        // Tự đi: bị chắn thì rẽ vòng qua vật cản (giữ một bên rẽ cố định cho tới khi đi thẳng lại được)
        if (tryMove(moveX * speed, moveZ * speed)) {
          target.turnSign = 0;
        } else {
          const signs = target.turnSign ? [target.turnSign, -target.turnSign] : [1, -1];
          let found = false;
          for (const turn of [0.5, 0.9, 1.3, 1.65]) {
            for (const sign of signs) {
              const c = Math.cos(turn * sign);
              const sn = Math.sin(turn * sign);
              const tx = moveX * c - moveZ * sn;
              const tz = moveX * sn + moveZ * c;
              if (tryMove(tx * speed, tz * speed)) {
                target.turnSign = sign;
                moveX = tx;
                moveZ = tz;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
      } else {
        // Điều khiển tay: bị chắn thì trượt dọc theo vật cản
        tryMove(moveX * speed, moveZ * speed) ||
          tryMove(moveX * speed, 0) ||
          tryMove(0, moveZ * speed);
      }

      const targetRy = Math.atan2(moveX, moveZ);
      let diffRy = targetRy - avatar.group.rotation.y;
      while (diffRy > Math.PI) diffRy -= Math.PI * 2;
      while (diffRy < -Math.PI) diffRy += Math.PI * 2;
      avatar.group.rotation.y += diffRy * Math.min(1, delta * 15);

      const anim: ActionType = carryingRef.current ? 'carry' : isRunning ? 'run' : 'walk';
      if (avatar.currentAnim !== anim) {
        avatar.currentAnim = anim;
        setCurrentAnim(anim);
      }
    } else if (!autoWalkTarget.current && ['walk', 'run'].includes(avatar.currentAnim)) {
      avatar.currentAnim = carryingRef.current ? 'carry' : 'idle';
      setCurrentAnim(avatar.currentAnim);
    }

    // Độ cao theo nền (bậc thềm chính điện, lầu chuông)
    pos.y = THREE.MathUtils.damp(pos.y, world.getGroundHeight(pos.x, pos.z), 12, delta);

    // Đồng bộ vị trí + hành động (tự giới hạn ~12 lần/giây, chỉ gửi khi thay đổi)
    network.sendMove(pos.x, pos.y, pos.z, avatar.group.rotation.y, avatar.currentAnim);

    // 3. Camera theo dõi góc nhìn thứ 3 (tự rút lại gần khi bị cột, tường, lư hương che)
    const { theta, phi } = cameraAngle.current;
    _camDir.set(Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi)).normalize();
    _camPivot.set(pos.x, pos.y + 1.25, pos.z);
    let dist = cameraAngle.current.dist;
    _camRay.set(_camPivot, _camDir);
    _camRay.far = dist;
    const blockHit = _camRay.intersectObjects(world.cameraBlockers, false)[0];
    if (blockHit) dist = Math.max(1.8, blockHit.distance - 0.35);
    // Không để camera chui xuống dưới mặt đất
    const targetCamX = _camPivot.x + _camDir.x * dist;
    const targetCamY = Math.max(pos.y + 0.4, _camPivot.y + _camDir.y * dist);
    const targetCamZ = _camPivot.z + _camDir.z * dist;

    cameraRef.current.position.set(
      THREE.MathUtils.damp(cameraRef.current.position.x, targetCamX, 10, delta),
      THREE.MathUtils.damp(cameraRef.current.position.y, targetCamY, 10, delta),
      THREE.MathUtils.damp(cameraRef.current.position.z, targetCamZ, 10, delta)
    );

    _targetLook.set(
      avatar.group.position.x,
      avatar.group.position.y + 1.1,
      avatar.group.position.z
    );
    cameraRef.current.lookAt(_targetLook);
  };

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      keysPressed.current[e.code] = true;
      if (e.code === 'KeyF' && nearLeafRef.current && !e.repeat) triggerActionRef.current('sweep');
      // Phụ bếp: 1 lấy đĩa, 2 lấy bánh bao, 3 bê đĩa, 4 đặt xuống, E = bước tiếp theo
      if (!e.repeat && (kitchenCtxKey.current.startsWith('1') || kitchenRef.current.carrying)) {
        const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (digit >= 0) kitchenStepRef.current(digit + 1);
        if (e.code === 'KeyE') kitchenStepRef.current(nextKitchenStep(kitchenRef.current));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // =========================================================================
  // XỬ LÝ CẢM ỨNG ĐA ĐIỂM (MULTI-TOUCH) & POINTER EVENTS TOÀN DIỆN
  // Nửa trái = Joystick ảo động (Dynamic Joystick)
  // Nửa phải = Xoay camera & Pinch-to-zoom & Chạm để đi (Tap-to-move)
  // =========================================================================
  const handlePointerDown = (e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    // Joystick chỉ dành cho cảm ứng ở nửa trái màn hình; chuột luôn dùng để xoay camera / bấm để đi
    const isTouchJoystick = e.pointerType !== 'mouse' && e.clientX < window.innerWidth / 2;

    if (isTouchJoystick && joystickPointerId.current === null) {
      joystickPointerId.current = e.pointerId;
      const rest = joystickRest(window.innerHeight);
      const nearRest = Math.hypot(e.clientX - rest.x, e.clientY - rest.y) < 90;
      const ox = nearRest ? rest.x : e.clientX;
      const oy = nearRest ? rest.y : e.clientY;
      setDynamicJoystick({ visible: true, originX: ox, originY: oy, knobX: 0, knobY: 0 });
      joystickVector.current = { x: 0, y: 0, isRunning: false };
      return;
    }

    if (cameraPointerId.current === null) {
      cameraPointerId.current = e.pointerId;
      lastCameraPointerPos.current = { x: e.clientX, y: e.clientY };
      tapCandidate.current = { startTime: Date.now(), startX: e.clientX, startY: e.clientY };
    } else if (secondPointerId.current === null) {
      secondPointerId.current = e.pointerId;
      lastPinchDistance.current = null;
      tapCandidate.current = null; // 2 ngón thì không phải là chạm để đi
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // 1. Ngón tay điều khiển Joystick
    if (e.pointerId === joystickPointerId.current) {
      const radius = 60;
      const dx = e.clientX - dynamicJoystick.originX;
      const dy = e.clientY - dynamicJoystick.originY;
      const dist = Math.hypot(dx, dy);
      const clampedX = dist > radius ? (dx / dist) * radius : dx;
      const clampedY = dist > radius ? (dy / dist) * radius : dy;

      setDynamicJoystick(prev => ({ ...prev, knobX: clampedX, knobY: clampedY }));

      // Vùng chết 10%, kéo xa hơn 70% bán kính thì chạy
      const normalizedDist = dist / radius;
      joystickVector.current = normalizedDist > 0.1
        ? { x: clampedX / radius, y: clampedY / radius, isRunning: normalizedDist > 0.7 }
        : { x: 0, y: 0, isRunning: false };
      return;
    }

    if (e.pointerId !== cameraPointerId.current && e.pointerId !== secondPointerId.current) return;

    if (tapCandidate.current) {
      const moveDist = Math.hypot(e.clientX - tapCandidate.current.startX, e.clientY - tapCandidate.current.startY);
      if (moveDist > 12) tapCandidate.current = null;
    }

    // 2. Hai ngón: chụm / mở để zoom
    if (cameraPointerId.current !== null && secondPointerId.current !== null) {
      const a = activePointers.current.get(cameraPointerId.current);
      const b = activePointers.current.get(secondPointerId.current);
      if (a && b) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastPinchDistance.current !== null) {
          cameraAngle.current.dist = Math.max(3.0, Math.min(13.0, cameraAngle.current.dist - (d - lastPinchDistance.current) * 0.02));
        }
        lastPinchDistance.current = d;
      }
      return;
    }

    // 3. Một ngón / kéo chuột: xoay camera quanh nhân vật
    if (e.pointerId === cameraPointerId.current) {
      const dx = e.clientX - lastCameraPointerPos.current.x;
      const dy = e.clientY - lastCameraPointerPos.current.y;
      lastCameraPointerPos.current = { x: e.clientX, y: e.clientY };
      cameraAngle.current.theta -= dx * 0.0055;
      cameraAngle.current.phi = Math.max(0.06, Math.min(1.22, cameraAngle.current.phi + dy * 0.0045));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);

    if (e.pointerId === joystickPointerId.current) {
      joystickPointerId.current = null;
      setDynamicJoystick(prev => ({ ...prev, visible: false, knobX: 0, knobY: 0 }));
      joystickVector.current = { x: 0, y: 0, isRunning: false };
      return;
    }

    if (e.pointerId === secondPointerId.current) {
      secondPointerId.current = null;
      lastPinchDistance.current = null;
      return;
    }

    if (e.pointerId === cameraPointerId.current) {
      cameraPointerId.current = null;
      // Ngón còn lại (nếu có) tiếp tục xoay camera
      if (secondPointerId.current !== null) {
        cameraPointerId.current = secondPointerId.current;
        secondPointerId.current = null;
        lastPinchDistance.current = null;
        const rest = activePointers.current.get(cameraPointerId.current);
        if (rest) lastCameraPointerPos.current = { ...rest };
      }

      if (tapCandidate.current) {
        const duration = Date.now() - tapCandidate.current.startTime;
        const moveDist = Math.hypot(e.clientX - tapCandidate.current.startX, e.clientY - tapCandidate.current.startY);
        if (duration < 300 && moveDist < 12) handleTapRaycast(e.clientX, e.clientY);
        tapCandidate.current = null;
      }
    }
  };

  // Xử lý Chạm để đi (Tap-to-move) hoặc chạm vào đèn hoa đăng / người khác
  const handleTapRaycast = (clientX: number, clientY: number) => {
    if (!cameraRef.current || !sceneRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, cameraRef.current);

    // 1. Kiểm tra chạm vào đèn hoa đăng trên hồ sen
    if (worldRef.current) {
      const pondHits = raycaster.intersectObjects(worldRef.current.lanternLayer.children, true);
      for (const hit of pondHits) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if ((curr as any).userData?.lanternData) {
            const item = (curr as any).userData.lanternData as LanternItem;
            setLanternModalState({ open: true, mode: 'view', viewingItem: item });
            return;
          }
          curr = curr.parent;
        }
      }
    }

    // 1b. Chạm vào dải lụa cầu duyên trên Cây Đa
    if (worldRef.current) {
      const wishHits = raycaster.intersectObjects(worldRef.current.wishLayer.children, true);
      for (const hit of wishHits) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if ((curr as any).userData?.wishData) {
            setWishModal({ open: true, mode: 'view', item: (curr as any).userData.wishData as WishItem });
            return;
          }
          curr = curr.parent;
        }
      }
    }

    // 2. Kiểm tra chạm vào người chơi khác
    for (const other of otherAvatarsRef.current.values()) {
      const hits = raycaster.intersectObjects(other.group.children, true);
      if (hits.length > 0) {
        showToast(`🙏 Bạn đang viếng chùa cùng: ${other.data.name}`);
        return;
      }
    }

    // 3. Raycast xuống mặt đất (Sân chùa / Bãi cỏ) -> Nhân vật tự đi tới điểm đó!
    const groundHits = raycaster.intersectObjects(sceneRef.current.children, true);
    for (const hit of groundHits) {
      // Chỉ nhận các điểm tiếp xúc gần mặt phẳng đất (y: -0.2 đến 1.5) và trong khuôn viên
      const B = worldRef.current?.mapId === 'main' ? { minX: -36, maxX: 36, minZ: -25, maxZ: 45 } : worldRef.current?.spec.bounds;
      if (B && hit.point.y >= -0.2 && hit.point.y <= 1.2 && hit.point.x > B.minX && hit.point.x < B.maxX && hit.point.z > B.minZ && hit.point.z < B.maxZ) {
        // Kiểm tra điểm chạm không nằm trong vùng cản
        const col = worldRef.current?.checkCollision(hit.point.x, hit.point.z);
        const self = selfAvatarRef.current;
        if (col && col.allowed && self) {
          startAutoWalk(
            hit.point.x,
            hit.point.z,
            faceTo(self.group.position.x, self.group.position.z, hit.point.x, hit.point.z),
            'walk'
          );
          return;
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    cameraAngle.current.dist = Math.max(3.0, Math.min(13.0, cameraAngle.current.dist + e.deltaY * 0.005));
  };

  // Sang phòng có bản đồ khác: gỡ cảnh cũ, dựng cảnh mới
  const loadMap = (id?: string) => {
    const next: MapId = isMapId(id) ? id : 'main';
    mapRef.current = next;
    setMapId(next);
    const scene = sceneRef.current;
    if (!scene || worldRef.current?.mapId === next) return;
    worldRef.current?.dispose();
    const w = createWorld(scene, next);
    worldRef.current = w;
    w.setBuiltProjects(builtRef.current, false);
    if (steleRef.current) updateSteleFrom(steleRef.current);
    if (import.meta.env.DEV) (window as any).__chua = { ...(window as any).__chua, world: w };
    infoIdRef.current = null;
    setInfoId(null);
  };

  // Đổi cảnh (mùa, thời tiết) theo phòng; phòng "Đêm trăng" luôn là ban đêm; địa ngục, thiền đường ánh sáng cố định
  const applyRoomTheme = (themeId?: string) => {
    const theme = getTheme(themeId);
    const hour = new Date().getHours();
    const night = theme.fixed ? false : theme.forceNight ? true : hour < 6 || hour >= 18;
    worldRef.current?.applyTheme(theme);
    worldRef.current?.setDayNight(night);
    setIsNight(night);
  };

  // Vào chùa
  const handleEnterTemple = async (data: { name: string; robe: RobeColor; style: AvatarStyle; roomId?: string }) => {
    try {
      try {
        localStorage.setItem('chua_name', data.name);
        localStorage.setItem('chua_robe', data.robe);
        localStorage.setItem('chua_style', data.style);
      } catch {}

      const res = await network.join({
        name: data.name,
        robe: data.robe,
        style: data.style,
        room: data.roomId,
        // Công đức cũ lưu trên máy (trước khi server quản lý) - server chỉ nhận tối đa 300 khi lần đầu vào
        merit: (() => { try { return Number(localStorage.getItem('chua_merit') || 0); } catch { return 0; } })()
      });

      loadMap(res.room.map);
      if (sceneRef.current) {
        selfAvatarRef.current = createAvatar(res.self, true);

        for (const p of res.players) {
          if (p.id !== res.self.id) {
            otherAvatarsRef.current.set(p.id, createAvatar(p, false));
          }
        }
        worldRef.current?.syncObjects(res.incense, res.flowers, res.lanterns);
        worldRef.current?.syncWishes(res.wishes || []);
        worldRef.current?.syncLeafPiles(res.leaves || []);
        traysRef.current = res.trays || [];
        worldRef.current?.syncTrays(traysRef.current);
      }

      setMerit(res.self.merit || 0);
      if (res.leaderboard) {
        setLeaderboard(res.leaderboard);
        updateSteleFrom(res.leaderboard);
      }
      if (res.profile) setProfile(res.profile);
      if (res.communal) {
        setCommunal(res.communal);
        setBuilt(res.communal.built, false);
      }
      applyRoomTheme(res.room.theme);
      setCurrentRoom({
        id: res.room.id,
        name: res.room.name,
        count: res.room.count,
        max: res.room.max,
        theme: res.room.theme,
        map: res.room.map
      });

      // Camera bắt đầu ngay sau lưng nhân vật, nhìn theo hướng nhân vật
      cameraAngle.current = { theta: (res.self.ry ?? Math.PI) + Math.PI, phi: 0.28, dist: 5.4 };
      setHasEntered(true);
      updateOnlinePlayers();
      sound.startMusic();

      if (isTouchDevice) {
        showToast('Chạm trái để đi · Vuốt phải để xoay 🙏');
      } else {
        showToast(`Chào mừng bạn đến với ${res.room.name} - Chùa Tâm An 🙏`);
      }
    } catch (err: any) {
      showToast(err.message || 'Không thể vào chùa lúc này');
    }
  };

  // Bồ đoàn trống gần nhất (không có ai đang đứng/quỳ trên đó)
  const findFreeCushion = () => {
    const self = selfAvatarRef.current;
    const spots = worldRef.current?.cushionSpots || [];
    if (!self || !spots.length) return null;
    const others = [...otherAvatarsRef.current.values()].map(a => a.group.position);
    const free = spots.filter(sp => others.every(o => Math.hypot(o.x - sp.x, o.z - sp.z) > 0.6));
    const list = free.length ? free : spots;
    return list.reduce((best, sp) =>
      Math.hypot(sp.x - self.group.position.x, sp.z - self.group.position.z) <
      Math.hypot(best.x - self.group.position.x, best.z - self.group.position.z) ? sp : best
    );
  };

  const handleTriggerAction = (type: ActionType) => {
    if (type === 'sweep') {
      nearLeafRef.current = false;
      setNearLeaf(false);
    }
    sound.playClick();
    const self = selfAvatarRef.current;
    if (!self) return;

    if (type === 'lantern') {
      setLanternModalState({ open: true, mode: 'release' });
      return;
    }
    if (type === 'wish') {
      setWishModal({ open: true, mode: 'tie' });
      return;
    }

    // Chỗ đứng làm hành động theo bản đồ (src/shared/maps.ts)
    const spec = getMapSpec(mapRef.current);
    let spot: { x: number; z: number; ry: number } | null = null;
    switch (type) {
      case 'incense':   // trước lư hương, hướng về tượng chính
      case 'flower':    // trước bàn thờ
      case 'bell':      // trong lầu chuông, nắm dây thừng
      case 'drum':      // trước mặt trống
      case 'repent':    // trước tượng Địa Tạng Bồ Tát
        spot = spec.spots[type] || null;
        break;
      case 'bow': {
        const c = findFreeCushion();
        if (c) spot = { x: c.x, z: c.z, ry: faceTo(c.x, c.z, spec.focus.x, spec.focus.z) };
        break;
      }
      case 'meditate': {
        // La Hán Đường: tự đến bồ đoàn trống gần nhất rồi mới ngồi (bấm lại khi đang thiền thì xả thiền)
        if (mapRef.current === 'arhat' && self.currentAnim !== 'meditate') {
          const c = findFreeCushion();
          if (c) spot = { x: c.x, z: c.z, ry: faceTo(c.x, c.z, spec.focus.x, spec.focus.z) };
        }
        break;
      }
      case 'kitchen': {
        // Đang bưng đĩa thì mang ra bàn; chưa thì đi vào quầy bếp, bảng Phụ bếp sẽ hiện ra
        if (kitchenRef.current.carrying) {
          handleKitchenStep(4);
        } else {
          const k = DINING.kitchenSpot;
          startAutoWalk(k.x, k.z, k.ry, 'walk');
        }
        return;
      }
      case 'sweep': {
        // Đi tới đống lá gần nhất, đứng cách 0.75m quay mặt về đống lá
        const world = worldRef.current;
        const pos = self.group.position;
        const pile = world?.getNearestLeafPile(pos.x, pos.z);
        if (!world || !pile) {
          showToast('Sân chùa đang sạch sẽ, chưa có lá rụng 🙏');
          return;
        }
        const d = Math.hypot(pos.x - pile.x, pos.z - pile.z) || 1;
        let sx = pile.x + ((pos.x - pile.x) / d) * 0.75;
        let sz = pile.z + ((pos.z - pile.z) / d) * 0.75;
        if (!world.checkCollision(sx, sz).allowed) {
          sx = pile.x;
          sz = pile.z;
        }
        startAutoWalk(sx, sz, faceTo(sx, sz, pile.x, pile.z), 'sweep', pile.id);
        return;
      }
    }

    if (spot) {
      startAutoWalk(spot.x, spot.z, spot.ry, type);
      return;
    }
    triggerActionDirect(type);
  };

  // ===================== PHỤ BẾP =====================
  const updateKitchen = (next: KitchenState) => {
    kitchenRef.current = next;
    carryingRef.current = next.carrying;
    setKitchen(next);
  };

  // Chỗ đặt đĩa gần nhất trong tầm với (ưu tiên chỗ còn trống)
  const findServeSlot = (x: number, z: number): number | null => {
    const used = new Set(traysRef.current.map(t => t.slot));
    let best: number | null = null;
    let bestScore = Infinity;
    for (let s = 0; s < TRAY_SLOTS; s++) {
      const sp = traySlot(s).spot;
      const d = Math.hypot(sp.x - x, sp.z - z);
      if (d > SERVE_REACH - 0.2) continue;
      const score = d + (used.has(s) ? 5 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  };

  // Bước 1-3 làm ở quầy bếp (chưa đứng ở quầy thì tự đi tới), bước 4 đặt đĩa xuống bàn
  const handleKitchenStep = (step: number) => {
    const self = selfAvatarRef.current;
    const world = worldRef.current;
    if (!self || !world || !kitchenStepEnabled(step, kitchenRef.current)) return;
    sound.playClick();
    const pos = self.group.position;

    if (step === 4) {
      const near = findServeSlot(pos.x, pos.z);
      const slot = near ?? world.pickTraySlot(pos.x, pos.z, traysRef.current);
      const spot = traySlot(slot).spot;
      if (near !== null) {
        self.group.rotation.y = spot.ry;
        triggerActionDirect('serve', String(slot));
      } else {
        startAutoWalk(spot.x, spot.z, spot.ry, 'serve', String(slot));
      }
      return;
    }

    const action: ActionType = step === 1 ? 'take_plate' : step === 2 ? 'take_bun' : 'lift_plate';
    const k = DINING.kitchenSpot;
    if (Math.hypot(pos.x - k.x, pos.z - k.z) < KITCHEN_REACH - 0.2) {
      self.group.rotation.y = k.ry;
      triggerActionDirect(action);
    } else {
      startAutoWalk(k.x, k.z, k.ry, action);
    }
  };
  kitchenStepRef.current = handleKitchenStep;

  // Thả đèn: đi tới bờ hồ sen gần nhất rồi quỳ thả đèn
  const startLanternRelease = (wish: string) => {
    const self = selfAvatarRef.current;
    if (!self) return;
    const angle = Math.atan2(self.group.position.z - POND_CENTER.z, self.group.position.x - POND_CENTER.x);
    const x = POND_CENTER.x + Math.cos(angle) * POND_EDGE_RADIUS;
    const z = POND_CENTER.z + Math.sin(angle) * POND_EDGE_RADIUS;
    startAutoWalk(x, z, faceTo(x, z, POND_CENTER.x, POND_CENTER.z), 'lantern', wish);
  };

  // Cầu duyên: đi tới gốc Cây Đa (chỗ gần nhất, ngoài ghế đá) rồi với tay buộc dải lụa
  const startWishTie = (wish: string) => {
    const self = selfAvatarRef.current;
    const world = worldRef.current;
    if (!self || !world) return;
    const spot = world.getWishSpot(self.group.position.x, self.group.position.z);
    const tree = TempleWorld.WISH_TREE;
    startAutoWalk(spot.x, spot.z, faceTo(spot.x, spot.z, tree.x, tree.z), 'wish', wish);
  };

  const triggerActionDirect = async (type: ActionType, text?: string) => {
    const avatar = selfAvatarRef.current;
    if (!avatar) return;

    // Bấm lại hành động bật/tắt đang chạy -> dừng
    if (TOGGLE_ACTIONS.includes(type) && avatar.currentAnim === type) {
      avatar.currentAnim = 'idle';
      setCurrentAnim('idle');
      return;
    }

    // Làm việc khác (không phải phụ bếp) thì coi như đặt đĩa đang bưng lại
    const kitchenAction = ['take_plate', 'take_bun', 'lift_plate', 'serve'].includes(type);
    if (!kitchenAction && kitchenRef.current.carrying) updateKitchen({ ...kitchenRef.current, carrying: false });
    if (avatar.currentAnim === type) avatar.restartAnim();
    avatar.currentAnim = type;
    setCurrentAnim(type);

    const res = await network.sendAction(type, text);
    if (kitchenAction && res && 'carrying' in res) {
      // Trạng thái bếp do server quyết định; đĩa trên quầy cập nhật khớp lúc tay đặt đĩa / bánh xuống
      const next: KitchenState = { plate: (res as any).kitchenPlate ?? null, carrying: !!(res as any).carrying };
      updateKitchen(next);
      const delay = type === 'take_plate' ? 850 : type === 'take_bun' ? 780 : type === 'lift_plate' ? 450 : 0;
      setTimeout(() => worldRef.current?.setCounterPlate(kitchenRef.current.plate), delay);
    }
    if (res?.error) {
      showToast(res.error);
      // Bị từ chối (ví dụ chuông vừa được thỉnh) thì dừng động tác
      if (ACTION_DURATION[type] !== undefined && avatar.currentAnim === type) {
        avatar.currentAnim = 'idle';
        setCurrentAnim('idle');
      }
    }
  };

  triggerActionRef.current = handleTriggerAction;

  const handleSwitchRoom = async (targetRoomId: string) => {
    try {
      const res = await network.switchRoom(targetRoomId);
      const nextMap: MapId = isMapId(res.room.map) ? res.room.map : 'main';
      const mapChanged = nextMap !== mapRef.current;
      loadMap(nextMap);
      const me = selfAvatarRef.current;
      if (mapChanged && me && res.self) {
        // Sang cảnh khác: đứng ở điểm xuất hiện của cảnh mới
        autoWalkTarget.current = null;
        setIsNavigating(false);
        me.group.position.set(res.self.x, 0, res.self.z);
        me.group.rotation.y = res.self.ry;
        me.targetPos.set(res.self.x, 0, res.self.z);
        me.currentAnim = 'idle';
        setCurrentAnim('idle');
        cameraAngle.current.theta = res.self.ry + Math.PI;
      }
      if (sceneRef.current) {
        for (const other of otherAvatarsRef.current.values()) {
          sceneRef.current.remove(other.group);
          other.dispose();
        }
        otherAvatarsRef.current.clear();

        for (const p of res.players) {
          if (p.id !== network.selfData?.id) {
            otherAvatarsRef.current.set(p.id, createAvatar(p, false));
          }
        }
        worldRef.current?.syncObjects(res.incense, res.flowers, res.lanterns);
        worldRef.current?.syncWishes(res.wishes || []);
        worldRef.current?.syncLeafPiles(res.leaves || []);
        traysRef.current = res.trays || [];
        worldRef.current?.syncTrays(traysRef.current);
      }
      updateKitchen({ plate: null, carrying: false });
      worldRef.current?.setCounterPlate(null);

      applyRoomTheme(res.room.theme);
      setCurrentRoom({
        id: res.room.id,
        name: res.room.name,
        count: res.room.count,
        max: res.room.max,
        theme: res.room.theme,
        map: res.room.map
      });

      setShowRoomModal(false);
      updateOnlinePlayers();
      showToast(`Đã chuyển sang phòng ${res.room.name} 🙏`);
    } catch (err: any) {
      showToast(err.message || 'Lỗi chuyển phòng');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950 font-sans select-none touch-none overscroll-none">
      
      {/* 3D WebGL Canvas Container with Unified Multi-touch Pointer Events */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none select-none"
      />

      {/* JOYSTICK ẢO ĐỘNG (DYNAMIC VIRTUAL JOYSTICK - Hiện ngay dưới ngón tay khi chạm nửa trái) */}
      {dynamicJoystick.visible && (
        <div
          className="fixed pointer-events-none z-30 transform -translate-x-1/2 -translate-y-1/2 transition-opacity"
          style={{
            left: `${dynamicJoystick.originX}px`,
            top: `${dynamicJoystick.originY}px`
          }}
        >
          {/* Vòng ngoài 120px kính mờ viền vàng */}
          <div className="w-[120px] h-[120px] rounded-full bg-stone-950/45 border-2 border-amber-500/70 shadow-2xl backdrop-blur-xs flex items-center justify-center">
            {/* Núm điều khiển 50px */}
            <div
              className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-200 shadow-lg transform transition-transform"
              style={{
                transform: `translate(${dynamicJoystick.knobX}px, ${dynamicJoystick.knobY}px)`
              }}
            />
          </div>
        </div>
      )}

      {/* Vòng joystick nghỉ (điện thoại): chạm vào đây hoặc bất kỳ đâu nửa trái để đi */}
      {hasEntered && HAS_TOUCH && !dynamicJoystick.visible && (
        <div
          className="fixed pointer-events-none z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: joystickRest(viewH).x, top: joystickRest(viewH).y }}
        >
          <div className="w-[116px] h-[116px] rounded-full bg-stone-950/30 border-2 border-amber-400/55 shadow-[0_0_18px_rgba(0,0,0,0.35),inset_0_0_16px_rgba(251,191,36,0.15)] flex items-center justify-center">
            <div className="w-[46px] h-[46px] rounded-full bg-gradient-to-br from-amber-500/90 to-amber-800/90 border-2 border-amber-200/70 shadow-lg" />
          </div>
        </div>
      )}

      {/* MÀN HÌNH ĐĂNG NHẬP / VÀO CHÙA */}
      {!hasEntered && (
        <EntranceScreen
          initialName={localStorage.getItem('chua_name') || ''}
          initialRobe={(localStorage.getItem('chua_robe') as RobeColor) || 'brown'}
          initialStyle={(localStorage.getItem('chua_style') as AvatarStyle) || 'monk'}
          rooms={roomList}
          stats={overallStats}
          onEnter={handleEnterTemple}
          onCreateRoom={(name) => network.createRoom(name)}
          onOpenAdmin={() => setShowAdmin(true)}
        />
      )}

      {/* GIAO DIỆN CHÍNH KHI ĐÃ VÀO CHÙA (HUD) */}
      {hasEntered && (
        <>
          {/* TOP LEFT: Tên Chùa, Số người, Tên phòng (Tôn trọng safe-area-inset-top) */}
          <div className="fixed top-3 sm:top-4 left-3 sm:left-4 z-20 flex items-center gap-2 pt-[env(safe-area-inset-top)]">
            <button
              type="button"
              onClick={() => setShowRoomModal(true)}
              className="flex items-center gap-2 pl-1.5 pr-3.5 py-1 sm:py-1.5 rounded-full bg-gradient-to-b from-stone-700/95 to-stone-950/95 border-2 border-amber-500/60 shadow-[0_4px_12px_rgba(0,0,0,0.45)] text-stone-100 transition cursor-pointer"
            >
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 text-stone-950 font-serif text-sm sm:text-base leading-none flex items-center justify-center shadow-inner">卍</span>
              <div className="text-left">
                <div className="text-[11px] sm:text-xs font-serif font-bold text-amber-200 leading-tight">
                  TÂM AN TỰ
                </div>
                <div className="text-[10px] sm:text-[11px] text-stone-300 flex items-center gap-1 leading-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>{currentRoom.count} người</span>
                  <span>·</span>
                  <span className="text-amber-300 underline font-medium">{currentRoom.name}</span>
                  <span title={getTheme(currentRoom.theme).name}>{getTheme(currentRoom.theme).icon}</span>
                </div>
              </div>
            </button>
          </div>

          {/* Thanh tiến độ cúng dường chung: mọi người cùng thấy */}
          {(() => {
            const proj = COMMUNAL_PROJECTS.find(p => p.id === communal.current);
            if (!proj) return null;
            const done = communal.progress[proj.id] || 0;
            return (
              <button
                type="button"
                onClick={() => setShopTab('communal')}
                className="fixed top-[64px] sm:top-[72px] left-3 sm:left-4 z-20 w-[170px] sm:w-[200px] px-2.5 py-1.5 rounded-xl bg-stone-900/85 border border-amber-600/30 shadow-lg text-left cursor-pointer mt-[env(safe-area-inset-top)]"
                title="Cúng dường chung"
              >
                <div className="flex justify-between text-[10px] text-amber-200">
                  <span className="truncate">{proj.icon} {proj.name}</span>
                  <span className="text-stone-400 ml-1">{done}/{proj.goal}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${Math.min(100, (done / proj.goal) * 100)}%` }} />
                </div>
              </button>
            );
          })()}

          {/* TOP RIGHT: Công Đức, Nhạc, Ngày/Đêm, Toàn màn hình */}
          <div className="fixed top-3 sm:top-4 right-3 sm:right-4 z-20 flex flex-wrap justify-end items-center gap-1 sm:gap-2 max-w-[56vw] sm:max-w-none pt-[env(safe-area-inset-top)]">
            {/* Điểm công đức */}
            <div
              onClick={() => setShopTab('items')}
              title={`Công đức tích luỹ ${merit} · khả dụng ${profile.balance}`}
              className="relative flex items-center gap-1 h-9 sm:h-11 px-3 sm:px-4 rounded-full bg-gradient-to-b from-stone-700/95 to-stone-950/95 border-2 border-amber-500/60 shadow-[0_4px_12px_rgba(0,0,0,0.45)] text-amber-200 font-serif text-xs sm:text-sm font-bold cursor-pointer"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>{merit}</span>

              {floatingMerit.map((m) => (
                <span
                  key={m.id}
                  className="absolute -top-6 right-2 text-sm font-bold text-amber-300 drop-shadow animate-bounce pointer-events-none"
                >
                  +{m.amount}
                </span>
              ))}
            </div>

            {/* Đổi công đức */}
            <button
              type="button"
              onClick={() => setShopTab('items')}
              className={`flex ${HUD_BTN}`}
              title="Đổi công đức"
            >
              <Gift size={15} />
            </button>

            {/* Bảng công đức */}
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className={`flex ${HUD_BTN}`}
              title="Bảng công đức"
            >
              <Trophy size={15} />
            </button>

            {/* Đổi tên / áo / dáng nhân vật */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className={`flex ${HUD_BTN}`}
              title="Đổi tên, màu áo"
            >
              <UserPen size={15} />
            </button>

            {/* Bảng nhạc */}
            <button
              type="button"
              onClick={() => setShowAudioModal(true)}
              className={`flex ${HUD_BTN}`}
              title="Cài đặt âm thanh"
            >
              <Music size={15} />
            </button>

            {/* Nút Ngày / Đêm (ẩn ở cảnh có ánh sáng cố định) */}
            {!getMapSpec(mapId).fixedLight && (
            <button
              type="button"
              onClick={() => setIsNight(!isNight)}
              className={`flex ${HUD_BTN}`}
              title={isNight ? 'Chuyển sang ban ngày' : 'Chuyển sang ban đêm'}
            >
              {isNight ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            )}

            {/* Toàn màn hình */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`hidden md:flex ${HUD_BTN}`}
              title="Toàn màn hình"
            >
              <Maximize2 size={15} />
            </button>
          </div>

          {/* TOP CENTER: Toast thông báo sự kiện */}
          {toastMessage && (
            <div className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-stone-900/95 border border-amber-500/50 shadow-2xl text-amber-200 text-xs sm:text-sm font-serif font-medium flex items-center gap-2 animate-fade-in pointer-events-none max-w-[90vw] text-center">
              <span>{toastMessage}</span>
            </div>
          )}

          {/* BOTTOM LEFT: Chat & Câu thoại nhanh */}
          <ChatPanel
            messages={messages}
            onSendMessage={(txt) => network.sendChat(txt)}
          />

          {/* Đứng gần lá rụng: nhắc nhấn F (máy tính) hoặc nút chạm (điện thoại) */}
          {nearLeaf && !isNavigating && (
            <button
              type="button"
              onClick={() => handleTriggerAction('sweep')}
              className="fixed bottom-[96px] sm:bottom-[104px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900/95 border border-amber-500/60 shadow-2xl text-amber-200 text-sm font-semibold cursor-pointer animate-bounce"
            >
              <span>🍂</span>
              {isTouchDevice ? (
                <span>Chạm để quét lá (+2)</span>
              ) : (
                <span>
                  Nhấn <kbd className="px-1.5 py-0.5 mx-0.5 rounded bg-amber-500 text-stone-950 font-bold">F</kbd> để quét lá (+2)
                </span>
              )}
            </button>
          )}

          {/* Bảng phụ bếp: hiện khi ở trong trai đường hoặc đang bưng đĩa */}
          {(kitchenCtx.inside || kitchen.carrying) && (
            <KitchenPanel
              plate={kitchen.plate}
              carrying={kitchen.carrying}
              atCounter={kitchenCtx.atCounter}
              nearTable={kitchenCtx.serveSlot !== null}
              isTouch={isTouchDevice}
              busy={isNavigating || ['take_plate', 'take_bun', 'lift_plate', 'serve'].includes(currentAnim)}
              onStep={handleKitchenStep}
            />
          )}

          {/* BOTTOM CENTER: Thanh hành động */}
          <ActionBar
            currentAnim={currentAnim}
            isNavigatingToTarget={isNavigating}
            onTriggerAction={handleTriggerAction}
            allowed={getMapSpec(mapId).actions}
          />

          {/* Bảng thông tin: các tầng địa ngục, tượng nghìn tay, hướng dẫn ngồi thiền */}
          {infoId && infoId !== infoClosed && (() => {
            const info = getInfo(infoId);
            return info ? <InfoPanel info={info} onClose={() => setInfoClosed(infoId)} /> : null;
          })()}

          {/* La Hán Đường: vòng hướng dẫn hít thở khi đang ngồi thiền */}
          {mapId === 'arhat' && currentAnim === 'meditate' && <MeditationGuide />}

          {/* Bản đồ nhỏ (địa ngục, La Hán Đường): vị trí mình, người khác và các điểm tham quan */}
          {getMapSpec(mapId).minimap && (
            <MiniMap
              key={mapId}
              getWorld={() => worldRef.current}
              getSelf={() => {
                const s = selfAvatarRef.current;
                return s ? { x: s.group.position.x, z: s.group.position.z, ry: s.group.rotation.y } : null;
              }}
              getOthers={() => [...otherAvatarsRef.current.values()].map(a => ({ x: a.group.position.x, z: a.group.position.z }))}
              activeId={infoId}
            />
          )}

          {/* Hướng dẫn phím di chuyển (chỉ hiện trên Desktop) */}
          {!isTouchDevice && <div className="fixed bottom-1 left-4 z-10 text-[10px] text-stone-300 hidden md:block pointer-events-none drop-shadow">
            WASD / Phím mũi tên: Đi lại | Giữ Shift: Chạy | Chuột kéo: Xoay | Lăn chuột: Phóng to/thu nhỏ
          </div>}
        </>
      )}

      {/* MODAL DANH SÁCH PHÒNG & NGƯỜI DÙNG */}
      {showRoomModal && (
        <RoomModal
          currentRoom={currentRoom}
          rooms={roomList}
          playersInRoom={onlinePlayersList}
          onClose={() => setShowRoomModal(false)}
          onSwitchRoom={handleSwitchRoom}
          onCreateRoom={(name, theme) => network.createRoom(name, theme)}
          canPickTheme={profile.owned.includes('room_theme')}
        />
      )}

      {/* MODAL CÀI ĐẶT THANH ÂM */}
      {shopTab && (
        <ShopModal
          profile={profile}
          communal={communal}
          initialTab={shopTab}
          onClose={() => setShopTab(null)}
          onBuy={(id) => shopAction(network.buyItem(id))}
          onEquip={handleEquipSelf}
          onDonate={(amount) => shopAction(network.donate(amount))}
        />
      )}

      {showLeaderboard && (
        <LeaderboardModal
          data={leaderboard}
          roomPlayers={onlinePlayersList}
          selfName={selfAvatarRef.current?.data.name || ''}
          selfMerit={merit}
          totalMerit={overallStats.totalMerit}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {showProfileModal && selfAvatarRef.current && (
        <ProfileModal
          name={selfAvatarRef.current.data.name}
          robe={selfAvatarRef.current.data.robe}
          style={selfAvatarRef.current.data.style}
          onClose={() => setShowProfileModal(false)}
          onSave={handleSaveProfile}
        />
      )}

      {showAudioModal && (
        <AudioSettingsModal
          owned={profile.owned}
          onOpenShop={() => {
            setShowAudioModal(false);
            setShopTab('unlock');
          }}
          onClose={() => setShowAudioModal(false)}
        />
      )}

      {/* MODAL THẢ ĐÈN HOA ĐĂNG & CHIÊM BÁI LỜI NGUYỆN */}
      {wishModal.open && (
        <WishDialog
          mode={wishModal.mode}
          viewingWish={wishModal.item}
          onClose={() => setWishModal({ open: false, mode: 'tie' })}
          onTie={(wish) => startWishTie(wish)}
        />
      )}

      {showAdmin && (
        <AdminModal
          onClose={() => {
            setShowAdmin(false);
            if (window.location.hash === '#admin') history.replaceState(null, '', window.location.pathname + window.location.search);
          }}
        />
      )}

      {lanternModalState.open && (
        <LanternDialog
          mode={lanternModalState.mode}
          viewingLantern={lanternModalState.viewingItem}
          onClose={() => setLanternModalState({ open: false, mode: 'release' })}
          onRelease={(wish) => startLanternRelease(wish)}
        />
      )}

    </div>
  );
}
