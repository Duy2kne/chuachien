import React from 'react';
import type { InfoContent } from '../scene/maps/infoContent.js';

// Bảng thông tin hiện khi đứng gần bia / biển tầng địa ngục (bấm X để ẩn, đi chỗ khác rồi quay lại sẽ hiện lại)
export const InfoPanel: React.FC<{ info: InfoContent; onClose: () => void }> = ({ info, onClose }) => (
  <div className="fixed z-20 left-1/2 -translate-x-1/2 bottom-[92px] w-[92vw] max-h-[40vh] sm:left-auto sm:translate-x-0 sm:right-4 sm:bottom-auto sm:top-[76px] sm:w-[360px] sm:max-h-[calc(100vh-200px)] [@media(max-height:520px)]:max-h-[52vh] overflow-y-auto rounded-2xl border border-amber-600/50 bg-gradient-to-b from-stone-900/95 to-stone-950/95 shadow-2xl backdrop-blur-sm text-stone-100 select-text pointer-events-auto">
    <div className="flex items-start gap-2 px-4 pt-3 pb-2 border-b border-amber-700/30">
      <div className="flex-1 min-w-0">
        <div className="font-serif font-bold text-amber-200 text-[15px] leading-snug">{info.title}</div>
        {info.subtitle && <div className="text-[12px] text-amber-400/90 italic mt-0.5">{info.subtitle}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="shrink-0 w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm leading-none cursor-pointer"
      >
        ✕
      </button>
    </div>
    <div className="px-4 py-3 space-y-2.5 text-[13px] leading-relaxed">
      {info.body && <p className="text-stone-200">{info.body}</p>}
      {info.sin && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-red-300/90 font-semibold">Tội</div>
          <p className="text-stone-200">{info.sin}</p>
        </div>
      )}
      {info.punish && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-orange-300/90 font-semibold">Quả báo</div>
          <p className="text-stone-300">{info.punish}</p>
        </div>
      )}
      {info.advice && (
        <div className="rounded-xl bg-emerald-950/50 border border-emerald-700/40 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">Hướng thiện</div>
          <p className="text-emerald-50">{info.advice}</p>
        </div>
      )}
      {info.note && <p className="text-[12px] text-sky-200/90 bg-sky-950/40 border border-sky-800/40 rounded-xl px-3 py-2">{info.note}</p>}
    </div>
  </div>
);
