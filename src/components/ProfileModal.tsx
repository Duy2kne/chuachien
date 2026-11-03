import React, { useState } from 'react';
import { X, UserPen } from 'lucide-react';
import { ROBE_COLORS } from '../scene/playerAvatar.js';
import type { RobeColor, AvatarStyle } from '../types.js';

interface ProfileModalProps {
  name: string;
  robe: RobeColor;
  style: AvatarStyle;
  onClose: () => void;
  onSave: (data: { name: string; robe: RobeColor; style: AvatarStyle }) => Promise<string | null>;
}

// Đổi pháp danh, màu áo tràng, dáng nhân vật ngay trong chùa (không cần tải lại trang)
export const ProfileModal: React.FC<ProfileModalProps> = ({ name: initialName, robe: initialRobe, style: initialStyle, onClose, onSave }) => {
  const [name, setName] = useState(initialName);
  const [robe, setRobe] = useState<RobeColor>(initialRobe);
  const [style, setStyle] = useState<AvatarStyle>(initialStyle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const changed = trimmed !== initialName || robe !== initialRobe || style !== initialStyle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) {
      setError('Xin nhập pháp danh / tên của bạn');
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave({ name: trimmed, robe, style });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs select-none">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl p-5 text-stone-100 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <div className="flex items-center gap-2">
            <UserPen size={18} className="text-amber-400" />
            <h2 className="text-base font-serif font-bold text-amber-200">Hồ sơ của tôi</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-amber-300 mb-1.5 uppercase tracking-wider">
            Pháp danh / Tên:
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-700 focus:border-amber-500 focus:outline-none text-stone-100 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-amber-300 mb-1.5 uppercase tracking-wider">
            Dáng nhân vật:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([['monk', '🧑‍🦲', 'Chú tiểu'], ['lay', '🧘', 'Phật tử']] as const).map(([key, icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStyle(key)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm font-medium transition cursor-pointer ${
                  style === key
                    ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                    : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

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
                  className={`w-8 h-8 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
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

        {error && <p className="text-xs text-rose-300">{error}</p>}

        <button
          type="submit"
          disabled={!changed || saving}
          className="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 font-serif font-bold text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </form>
    </div>
  );
};
