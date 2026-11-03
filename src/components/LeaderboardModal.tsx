import React, { useState } from 'react';
import { X, Trophy } from 'lucide-react';
import { ROBE_COLORS } from '../scene/playerAvatar.js';
import type { LeaderboardEntry, PlayerData } from '../types.js';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];       // Top công đức toàn chùa (server gửi)
  roomPlayers: PlayerData[];         // Người đang ở trong phòng
  selfName: string;
  selfMerit: number;
  totalMerit?: number;
  onClose: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ entries, roomPlayers, selfName, selfMerit, totalMerit, onClose }) => {
  const [tab, setTab] = useState<'all' | 'room'>('all');

  const roomRows = [...roomPlayers]
    .sort((a, b) => (b.merit || 0) - (a.merit || 0))
    .map(p => ({ name: p.name, merit: p.merit || 0, robe: p.robe, online: true }));
  const rows = tab === 'all' ? entries : roomRows;
  const myRank = entries.findIndex(e => e.name === selfName && e.merit === selfMerit);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl p-5 text-stone-100 flex flex-col gap-3 max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" />
            <h2 className="text-base font-serif font-bold text-amber-200">Bảng Công Đức</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800">
            <div className="text-[10px] text-stone-400">Công đức của bạn</div>
            <div className="text-lg font-serif font-bold text-amber-300">{selfMerit}</div>
            <div className="text-[10px] text-stone-400">{myRank >= 0 ? `Hạng ${myRank + 1} toàn chùa` : 'Chưa vào top'}</div>
          </div>
          <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800">
            <div className="text-[10px] text-stone-400">Công đức cả chùa</div>
            <div className="text-lg font-serif font-bold text-amber-300">{(totalMerit || 0).toLocaleString('vi-VN')}</div>
            <div className="text-[10px] text-stone-400">từ mọi Phật tử</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-950/60 border border-stone-800">
          {([['all', 'Toàn chùa'], ['room', 'Trong phòng']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                tab === key ? 'bg-amber-600/30 text-amber-200' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ol className="flex-1 overflow-y-auto space-y-1 pr-1">
          {rows.length === 0 && (
            <li className="text-center text-xs text-stone-500 py-6">Chưa có ai tích công đức. Hãy là người đầu tiên 🙏</li>
          )}
          {rows.map((r, i) => {
            const isMe = r.name === selfName && r.merit === selfMerit;
            return (
              <li
                key={`${r.name}-${i}`}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border ${
                  isMe ? 'bg-amber-600/20 border-amber-500/50' : 'bg-stone-950/40 border-stone-800'
                }`}
              >
                <span className="w-6 text-center text-sm font-bold text-stone-400">{MEDALS[i] || i + 1}</span>
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                  style={{ backgroundColor: ROBE_COLORS[r.robe]?.css || '#5e371d' }}
                />
                <span className="flex-1 text-sm truncate">
                  {r.name}
                  {r.online && tab === 'all' && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 align-middle" title="Đang trong chùa" />}
                </span>
                <span className="text-sm font-serif font-bold text-amber-300">{r.merit}</span>
              </li>
            );
          })}
        </ol>

        <p className="text-[11px] text-stone-500 leading-relaxed">
          Công đức được lưu trên chùa theo trình duyệt của bạn. Ngồi thiền, gõ mõ, chắp tay liên tục: cứ 30 giây được thêm 1 công đức.
        </p>
      </div>
    </div>
  );
};
