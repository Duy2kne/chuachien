import React from 'react';
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
  { type: 'lantern', label: 'Thả hoa đăng', icon: '🏮', merit: 5 },
  { type: 'sweep', label: 'Quét lá', icon: '🧹', merit: 2 },
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
  return (
    <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl select-none pb-[env(safe-area-inset-bottom)]">
      <div className="bg-stone-900/90 border border-amber-600/35 rounded-2xl p-1 sm:p-2 shadow-2xl backdrop-blur-xs flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar touch-pan-x">
        {ACTIONS.map((act) => {
          const isActive = currentAnim === act.type;
          return (
            <button
              key={act.type}
              type="button"
              disabled={isNavigatingToTarget}
              onClick={() => onTriggerAction(act.type)}
              className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[56px] min-h-[56px] sm:min-w-[64px] sm:min-h-[64px] px-2 py-1 rounded-xl transition cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-stone-950 font-bold scale-105 shadow-md shadow-amber-500/30'
                  : 'bg-stone-950/70 hover:bg-stone-800 text-stone-200 border border-stone-800/80 hover:border-amber-500/40'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-xl sm:text-2xl leading-none">{act.icon}</span>
              <span className="text-[10px] sm:text-xs font-medium tracking-tight whitespace-nowrap mt-0.5">
                {act.label}
              </span>
              {act.merit > 0 && (
                <span className={`text-[9px] leading-tight px-1 rounded-full font-serif ${
                  isActive ? 'text-stone-950 font-bold' : 'text-amber-400/90'
                }`}>
                  +{act.merit}
                </span>
              )}
            </button>
          );
        })}
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
