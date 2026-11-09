import React, { useEffect, useState } from 'react';

// Vòng hướng dẫn thở khi ngồi thiền ở Thiền Đường: hít vào 4 giây (vòng nở), thở ra 6 giây (vòng thu), kèm đồng hồ
const INHALE = 4;
const EXHALE = 6;

export const MeditationGuide: React.FC = () => {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const sec = (now - start) / 1000;
  const c = sec % (INHALE + EXHALE);
  const inhale = c < INHALE;
  const k = inhale ? c / INHALE : 1 - (c - INHALE) / EXHALE;
  const ease = 0.5 - Math.cos(k * Math.PI) / 2;
  const scale = 0.55 + ease * 0.45;
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60).toString().padStart(2, '0');
  const breaths = Math.floor(sec / (INHALE + EXHALE));

  return (
    <div className="fixed z-10 left-1/2 -translate-x-1/2 top-[18%] [@media(max-height:520px)]:top-[8%] pointer-events-none flex flex-col items-center gap-2 select-none">
      <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-amber-200/30" />
        <div
          className="absolute inset-0 rounded-full bg-amber-200/15 border-2 border-amber-200/70 shadow-[0_0_40px_rgba(253,230,138,0.45)]"
          style={{ transform: `scale(${scale})`, transition: 'transform 0.1s linear' }}
        />
        <span className="relative font-serif text-amber-50 text-base sm:text-lg drop-shadow">{inhale ? 'Hít vào…' : 'Thở ra…'}</span>
      </div>
      <div className="text-[12px] text-amber-100/90 bg-stone-950/50 rounded-full px-3 py-1 drop-shadow">
        🧘 {mm}:{ss} · {breaths} hơi thở
      </div>
    </div>
  );
};
