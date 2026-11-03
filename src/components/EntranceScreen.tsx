import React, { useState, useEffect } from 'react';
import type { RobeColor, AvatarStyle, RoomInfo, OverallStats } from '../types.js';
import { ROBE_COLORS } from '../scene/playerAvatar.js';
import { Sparkles, Users, Plus, Volume2, ShieldCheck, HeartHandshake } from 'lucide-react';

interface EntranceScreenProps {
  initialName: string;
  initialRobe: RobeColor;
  initialStyle: AvatarStyle;
  initialRoom?: string;
  rooms: RoomInfo[];
  stats: OverallStats;
  onEnter: (data: { name: string; robe: RobeColor; style: AvatarStyle; roomId?: string }) => void;
  onCreateRoom: (name?: string) => Promise<any>;
}

export const EntranceScreen: React.FC<EntranceScreenProps> = ({
  initialName,
  initialRobe,
  initialStyle,
  initialRoom,
  rooms,
  stats,
  onEnter,
  onCreateRoom
}) => {
  const [name, setName] = useState(initialName || 'Phật tử');
  const [robe, setRobe] = useState<RobeColor>(initialRobe || 'blue');
  const [style, setStyle] = useState<AvatarStyle>(initialStyle || 'monk');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoom || '');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Tự chọn phòng có người đông nhất nhưng chưa đầy nếu chưa có chọn trước
  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      const available = [...rooms].sort((a, b) => b.count - a.count).find(r => r.count < r.max);
      if (available) setSelectedRoomId(available.id);
      else setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  const handleStart = () => {
    const trimmed = name.trim() || 'Phật tử';
    onEnter({
      name: trimmed,
      robe,
      style,
      roomId: selectedRoomId || undefined
    });
  };

  const handleCreateNewRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await onCreateRoom(newRoomName.trim() || undefined);
      if (res?.error) {
        setErrorMsg(res.error);
      } else if (res?.room) {
        setSelectedRoomId(res.room.id);
        setIsCreatingRoom(false);
        setNewRoomName('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi tạo phòng');
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 overflow-y-auto bg-stone-950/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-2xl bg-stone-900/90 border border-amber-600/40 rounded-2xl shadow-2xl p-6 sm:p-8 text-stone-100 flex flex-col gap-6 my-auto">
        
        {/* Tiêu đề trang nghiêm */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs tracking-wider uppercase">
            <span>卍</span>
            <span>Không Gian Tâm Linh Trực Tuyến</span>
            <span>卍</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-amber-200 tracking-wide mt-2">
            TÂM AN TỰ 3D
          </h1>
          <p className="text-sm text-stone-300 max-w-md mx-auto">
            Viếng chùa, thắp hương, dâng hoa, lạy Phật, thả đèn hoa đăng và lắng nghe tiếng chuông thiền tịnh cùng đại chúng.
          </p>
        </div>

        {/* Thống kê công đức chung */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 px-3 bg-stone-950/50 rounded-xl border border-stone-800 text-center">
          <div>
            <div className="text-xs text-stone-400">Tổng lượt viếng</div>
            <div className="text-base font-bold text-amber-300 font-serif">{stats.totalVisits}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Nén hương cúng</div>
            <div className="text-base font-bold text-amber-300 font-serif">{stats.incenseCount}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Lần thỉnh chuông</div>
            <div className="text-base font-bold text-amber-300 font-serif">{stats.bellCount}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Đèn hoa đăng</div>
            <div className="text-base font-bold text-amber-300 font-serif">{stats.lanternCount}</div>
          </div>
        </div>

        {/* Biểu mẫu chọn nhân vật */}
        <div className="space-y-4">
          
          {/* Nhập tên */}
          <div>
            <label className="block text-xs font-semibold text-amber-300 mb-1.5 uppercase tracking-wider">
              Tên / Pháp danh của bạn:
            </label>
            <input
              type="text"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên hoặc pháp danh..."
              className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-700 focus:border-amber-500 focus:outline-none text-stone-100 placeholder-stone-500 font-medium transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Chọn dáng nhân vật */}
            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5 uppercase tracking-wider">
                Dáng nhân vật:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStyle('monk')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm font-medium transition cursor-pointer ${
                    style === 'monk'
                      ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <span className="text-lg">🧑‍🦲</span>
                  <span>Chú tiểu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStyle('lay')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm font-medium transition cursor-pointer ${
                    style === 'lay'
                      ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <span className="text-lg">🧘</span>
                  <span>Phật tử</span>
                </button>
              </div>
            </div>

            {/* Chọn màu áo tràng */}
            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5 uppercase tracking-wider">
                Màu áo tràng ({ROBE_COLORS[robe]?.name}):
              </label>
              <div className="flex items-center justify-between gap-1.5 bg-stone-950/60 p-1.5 rounded-xl border border-stone-800">
                {(Object.keys(ROBE_COLORS) as RobeColor[]).map((key) => {
                  const item = ROBE_COLORS[key];
                  const isSelected = robe === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRobe(key)}
                      title={item.name}
                      className={`w-8 h-8 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                        isSelected ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-stone-900 scale-110' : 'hover:scale-105 opacity-80'
                      }`}
                      style={{ backgroundColor: item.css }}
                    >
                      {isSelected && <span className="text-xs text-white drop-shadow">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chọn phòng */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                Chọn phòng tịnh tu:
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingRoom(!isCreatingRoom)}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>Mở phòng mới</span>
              </button>
            </div>

            {isCreatingRoom && (
              <form onSubmit={handleCreateNewRoom} className="flex gap-2 mb-2 p-2 bg-stone-950/80 rounded-xl border border-amber-600/30">
                <input
                  type="text"
                  maxLength={20}
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Tên phòng (ví dụ: An Nhiên)..."
                  className="flex-1 px-3 py-1.5 text-xs bg-stone-900 border border-stone-700 rounded-lg text-stone-100 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-lg cursor-pointer transition"
                >
                  Tạo
                </button>
              </form>
            )}

            {errorMsg && (
              <div className="text-xs text-rose-400 mb-2">{errorMsg}</div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
              {rooms.map((r) => {
                const isSelected = selectedRoomId === r.id;
                const isFull = r.count >= r.max;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => !isFull && setSelectedRoomId(r.id)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600/25 border-amber-400 text-amber-200 shadow-md'
                        : isFull
                        ? 'bg-stone-950/40 border-stone-800/50 opacity-60 cursor-not-allowed'
                        : 'bg-stone-950/50 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm truncate">{r.name}</span>
                      {isFull ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">Đầy</span>
                      ) : (
                        <span className="text-[10px] text-amber-400/90">{r.count}/{r.max}</span>
                      )}
                    </div>
                    {/* Thanh tiến độ số người */}
                    <div className="w-full bg-stone-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (r.count / r.max) * 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Nút bấm vào chùa */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-serif font-bold text-lg shadow-lg hover:shadow-amber-500/25 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🙏 Vào Chùa Chiêm Bái</span>
          </button>
        </div>

        {/* Lưu ý nhỏ */}
        <div className="text-[11px] text-center text-stone-400 flex items-center justify-center gap-2">
          <span>🔔 Nhạc thiền sẽ ngân vang sau khi vào chùa</span>
          <span>•</span>
          <span>Giữ tâm thanh tịnh & trang nghiêm</span>
        </div>

      </div>
    </div>
  );
};
