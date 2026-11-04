import React, { useEffect, useRef, useState } from 'react';
import type { ActionType } from '../types.js';

interface ActionItem {
  type: ActionType;
  label: string;
  icon: string;
  merit: number;
  isToggle?: boolean;
}

const ACTIONS: ActionItem[] = [
  { type: 'namaste', label: 'Chắp tay', icon: '🙏', merit: 1, isToggle: true },
  { type: 'bow', label: 'Lạy Phật', icon: '🙇', merit: 3 },
  { type: 'incense', label: 'Thắp hương', icon: '🪔', merit: 5 },
  { type: 'flower', label: 'Dâng hoa', icon: '🪷', merit: 5 },
  { type: 'wooden_fish', label: 'Gõ mõ', icon: '🪵', merit: 2, isToggle: true },
  { type: 'meditate', label: 'Ngồi thiền', icon: '🧘', merit: 3, isToggle: true },
  { type: 'bell', label: 'Thỉnh chuông', icon: '🔔', merit: 3 },
  { type: 'drum', label: 'Đánh trống', icon: '🥁', merit: 3 },
  { type: 'lantern', label: 'Hoa đăng', icon: '🏮', merit: 5 },
  { type: 'sweep', label: 'Quét lá', icon: '🧹', merit: 2 },
  { type: 'kitchen', label: 'Phụ bếp', icon: '🍲', merit: 5 },
  { type: 'wave', label: 'Vẫy chào', icon: '👋', merit: 0 }
];

interface ActionBarProps {
  currentAnim: ActionType;
  isNavigatingToTarget: boolean;
  onTriggerAction: (type: ActionType) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  currentAnim,
  isNavigatingToTarget,
  onTriggerAction
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Hiện mũi tên khi thanh bị tràn (màn hình hẹp), ẩn khi đã thấy đủ
  const updateEdges = () => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, []);

  // Lăn chuột dọc cũng cuộn ngang thanh hành động
  const handleWheel = (e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
  };

  const scrollBy = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });

  return (
    <div className="fixed bottom-3 sm:bottom-4 [@media(max-height:520px)]:bottom-2 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-[860px] [@media(max-height:520px)]:w-auto [@media(max-height:520px)]:max-w-[calc(100vw-250px)] select-none pb-[env(safe-area-inset-bottom)]">
      <div className="relative bg-stone-900/80 border border-amber-600/35 rounded-2xl [@media(max-height:520px)]:rounded-full shadow-2xl backdrop-blur-xs">
        <div
          ref={scrollRef}
          onScroll={updateEdges}
          onWheel={handleWheel}
          className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 overflow-x-auto no-scrollbar touch-pan-x scroll-smooth"
        >
          {ACTIONS.map((act) => {
            const isActive = currentAnim === act.type || (act.type === 'kitchen' && ['take_plate', 'take_bun', 'lift_plate', 'carry', 'serve'].includes(currentAnim));
            return (
              <button
                key={act.type}
                type="button"
                disabled={isNavigatingToTarget}
                onClick={() => onTriggerAction(act.type)}
                title={`${act.label}${act.merit > 0 ? ` (+${act.merit})` : ''}`}
                aria-label={act.label}
                className={`flex-1 flex-shrink-0 flex flex-col items-center justify-center min-w-[58px] sm:min-w-[66px] min-h-[56px] sm:min-h-[60px] [@media(max-height:520px)]:min-w-[44px] [@media(max-height:520px)]:min-h-[44px] [@media(max-height:520px)]:w-11 [@media(max-height:520px)]:h-11 [@media(max-height:520px)]:flex-none [@media(max-height:520px)]:rounded-full px-1 py-1 rounded-xl transition cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/30'
                    : 'bg-stone-950/70 hover:bg-stone-800 text-stone-200 border border-stone-800/80 hover:border-amber-500/40'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="text-xl leading-none">{act.icon}</span>
                <span className="text-[10px] sm:text-[11px] font-medium tracking-tight whitespace-nowrap mt-0.5 [@media(max-height:520px)]:hidden">
                  {act.label}
                </span>
                {act.merit > 0 && (
                  <span className={`text-[9px] leading-tight font-serif [@media(max-height:520px)]:hidden ${isActive ? 'text-stone-950 font-bold' : 'text-amber-400/90'}`}>
                    +{act.merit}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {edges.left && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="absolute left-0 top-0 bottom-0 w-8 rounded-l-2xl bg-gradient-to-r from-stone-900 to-transparent text-amber-300 text-lg cursor-pointer"
            aria-label="Cuộn trái"
          >
            ‹
          </button>
        )}
        {edges.right && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="absolute right-0 top-0 bottom-0 w-8 rounded-r-2xl bg-gradient-to-l from-stone-900 to-transparent text-amber-300 text-lg cursor-pointer"
            aria-label="Cuộn phải"
          >
            ›
          </button>
        )}
      </div>

      {isNavigatingToTarget && (
        <div className="text-center mt-1">
          <span className="text-xs px-3 py-1 rounded-full bg-stone-900/90 border border-amber-500/40 text-amber-300 shadow">
            🚶 Đang bước tới vị trí chiêm bái... (Bấm phím di chuyển để dừng)
          </span>
        </div>
      )}
    </div>
  );
};
