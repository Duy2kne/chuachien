import { io, Socket } from 'socket.io-client';
import type { TrayItem } from '../shared/dining.js';
import type { PlayerData, RoomInfo, IncenseItem, FlowerItem, LanternItem, ChatMessage, ActionType, RobeColor, AvatarStyle, LeafPile, LeaderboardData, MeritProfile, CommunalState } from '../types.js';

export interface JoinResponse {
  self: PlayerData;
  players: PlayerData[];
  room: RoomInfo;
  incense: IncenseItem[];
  flowers: FlowerItem[];
  lanterns: LanternItem[];
  leaves: LeafPile[];
  trays: TrayItem[];
  uid: string;
  leaderboard: LeaderboardData;
  profile: MeritProfile;
  communal: CommunalState;
  serverTime: number;
  wasRedirected?: boolean;
}

export class NetworkClient {
  public socket: Socket | null = null;
  public isConnected = false;
  public selfData: PlayerData | null = null;

  // Callbacks đăng ký từ App / UI / Scene
  public onPlayerJoined?: (player: PlayerData) => void;
  public onPlayerLeft?: (playerId: string) => void;
  public onStateUpdate?: (compactState: [string, number, number, number, number, ActionType][]) => void;
  public onPlayerAction?: (data: { playerId: string; anim: ActionType; meritGain: number; merit: number; text?: string }) => void;
  public onChatMessage?: (msg: ChatMessage) => void;
  public onMeritUpdate?: (data: { id: string; merit: number; gain: number }) => void;
  public onLeaderboard?: (data: LeaderboardData) => void;
  public onProfile?: (profile: MeritProfile) => void;
  public onCommunal?: (state: CommunalState) => void;
  public onLeafAdded?: (leaf: LeafPile) => void;
  public onTrays?: (trays: TrayItem[]) => void;
  public onLeafRemoved?: (data: { id: string; by: string }) => void;
  public onPlayerUpdated?: (data: { id: string; name: string; robe: RobeColor; style: AvatarStyle; items?: string[] }) => void;
  public onBellRung?: (data: { playerName: string; time: number }) => void;
  public onDrumBeaten?: (data: { playerName: string; time: number }) => void;
  public onNewIncense?: (item: IncenseItem) => void;
  public onNewFlower?: (item: FlowerItem) => void;
  public onNewLantern?: (item: LanternItem) => void;
  public onObjectsSync?: (data: { incense: IncenseItem[]; flowers: FlowerItem[]; lanterns: LanternItem[] }) => void;
  public onRoomsList?: (rooms: RoomInfo[]) => void;
  public onConnectionStateChange?: (connected: boolean, message?: string) => void;

  private lastSentPos = { x: 0, y: 0, z: 0, ry: 0, anim: 'idle' };
  private lastMoveSendTime = 0;

  constructor() {
    this.connect();
  }

