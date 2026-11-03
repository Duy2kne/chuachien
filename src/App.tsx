import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TempleWorld } from './scene/templeWorld.js';
import { PlayerAvatar, ACTION_DURATION, type AvatarSoundEvent } from './scene/playerAvatar.js';
import { network } from './network/networkClient.js';
import { sound } from './audio/soundEngine.js';
import type { PlayerData, ActionType, RobeColor, AvatarStyle, RoomInfo, OverallStats, ChatMessage, LanternItem } from './types.js';
import { EntranceScreen } from './components/EntranceScreen.js';
import { ActionBar } from './components/ActionBar.js';
import { ChatPanel } from './components/ChatPanel.js';
import { RoomModal } from './components/RoomModal.js';
import { LanternDialog } from './components/LanternDialog.js';
import { AudioSettingsModal } from './components/AudioSettingsModal.js';
import { Sun, Moon, Music, Maximize2, Sparkles } from 'lucide-react';

const _targetLook = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _camPivot = new THREE.Vector3();
const _camRay = new THREE.Raycaster();

// Các hành động dạng bật/tắt (bấm lần nữa để dừng)
const TOGGLE_ACTIONS: ActionType[] = ['namaste', 'meditate', 'wooden_fish'];

// Toạ độ các điểm trong chùa (khớp với templeWorld.ts)
const HALL_FOCUS = { x: 0, z: -14.5 };   // Tượng Phật trong chính điện
const POND_CENTER = { x: -18, z: 24 };   // Hồ sen
const POND_EDGE_RADIUS = 9.0;           // Đứng ngay bên ngoài bờ đá
const faceTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

interface AutoWalkTarget {
  x: number;
  z: number;
  ry: number;
  anim: ActionType;
  text?: string;
  startTime: number;
  bestDist: number;
  lastProgress: number;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  // Trạng thái giao diện
  const [hasEntered, setHasEntered] = useState(false);
  const [currentRoom, setCurrentRoom] = useState({ id: 'tu-bi', name: 'Từ Bi', count: 1, max: 50 });
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

