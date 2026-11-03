import React, { useState } from 'react';
import { X, Gift } from 'lucide-react';
import {
  SHOP_ITEMS,
  COMMUNAL_PROJECTS,
  TITLES,
  getTitle,
  getNextTitle,
  type ShopItem,
  type MeritProfile,
  type CommunalState
} from '../shared/merit.js';

interface ShopModalProps {
  profile: MeritProfile;
  communal: CommunalState;
  initialTab?: Tab;
  onClose: () => void;
  onBuy: (itemId: string) => Promise<string | null>;
  onEquip: (itemId: string, on: boolean) => Promise<string | null>;
  onDonate: (amount: number) => Promise<string | null>;
}

type Tab = 'items' | 'communal' | 'unlock';

// Đổi công đức: vật phẩm cho nhân vật, cúng dường xây công trình chung, mở khoá nhạc & cảnh
export const ShopModal: React.FC<ShopModalProps> = ({ profile, communal, initialTab = 'items', onClose, onBuy, onEquip, onDonate }) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const title = getTitle(profile.merit);
  const next = getNextTitle(profile.merit);
  const titleProgress = next ? (profile.merit - title.min) / (next.min - title.min) : 1;

  const run = async (fn: () => Promise<string | null>, success: string) => {
    setBusy(true);
    setMessage(null);
    const err = await fn();
    setBusy(false);
    setMessage(err ? { text: err, error: true } : { text: success, error: false });
  };

  const renderItem = (item: ShopItem) => {
    const owned = profile.owned.includes(item.id);
    const equipped = profile.equipped.includes(item.id);
    const affordable = profile.balance >= item.cost;
    return (
      <li key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-950/50 border border-stone-800">
        <span className="text-2xl w-9 text-center">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-stone-100">{item.name}</div>
          <div className="text-[11px] text-stone-400 leading-snug">{item.description}</div>
        </div>
        {!owned ? (
          <button
            type="button"
            disabled={busy || !affordable}
            onClick={() => run(() => onBuy(item.id), `Đã đổi ${item.name} 🙏`)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-stone-950 disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            ✦ {item.cost}
          </button>
        ) : item.kind === 'wear' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onEquip(item.id, !equipped), equipped ? `Đã cất ${item.name}` : `Đang mang ${item.name}`)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              equipped ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50' : 'bg-stone-800 text-stone-300 border border-stone-700'
            }`}
          >
            {equipped ? '✓ Đang mang' : 'Mang vào'}
          </button>
        ) : (
          <span className="px-2.5 py-1.5 text-xs font-bold text-emerald-300 whitespace-nowrap">✓ Đã mở</span>
        )}
      </li>
    );
  };

  const project = COMMUNAL_PROJECTS.find(p => p.id === communal.current);
  const done = project ? communal.progress[project.id] || 0 : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl p-5 text-stone-100 flex flex-col gap-3 max-h-[88vh]">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Gift size={18} className="text-amber-400" />
            <h2 className="text-base font-serif font-bold text-amber-200">Đổi công đức</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Danh hiệu & công đức */}
        <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>
              Danh hiệu: <b style={{ color: title.color }}>{title.name}</b>
            </span>
            <span className="text-stone-400">
              Khả dụng: <b className="text-amber-300 text-sm">{profile.balance}</b> / tích luỹ {profile.merit}
            </span>
          </div>
          <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.min(100, titleProgress * 100)}%` }} />
          </div>
          <div className="text-[11px] text-stone-400">
            {next ? `Còn ${next.min - profile.merit} công đức nữa để lên "${next.name}"` : 'Bạn đã đạt danh hiệu cao nhất 🙏'}
            <span className="ml-1 text-stone-500">({TITLES.map(t => `${t.name} ${t.min}`).join(' → ')})</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-stone-950/60 border border-stone-800">
          {([['items', '🎁 Vật phẩm'], ['communal', '🛕 Cúng dường'], ['unlock', '🔓 Mở khoá']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setMessage(null);
              }}
              className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                tab === key ? 'bg-amber-600/30 text-amber-200' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {tab === 'items' && <ul className="space-y-1.5">{SHOP_ITEMS.filter(i => i.kind === 'wear').map(renderItem)}</ul>}
          {tab === 'unlock' && <ul className="space-y-1.5">{SHOP_ITEMS.filter(i => i.kind !== 'wear').map(renderItem)}</ul>}

          {tab === 'communal' && (
            <div className="space-y-2">
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Cả chùa cùng góp công đức khả dụng để xây công trình mới. Xây xong, công trình hiện ra trong mọi phòng cho tất cả mọi người.
              </p>
              {COMMUNAL_PROJECTS.map(p => {
                const built = communal.built.includes(p.id);
                const isCurrent = p.id === communal.current;
                const value = built ? p.goal : communal.progress[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border ${isCurrent ? 'bg-amber-600/10 border-amber-500/40' : 'bg-stone-950/50 border-stone-800'}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">
                        {p.icon} {p.name}
                      </span>
                      <span className="text-xs text-stone-400">
                        {built ? '✓ Đã xây xong' : isCurrent ? `${value} / ${p.goal}` : '🔒 Chờ công trình trước'}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 mb-1.5">{p.description}</div>
                    <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
                      <div
                        className={`h-full ${built ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}
                        style={{ width: `${Math.min(100, (value / p.goal) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {project ? (
                <div className="flex gap-1.5 pt-1">
                  {[10, 50, 100].map(amount => (
                    <button
                      key={amount}
                      type="button"
                      disabled={busy || profile.balance < 1}
                      onClick={() => run(() => onDonate(amount), `Đã cúng dường xây ${project.name} 🙏`)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold bg-amber-500 text-stone-950 disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Góp {amount}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy || profile.balance < 1}
                    onClick={() => run(() => onDonate(profile.balance), `Đã cúng dường xây ${project.name} 🙏`)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-orange-600 text-stone-950 disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Góp hết
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-emerald-300 py-2">Cả chùa đã xây xong mọi công trình 🙏</p>
              )}
              {done > 0 && project && <p className="text-[11px] text-stone-500 text-center">Còn {project.goal - done} công đức nữa</p>}
            </div>
          )}
        </div>

        {message && <p className={`text-xs text-center ${message.error ? 'text-rose-300' : 'text-emerald-300'}`}>{message.text}</p>}
        <p className="text-[10px] text-stone-500 text-center">
          Đổi vật phẩm hay cúng dường chỉ trừ công đức khả dụng. Công đức tích luỹ (xếp hạng, danh hiệu) không bị giảm.
        </p>
      </div>
    </div>
  );
};