  private connect() {
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.onConnectionStateChange?.(true);
      // Lấy danh sách phòng khi vừa kết nối
      this.socket?.emit('rooms:get');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.onConnectionStateChange?.(false, 'Đang kết nối lại cửa chùa...');
    });

    this.socket.on('connect_error', () => {
      this.isConnected = false;
      this.onConnectionStateChange?.(false, 'Mạng gián đoạn, đang thử lại...');
    });

    // Các sự kiện realtime
    this.socket.on('rooms:list', (rooms: RoomInfo[]) => {
      this.onRoomsList?.(rooms);
    });

    this.socket.on('player:join', (player: PlayerData) => {
      this.onPlayerJoined?.(player);
    });

    this.socket.on('player:leave', (playerId: string) => {
      this.onPlayerLeft?.(playerId);
    });

    this.socket.on('state', (compactState: [string, number, number, number, number, ActionType][]) => {
      this.onStateUpdate?.(compactState);
    });

    this.socket.on('player:action', (data) => {
      this.onPlayerAction?.(data);
    });

    this.socket.on('merit:update', (data) => this.onMeritUpdate?.(data));
    this.socket.on('leaderboard', (data: LeaderboardData) => this.onLeaderboard?.(data));
    this.socket.on('profile:self', (profile: MeritProfile) => this.onProfile?.(profile));
    this.socket.on('communal', (state: CommunalState) => this.onCommunal?.(state));
    this.socket.on('leaves:add', (leaf: LeafPile) => this.onLeafAdded?.(leaf));
    this.socket.on('trays', (trays: TrayItem[]) => this.onTrays?.(trays));
    this.socket.on('leaves:remove', (data) => this.onLeafRemoved?.(data));

    this.socket.on('player:update', (data) => {
      this.onPlayerUpdated?.(data);
    });

    this.socket.on('chat:message', (msg: ChatMessage) => {
      this.onChatMessage?.(msg);
    });

    this.socket.on('event:bell', (data) => {
      this.onBellRung?.(data);
    });

    this.socket.on('event:drum', (data) => {
      this.onDrumBeaten?.(data);
    });

    this.socket.on('object:incense', (item: IncenseItem) => {
      this.onNewIncense?.(item);
    });

    this.socket.on('object:flower', (item: FlowerItem) => {
      this.onNewFlower?.(item);
    });

    this.socket.on('object:lantern', (item: LanternItem) => {
      this.onNewLantern?.(item);
    });

    this.socket.on('objects:sync', (data) => {
      this.onObjectsSync?.(data);
    });
  }

  // Vào chùa
  public join(data: { name: string; robe: RobeColor; style: AvatarStyle; room?: string; merit?: number }): Promise<JoinResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Socket chưa khởi tạo'));

      // Mã người dùng cố định của trình duyệt này: công đức được server lưu theo mã này
      let uid = '';
      try { uid = localStorage.getItem('chua_uid') || ''; } catch {}
      this.socket.emit('join', { ...data, uid }, (res: JoinResponse) => {
        if (!res) {
          reject(new Error('Không nhận được phản hồi từ chùa'));
          return;
        }
        try { if (res.uid) localStorage.setItem('chua_uid', res.uid); } catch {}
        this.selfData = res.self;
        resolve(res);
      });
    });
  }

  // Gửi vị trí (throttled ~12Hz, chỉ gửi khi thay đổi)
  public sendMove(x: number, y: number, z: number, ry: number, anim: ActionType) {
    if (!this.socket || !this.isConnected) return;

    const now = Date.now();
    if (now - this.lastMoveSendTime < 80) return; // ~12 lần/giây

    const dx = Math.abs(x - this.lastSentPos.x);
    const dy = Math.abs(y - this.lastSentPos.y);
    const dz = Math.abs(z - this.lastSentPos.z);
    const dry = Math.abs(ry - this.lastSentPos.ry);
    const dAnim = anim !== this.lastSentPos.anim;

    // Chỉ gửi khi có biến đổi đáng kể
    if (dx > 0.03 || dy > 0.03 || dz > 0.03 || dry > 0.03 || dAnim) {
      this.lastSentPos = { x, y, z, ry, anim };
      this.lastMoveSendTime = now;
      this.socket.emit('move', { x, y, z, ry, anim });
    }
  }

  // Gửi hành động
  public sendAction(type: ActionType, text?: string): Promise<{ ok?: boolean; error?: string; merit?: number; meritGain?: number }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ error: 'Mất kết nối' });
      this.socket.emit('action', { type, text }, (res: any) => {
        resolve(res || {});
      });
    });
  }

  // Đổi tên / màu áo / dáng nhân vật
  public updateProfile(data: { name?: string; robe?: RobeColor; style?: AvatarStyle }): Promise<{ ok?: boolean; error?: string; self?: { name: string; robe: RobeColor; style: AvatarStyle } }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ error: 'Mất kết nối' });
      this.socket.emit('profile:update', data, (res: any) => {
        if (res?.ok && this.selfData) Object.assign(this.selfData, res.self);
        resolve(res || {});
      });
    });
  }

  // Đổi công đức: mua vật phẩm, mang/bỏ vật phẩm, cúng dường chung
  private shopCall(event: string, data: object): Promise<{ ok?: boolean; error?: string; profile?: MeritProfile }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ error: 'Mất kết nối' });
      this.socket.emit(event, data, (res: any) => resolve(res || {}));
    });
  }
  public buyItem(itemId: string) { return this.shopCall('shop:buy', { itemId }); }
  public equipItem(itemId: string, on: boolean) { return this.shopCall('shop:equip', { itemId, on }); }
  public donate(amount: number) { return this.shopCall('communal:donate', { amount }); }

  // Gửi chat
  public sendChat(text: string): Promise<{ ok?: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ error: 'Mất kết nối' });
      this.socket.emit('chat', text, (res: any) => {
        resolve(res || {});
      });
    });
  }

  // Đổi phòng ngay trong chùa
  public switchRoom(roomId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Mất kết nối'));
      this.socket.emit('room:switch', roomId, (res: any) => {
        if (res?.ok) resolve(res);
        else reject(new Error(res?.error || 'Không thể đổi phòng'));
      });
    });
  }

  // Mở phòng mới
  public createRoom(name?: string, theme?: string): Promise<{ ok?: boolean; room?: RoomInfo; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ error: 'Mất kết nối' });
      let uid = '';
      try { uid = localStorage.getItem('chua_uid') || ''; } catch {}
      this.socket.emit('room:create', { name, theme, uid }, (res: any) => {
        resolve(res || {});
      });
    });
  }
}

export const network = new NetworkClient();