  const [merit, setMerit] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('chua_merit') || '0', 10);
    } catch {
      return 0;
    }
  });

  const [floatingMerit, setFloatingMerit] = useState<{ id: number; amount: number }[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentAnim, setCurrentAnim] = useState<ActionType>('idle');
  const [isNavigating, setIsNavigating] = useState(false);

  // Modals
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
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

    network.onNewIncense = (item) => worldRef.current?.syncObjects([item], [], []);
    network.onNewFlower = (item) => worldRef.current?.syncObjects([], [item], []);
    network.onNewLantern = (item) => worldRef.current?.syncObjects([], [], [item]);
    network.onObjectsSync = (data) => worldRef.current?.syncObjects(data.incense, data.flowers, data.lanterns);
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
        avatar.currentAnim = 'idle';
        setCurrentAnim('idle');
      };
    }
    sceneRef.current?.add(avatar.group);
    return avatar;
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

  const addMeritEffect = (gain: number) => {
    if (gain <= 0) return;
    setMerit(prev => {
      const next = prev + gain;
      try { localStorage.setItem('chua_merit', next.toString()); } catch {}
      return next;
    });

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
    const world = new TempleWorld(scene);
    worldRef.current = world;
    world.setDayNight(isNight);

    // 5. Vòng lặp Render (Animation loop)
    let frameId = 0;
    const clock = new THREE.Clock();

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Cập nhật hoạt ảnh môi trường (khói hương, mây trôi, cánh hoa rơi)
      world.update(delta, elapsed);

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
      } else {
        // Camera quay chậm ngắm cảnh chùa ban đầu
        cameraAngle.current.theta += delta * 0.1;
        const camX = Math.sin(cameraAngle.current.theta) * 32;
        const camZ = Math.cos(cameraAngle.current.theta) * 32 + 10;
        camera.position.set(camX, 12, camZ);
        camera.lookAt(0, 3, 10);
      }

      for (const other of otherAvatarsRef.current.values()) {
        other.update(delta, elapsed);
      }

      renderer.render(scene, camera);
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
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
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
    const now = Date.now();
    autoWalkTarget.current = { x, z, ry, anim, text, startTime: now, bestDist: Infinity, lastProgress: now };
    setIsNavigating(true);
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.position.set(x, (worldRef.current?.checkCollision(x, z).height || 0) + 0.05, z);
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

    if (autoWalkTarget.current) {
      const target = autoWalkTarget.current;
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const now = Date.now();

      if (dist < target.bestDist - 0.05) {
        target.bestDist = dist;
        target.lastProgress = now;
      }
      // Bị kẹt quá 1.5 giây (hoặc đi quá 8 giây) thì dịch chuyển thẳng tới đích
      const stuck = now - target.lastProgress > 1500 || now - target.startTime > 8000;

      if (dist < 0.3 || stuck) {
        pos.x = target.x;
        pos.z = target.z;
        pos.y = world.checkCollision(target.x, target.z).height;
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
      const tryMove = (mx: number, mz: number) => {
        const col = world.checkCollision(pos.x + mx, pos.z + mz);
        if (!col.allowed) return false;
        pos.x += mx;
        pos.z += mz;
        return true;
      };

      // Đi thẳng; nếu vướng thì trượt dọc vật cản; khi tự đi thì thử vòng tránh
      let moved =
        tryMove(moveX * speed, moveZ * speed) ||
        tryMove(moveX * speed, 0) ||
        tryMove(0, moveZ * speed);
      if (!moved && autoWalkTarget.current) {
        for (const turn of [0.8, -0.8, 1.4, -1.4]) {
          const c = Math.cos(turn);
          const sn = Math.sin(turn);
          if (tryMove((moveX * c - moveZ * sn) * speed, (moveX * sn + moveZ * c) * speed)) {
            moved = true;
            break;
          }
        }
      }

      const targetRy = Math.atan2(moveX, moveZ);
      let diffRy = targetRy - avatar.group.rotation.y;
      while (diffRy > Math.PI) diffRy -= Math.PI * 2;
      while (diffRy < -Math.PI) diffRy += Math.PI * 2;
      avatar.group.rotation.y += diffRy * Math.min(1, delta * 15);

      const anim = isRunning ? 'run' : 'walk';
      if (avatar.currentAnim !== anim) {
        avatar.currentAnim = anim;
        setCurrentAnim(anim);
      }
    } else if (!autoWalkTarget.current && ['walk', 'run'].includes(avatar.currentAnim)) {
      avatar.currentAnim = 'idle';
      setCurrentAnim('idle');
    }

    // Độ cao theo nền (bậc thềm chính điện, lầu chuông)
    pos.y = THREE.MathUtils.damp(pos.y, world.checkCollision(pos.x, pos.z, 0).height, 12, delta);

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
      setDynamicJoystick({ visible: true, originX: e.clientX, originY: e.clientY, knobX: 0, knobY: 0 });
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
      if (hit.point.y >= -0.2 && hit.point.y <= 1.2 && Math.abs(hit.point.x) < 36 && hit.point.z > -25 && hit.point.z < 45) {
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
        merit
      });

      if (sceneRef.current) {
        selfAvatarRef.current = createAvatar(res.self, true);

        for (const p of res.players) {
          if (p.id !== res.self.id) {
            otherAvatarsRef.current.set(p.id, createAvatar(p, false));
          }
        }
        worldRef.current?.syncObjects(res.incense, res.flowers, res.lanterns);
      }

      setCurrentRoom({
        id: res.room.id,
        name: res.room.name,
        count: res.room.count,
        max: res.room.max
      });

      // Camera bắt đầu ngay sau lưng nhân vật, nhìn về chính điện
      cameraAngle.current = { theta: 0, phi: 0.28, dist: 5.4 };
      setHasEntered(true);
      updateOnlinePlayers();
      sound.startZenMusic();

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
    sound.playClick();
    const self = selfAvatarRef.current;
    if (!self) return;

    if (type === 'lantern') {
      setLanternModalState({ open: true, mode: 'release' });
      return;
    }

    let spot: { x: number; z: number; ry: number } | null = null;
    switch (type) {
      case 'incense':
        // Đứng trước lư hương lớn, hướng về chính điện
        spot = { x: 0, z: 2.2, ry: Math.PI };
        break;
      case 'bow': {
        const c = findFreeCushion();
        if (c) spot = { x: c.x, z: c.z, ry: faceTo(c.x, c.z, HALL_FOCUS.x, HALL_FOCUS.z) };
        break;
      }
      case 'flower':
        // Trước bàn thờ, hướng về tượng Phật
        spot = { x: 0, z: -11.9, ry: Math.PI };
        break;
      case 'bell':
        // Đứng trong lầu chuông, nắm dây thừng buộc vào chày gỗ
        spot = { x: 20.55, z: 8, ry: -Math.PI / 2 };
        break;
      case 'drum':
        // Đứng trước mặt trống
        spot = { x: 18, z: 9.75, ry: Math.PI };
        break;
    }

    if (spot) {
      startAutoWalk(spot.x, spot.z, spot.ry, type);
      return;
    }
    triggerActionDirect(type);
  };

  // Thả đèn: đi tới bờ hồ sen gần nhất rồi quỳ thả đèn
  const startLanternRelease = (wish: string) => {
    const self = selfAvatarRef.current;
    if (!self) return;
    const angle = Math.atan2(self.group.position.z - POND_CENTER.z, self.group.position.x - POND_CENTER.x);
    const x = POND_CENTER.x + Math.cos(angle) * POND_EDGE_RADIUS;
    const z = POND_CENTER.z + Math.sin(angle) * POND_EDGE_RADIUS;
    startAutoWalk(x, z, faceTo(x, z, POND_CENTER.x, POND_CENTER.z), 'lantern', wish);
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

    if (avatar.currentAnim === type) avatar.restartAnim();
    avatar.currentAnim = type;
    setCurrentAnim(type);

    const res = await network.sendAction(type, text);
    if (res?.error) {
      showToast(res.error);
      // Bị từ chối (ví dụ chuông vừa được thỉnh) thì dừng động tác
      if (ACTION_DURATION[type] !== undefined && avatar.currentAnim === type) {
        avatar.currentAnim = 'idle';
        setCurrentAnim('idle');
      }
    } else if (res?.meritGain) {
      addMeritEffect(res.meritGain);
    }
  };

  const handleSwitchRoom = async (targetRoomId: string) => {
    try {
      const res = await network.switchRoom(targetRoomId);
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
      }

      setCurrentRoom({
        id: res.room.id,
        name: res.room.name,
        count: res.room.count,
        max: res.room.max
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
              className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-stone-900/90 hover:bg-stone-900 border border-amber-600/40 shadow-xl backdrop-blur-xs text-stone-100 transition cursor-pointer"
            >
              <span className="text-amber-400 font-serif text-base sm:text-lg leading-none">卍</span>
              <div className="text-left">
                <div className="text-[11px] sm:text-xs font-serif font-bold text-amber-200 leading-tight">
                  TÂM AN TỰ
                </div>
                <div className="text-[10px] sm:text-[11px] text-stone-300 flex items-center gap-1 leading-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>{currentRoom.count} người</span>
                  <span>·</span>
                  <span className="text-amber-300 underline font-medium">{currentRoom.name}</span>
                </div>
              </div>
            </button>
          </div>

          {/* TOP RIGHT: Công Đức, Nhạc, Ngày/Đêm, Toàn màn hình */}
          <div className="fixed top-3 sm:top-4 right-3 sm:right-4 z-20 flex items-center gap-1.5 sm:gap-2 pt-[env(safe-area-inset-top)]">
            {/* Điểm công đức */}
            <div className="relative flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-2xl bg-stone-900/90 border border-amber-600/40 shadow-xl backdrop-blur-xs text-amber-300 font-serif text-xs font-bold">
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

            {/* Bảng nhạc */}
            <button
              type="button"
              onClick={() => setShowAudioModal(true)}
              className="p-2 sm:p-2.5 rounded-2xl bg-stone-900/90 hover:bg-stone-800 border border-amber-600/40 text-amber-300 shadow-xl transition cursor-pointer"
              title="Cài đặt âm thanh"
            >
              <Music size={15} />
            </button>

            {/* Nút Ngày / Đêm */}
            <button
              type="button"
              onClick={() => setIsNight(!isNight)}
              className="p-2 sm:p-2.5 rounded-2xl bg-stone-900/90 hover:bg-stone-800 border border-amber-600/40 text-amber-300 shadow-xl transition cursor-pointer"
              title={isNight ? 'Chuyển sang ban ngày' : 'Chuyển sang ban đêm'}
            >
              {isNight ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Toàn màn hình */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-2xl bg-stone-900/90 hover:bg-stone-800 border border-amber-600/40 text-stone-300 shadow-xl transition cursor-pointer hidden md:flex"
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

          {/* BOTTOM CENTER: Thanh 10 Hành Động với kích thước tối thiểu 56px */}
          <ActionBar
            currentAnim={currentAnim}
            isNavigatingToTarget={isNavigating}
            onTriggerAction={handleTriggerAction}
          />

          {/* Hướng dẫn phím di chuyển (chỉ hiện trên Desktop) */}
          <div className="fixed bottom-1 left-4 z-10 text-[10px] text-stone-300 hidden md:block pointer-events-none drop-shadow">
            WASD / Phím mũi tên: Đi lại | Giữ Shift: Chạy | Chuột kéo: Xoay | Lăn chuột: Phóng to/thu nhỏ
          </div>
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
          onCreateRoom={(name) => network.createRoom(name)}
        />
      )}

      {/* MODAL CÀI ĐẶT THANH ÂM */}
      {showAudioModal && (
        <AudioSettingsModal onClose={() => setShowAudioModal(false)} />
      )}

      {/* MODAL THẢ ĐÈN HOA ĐĂNG & CHIÊM BÁI LỜI NGUYỆN */}
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
