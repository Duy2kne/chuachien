import React, { useState } from 'react';
import type { WishItem } from '../types.js';
import { X, Heart } from 'lucide-react';

interface WishDialogProps {
  mode: 'tie' | 'view';
  viewingWish?: WishItem | null;
  onClose: () => void;
  onTie?: (wish: string) => void;
}

const SAMPLE_WISHES = [
  'Cầu cho con sớm gặp được người thương, hiểu mình và thương mình 💞',
  'Nguyện cho tình yêu của chúng con bền lâu, sớm về chung một nhà 💍',
  'Cầu duyên lành đến đúng lúc, gặp đúng người, nắm tay đến bạc đầu 🌸',
  'Cầu cho gia đình nhỏ luôn hạnh phúc, vợ chồng thuận hoà, con cái ngoan hiền 🏡',
  'Mong người ấy cũng đang nghĩ về mình 🥰'
];

// Hộp thoại buộc dải lụa cầu duyên lên Cây Đa / đọc lời cầu của người khác
export const WishDialog: React.FC<WishDialogProps> = ({ mode, viewingWish, onClose, onTie }) => {
  const [wish, setWish] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onTie?.(wish.trim() || SAMPLE_WISHES[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-gradient-to-b from-rose-950 to-stone-900 border border-rose-500/40 rounded-2xl shadow-2xl p-5 sm:p-6 text-stone-100 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-rose-900/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💞</span>
            <div>
              <h2 className="text-lg font-serif font-bold text-rose-200">
                {mode === 'tie' ? 'Cầu Duyên Cây Đa' : 'Dải Lụa Cầu Duyên'}
              </h2>
              <div className="text-xs text-rose-200/60">
                {mode === 'tie' ? 'Viết lời cầu lên dải lụa đỏ rồi buộc lên cành đa' : 'Lời cầu chân thành của một người'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {mode === 'tie' ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-rose-300 mb-1.5 uppercase tracking-wider">
                Lời cầu duyên (tối đa 120 ký tự):
              </label>
              <textarea
                maxLength={120}
                rows={3}
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder="Cầu cho con sớm gặp được người thương..."
                className="w-full px-3 py-2 text-sm bg-stone-950 border border-rose-900 rounded-xl text-stone-100 focus:outline-none focus:border-rose-400 placeholder-stone-500"
              />
              <div className="text-right text-[10px] text-stone-500 mt-0.5">{wish.length}/120</div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-stone-400 font-medium">Gợi ý lời cầu:</span>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                {SAMPLE_WISHES.map((w, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setWish(w)}
                    className="text-left text-[11px] p-2 rounded-lg bg-stone-950/60 border border-rose-950 text-stone-300 hover:border-rose-500/50 hover:text-rose-200 transition cursor-pointer"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-rose-200/70 leading-relaxed">
              Dải lụa của bạn sẽ treo trên Cây Đa Se Duyên 24 giờ. Ai bấm vào dải lụa có trái tim cũng đọc được lời cầu.
            </div>

            <button
              type="submit"
              className="mt-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-serif font-bold text-sm shadow transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Heart size={16} className="fill-white" />
              <span>Buộc Dải Lụa Lên Cây Đa (+5 Công Đức)</span>
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            <div className="p-4 rounded-xl bg-stone-950/80 border border-rose-500/30 text-center space-y-2">
              <div className="text-xs text-rose-300 font-semibold font-serif">💞 {viewingWish?.playerName || 'Người có duyên'}</div>
              <p className="text-sm font-serif italic text-stone-200 leading-relaxed break-words">
                "{viewingWish?.text || SAMPLE_WISHES[0]}"
              </p>
              {viewingWish && (
                <div className="text-[10px] text-stone-500">
                  Buộc lúc {new Date(viewingWish.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </div>
              )}
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
