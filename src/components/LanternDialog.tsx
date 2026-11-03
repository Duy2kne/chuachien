import React, { useState } from 'react';
import type { LanternItem } from '../types.js';
import { X, Send, Sparkles } from 'lucide-react';

interface LanternDialogProps {
  mode: 'release' | 'view';
  viewingLantern?: LanternItem | null;
  onClose: () => void;
  onRelease?: (wish: string) => void;
}

const SAMPLE_WISHES = [
  'Nguyện cầu gia đạo bình an, sức khỏe dồi dào, thân tâm an lạc 🙏',
  'Nguyện cầu cha mẹ sống lâu, trường thọ, phước huệ trang nghiêm 🪷',
  'Nguyện cầu thế giới hòa bình, phong điều vũ thuận, chúng sinh an vui 🕊️',
  'Nguyện con cháu hiếu thuận, công việc hanh thông, tiêu trừ chướng ngại ✨'
];

export const LanternDialog: React.FC<LanternDialogProps> = ({
  mode,
  viewingLantern,
  onClose,
  onRelease
}) => {
  const [wish, setWish] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalWish = wish.trim() || 'Nguyện cầu thế giới hòa bình, muôn loài an lạc';
    onRelease?.(finalWish);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl p-6 text-stone-100 flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏮</span>
            <div>
              <h2 className="text-lg font-serif font-bold text-amber-200">
                {mode === 'release' ? 'Thả Đèn Hoa Đăng' : 'Chiêm Bái Đèn Hoa Đăng'}
              </h2>
              <div className="text-xs text-stone-400">
                {mode === 'release' ? 'Gửi gắm ước nguyện thanh tịnh trôi theo dòng nước' : 'Lời nguyện chí thành của đại chúng'}
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

        {mode === 'release' ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5 uppercase tracking-wider">
                Nhập lời nguyện cầu (tối đa 120 ký tự):
              </label>
              <textarea
                maxLength={120}
                rows={3}
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder="Nguyện cầu bình an, may mắn, hạnh phúc..."
                className="w-full px-3 py-2 text-xs bg-stone-950 border border-stone-700 rounded-xl text-stone-100 focus:outline-none focus:border-amber-400 placeholder-stone-500"
              />
              <div className="text-right text-[10px] text-stone-500 mt-0.5">
                {wish.length}/120
              </div>
            </div>

            {/* Gợi ý lời nguyện */}
            <div className="space-y-1">
              <span className="text-[11px] text-stone-400 font-medium">Gợi ý tâm nguyện:</span>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                {SAMPLE_WISHES.map((w, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setWish(w)}
                    className="text-left text-[11px] p-2 rounded-lg bg-stone-950/60 border border-stone-800 text-stone-300 hover:border-amber-500/40 hover:text-amber-200 transition cursor-pointer"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-serif font-bold text-sm shadow transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🏮 Thả Đèn Xuống Hồ Sen (+5 Công Đức)</span>
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <div className="p-4 rounded-xl bg-stone-950/80 border border-amber-600/30 text-center space-y-2">
              <div className="text-xs text-amber-400 font-semibold font-serif">
                Phật tử: {viewingLantern?.playerName || 'Đồng hương'}
              </div>
              <p className="text-sm font-serif italic text-stone-200 leading-relaxed">
                "{viewingLantern?.text || 'Nguyện cầu thế giới hòa bình, muôn loài an lạc'}"
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
