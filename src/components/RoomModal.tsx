import React, { useState } from 'react';
import type { RoomInfo, PlayerData } from '../types.js';
import { ROBE_COLORS } from '../scene/playerAvatar.js';
import { getTheme, THEMES } from '../scene/themes.js';
import { X, Users, Copy, Check, Plus, DoorOpen } from 'lucide-react';

interface RoomModalProps {
  currentRoom: { id: string; name: string; count: number; max: number };
  rooms: RoomInfo[];
  playersInRoom: PlayerData[];
  onClose: () => void;
  onSwitchRoom: (roomId: string) => void;
  onCreateRoom: (name?: string, theme?: string) => Promise<any>;
  canPickTheme?: boolean;   // đã đổi "Phòng riêng tự chọn cảnh"
}

export const RoomModal: React.FC<RoomModalProps> = ({
  currentRoom,
  rooms,
  playersInRoom,
  onClose,
  onSwitchRoom,
  onCreateRoom,
  canPickTheme = false
}) => {
  const [newTheme, setNewTheme] = useState('');
  const [tab, setTab] = useState<'players' | 'rooms'>('players');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoom.id}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await onCreateRoom(newRoomName.trim() || undefined, newTheme || undefined);
      if (res?.error) {
        setErrorMsg(res.error);
      } else if (res?.room) {
        onSwitchRoom(res.room.id);
        setIsCreating(false);
        setNewRoomName('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi tạo phòng');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl p-5 text-stone-100 flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">卍</span>
            <div>
              <h2 className="text-lg font-serif font-bold text-amber-200">
                Phòng {currentRoom.name}
              </h2>
              <div className="text-xs text-stone-400">
                {playersInRoom.length} / {currentRoom.max} người đang tịnh tu
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nút sao chép link mời */}
        <div className="flex items-center justify-between p-2.5 bg-stone-950/70 rounded-xl border border-stone-800 text-xs">
          <span className="text-stone-300 truncate mr-2">
            Mời bạn bè cùng viếng: ?room={currentRoom.id}
          </span>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition cursor-pointer"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép link'}</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('players')}
            className={`flex-1 py-2 text-center border-b-2 cursor-pointer transition ${
              tab === 'players'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Phật Tử Trong Phòng ({playersInRoom.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('rooms')}
            className={`flex-1 py-2 text-center border-b-2 cursor-pointer transition ${
              tab === 'rooms'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Đổi Sang Phòng Khác ({rooms.length})
          </button>
        </div>

        {/* Nội dung Tab */}
        <div className="h-64 overflow-y-auto pr-1">
          {tab === 'players' ? (
            <div className="space-y-2">
              {playersInRoom.map((p) => {
                const robeInfo = ROBE_COLORS[p.robe];
                let activity = 'Đang bách bộ';
                if (p.anim === 'meditate') activity = 'Đang thiền định 🧘';
                else if (p.anim === 'bow') activity = 'Đang lạy Phật 🙇';
                else if (p.anim === 'namaste') activity = 'Đang chắp tay niệm Phật 🙏';
                else if (p.anim === 'incense') activity = 'Đang thắp hương 🪔';
                else if (p.anim === 'flower') activity = 'Đang dâng hoa 🪷';
                else if (p.anim === 'wooden_fish') activity = 'Đang gõ mõ tụng kinh 🪵';
                else if (p.anim === 'bell') activity = 'Đang thỉnh chuông 🔔';
                else if (p.anim === 'drum') activity = 'Đang đánh trống bát nhã 🥁';
                else if (p.anim === 'lantern') activity = 'Đang thả đèn hoa đăng 🏮';

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full border border-stone-700 flex-shrink-0"
                        style={{ backgroundColor: robeInfo?.css || '#5e371d' }}
                        title={robeInfo?.name}
                      />
                      <div>
                        <div className="font-semibold text-stone-100">{p.name}</div>
                        <div className="text-[11px] text-amber-400/90">{activity}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-stone-400 font-serif">
                        Công đức: <strong className="text-amber-300">{p.merit || 0}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400">
                  Chuyển phòng lập tức không cần tải lại trang
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(!isCreating)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Mở phòng mới</span>
                </button>
              </div>

              {isCreating && (
                <form onSubmit={handleCreate} className="flex flex-wrap gap-2 p-2 bg-stone-950/80 rounded-xl border border-amber-600/30">
                  <input
                    type="text"
                    maxLength={20}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Tên phòng mới..."
                    className="flex-1 px-3 py-1 text-xs bg-stone-900 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded cursor-pointer"
                  >
                    Tạo
                  </button>
                  <select
                    value={newTheme}
                    disabled={!canPickTheme}
                    onChange={(e) => setNewTheme(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-stone-900 border border-stone-700 rounded text-stone-100 disabled:text-stone-500"
                  >
                    <option value="">{canPickTheme ? 'Cảnh: ngẫu nhiên' : '🔒 Cảnh ngẫu nhiên (đổi 500 công đức để tự chọn)'}</option>
                    {canPickTheme &&
                      Object.values(THEMES).map(t => (
                        <option key={t.id} value={t.id}>
                          {t.icon} {t.name}
                        </option>
                      ))}
                  </select>
                </form>
              )}

              {errorMsg && <div className="text-xs text-rose-400">{errorMsg}</div>}

              <div className="grid grid-cols-2 gap-2">
                {rooms.map((r) => {
                  const isCurrent = r.id === currentRoom.id;
                  const isFull = r.count >= r.max;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={isCurrent || isFull}
                      onClick={() => onSwitchRoom(r.id)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        isCurrent
                          ? 'bg-amber-600/20 border-amber-500/50 text-amber-200 cursor-default'
                          : isFull
                          ? 'bg-stone-950/40 border-stone-800/50 opacity-50 cursor-not-allowed'
                          : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-xs" title={getTheme(r.theme).name}>{getTheme(r.theme).icon} {r.name}</span>
                        {isCurrent ? (
                          <span className="text-[10px] text-amber-400 font-medium">Hiện tại</span>
                        ) : isFull ? (
                          <span className="text-[10px] text-rose-400">Đầy</span>
                        ) : (
                          <DoorOpen size={13} className="text-stone-400" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-400 mt-2">
                        <span>{r.count}/{r.max} người</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
