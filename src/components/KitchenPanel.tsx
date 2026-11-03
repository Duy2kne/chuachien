import React from 'react';
import { BUNS_PER_PLATE } from '../shared/dining.js';

export interface KitchenState {
  plate: number | null;   // đĩa trên quầy: null = chưa lấy, 0-3 = số bánh bao
  carrying: boolean;      // đang bưng đĩa
}

interface KitchenPanelProps extends KitchenState {
  atCounter: boolean;     // đang đứng ở quầy bếp
  nearTable: boolean;     // đang đứng sát bàn ăn (đặt đĩa được)
  isTouch: boolean;
  busy: boolean;          // đang làm động tác / đang tự đi
  onStep: (step: number) => void;
}

// Bước nào đang làm được (theo đúng thứ tự: lấy đĩa -> 3 bánh bao -> bê đĩa -> đặt xuống)
export function kitchenStepEnabled(step: number, s: KitchenState) {
  if (step === 1) return !s.carrying && s.plate === null;
  if (step === 2) return !s.carrying && s.plate !== null && s.plate < BUNS_PER_PLATE;
  if (step === 3) return !s.carrying && s.plate === BUNS_PER_PLATE;
  if (step === 4) return s.carrying;
  return false;
}

export function nextKitchenStep(s: KitchenState) {
  return [1, 2, 3, 4].find(step => kitchenStepEnabled(step, s)) || 0;
}

const STEPS = [
  { step: 1, icon: '🍽️', label: 'Lấy đĩa' },
  { step: 2, icon: '🥟', label: 'Lấy bánh bao' },
  { step: 3, icon: '🤲', label: 'Bê đĩa' },
  { step: 4, icon: '⬇️', label: 'Đặt xuống' }
];

// Bảng thao tác phụ bếp: hiện khi ở trong trai đường hoặc đang bưng đĩa
export const KitchenPanel: React.FC<KitchenPanelProps> = ({ plate, carrying, atCounter, nearTable, isTouch, busy, onStep }) => {
  const state = { plate, carrying };
  const next = nextKitchenStep(state);
  const buns = plate ?? 0;

  let hint = '';
  if (carrying) hint = nearTable ? 'Nhấn 4 để đặt đĩa xuống bàn' : 'Mang đĩa ra bàn ăn, đến sát bàn rồi đặt xuống (bấm 4 sẽ tự đi tới bàn trống)';
  else if (!atCounter) hint = 'Đến quầy bếp cuối nhà để bắt đầu (bấm nút sẽ tự đi tới)';
  else if (plate === null) hint = 'Lấy 1 chiếc đĩa từ chồng đĩa';
  else if (buns < BUNS_PER_PLATE) hint = `Gắp bánh bao từ xửng hấp lên đĩa (${buns}/${BUNS_PER_PLATE})`;
  else hint = 'Đĩa đã đủ 3 bánh bao, bê đĩa lên';

  return (
    <div className="fixed bottom-[92px] sm:bottom-[100px] left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-[520px] select-none">
      <div className="bg-stone-900/95 border border-amber-500/50 rounded-2xl shadow-2xl p-2 sm:p-2.5">
        <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] sm:text-xs">
          <span className="font-serif font-bold text-amber-200">🍲 Phụ bếp trai đường</span>
          <span className="text-stone-400">
            Bánh bao: <b className="text-amber-300">{buns}/{BUNS_PER_PLATE}</b> · đặt xuống <b className="text-amber-300">+5</b>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {STEPS.map(({ step, icon, label }) => {
            const enabled = kitchenStepEnabled(step, state) && !busy;
            const isNext = step === next;
            return (
              <button
                key={step}
                type="button"
                disabled={!enabled}
                onClick={() => onStep(step)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                  isNext && enabled
                    ? 'bg-amber-500 text-stone-950 border-amber-300 shadow-md shadow-amber-500/30'
                    : enabled
                      ? 'bg-stone-800 text-stone-100 border-stone-700 hover:border-amber-500/50'
                      : 'bg-stone-950/60 text-stone-500 border-stone-800'
                }`}
              >
                {!isTouch && (
                  <kbd className={`absolute top-0.5 left-1 text-[9px] font-bold ${isNext && enabled ? 'text-stone-900' : 'text-stone-500'}`}>{step}</kbd>
                )}
                <span className="text-lg leading-none">{icon}</span>
                <span className="mt-0.5 whitespace-nowrap">
                  {label}
                  {step === 2 && ` ${buns}/${BUNS_PER_PLATE}`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-[11px] text-stone-300 pt-1.5">
          {hint}
          {!isTouch && <span className="text-stone-500"> · Phím <b className="text-amber-300">E</b>: làm bước tiếp theo</span>}
        </p>
      </div>
    </div>
  );
};
