import React, { useEffect, useState } from 'react';
import type { TempleWorld } from '../scene/templeWorld.js';

interface Pos { x: number; z: number; ry?: number }

interface MiniMapProps {
  getWorld: () => TempleWorld | null;
  getSelf: () => Pos | null;
  getOthers: () => Pos[];
  activeId: string | null;   // điểm thông tin đang đứng gần (tô sáng)
}

const FILL: Record<string, string> = {
  wall: '#57534e',
  dais: '#7c2d12',
  altar: '#a16207',
  statue: '#78350f'
};

// Bản đồ nhỏ góc màn hình: vách, bệ tượng, số thứ tự các tầng / các vị La Hán, vị trí mình và người khác.
// Bắc (phía tượng chính) ở trên.
export const MiniMap: React.FC<MiniMapProps> = ({ getWorld, getSelf, getOthers, activeId }) => {
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 160);
    return () => clearInterval(id);
  }, []);

  const world = getWorld();
  if (!world || !world.spec.minimap) return null;
  const B = world.spec.bounds;
  const pad = 1.5;
  const vx = B.minX - pad;
  const vz = B.minZ - pad;
  const vw = B.maxX - B.minX + pad * 2;
  const vh = B.maxZ - B.minZ + pad * 2;
  const unit = Math.max(vw, vh) / 42;   // cỡ chữ / chấm theo kích thước bản đồ
  const self = getSelf();
  const others = getOthers();

  return (
    <div className="fixed z-10 left-3 sm:left-4 top-[124px] sm:top-[136px] [@media(max-height:520px)]:top-[110px] select-none pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="mb-1 px-2 py-0.5 rounded-full bg-stone-900/85 border border-amber-600/40 text-[10px] sm:text-[11px] text-amber-200 font-semibold cursor-pointer"
        title={open ? 'Ẩn bản đồ' : 'Hiện bản đồ'}
      >
        🗺️ {world.spec.name} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div
          className="rounded-xl overflow-hidden border border-amber-600/40 bg-stone-950/80 shadow-xl backdrop-blur-sm"
          style={{ width: vw >= vh ? 'min(42vw, 190px)' : 'min(30vw, 130px)', aspectRatio: `${vw} / ${vh}` }}
        >
          <svg viewBox={`${vx} ${vz} ${vw} ${vh}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect x={B.minX} y={B.minZ} width={B.maxX - B.minX} height={B.maxZ - B.minZ} fill="#1c1917" />
            {world.minimap.rects.map((r, i) => (
              <rect key={i} x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill={FILL[r.kind] || '#57534e'} opacity={r.kind === 'wall' ? 0.95 : 0.75} />
            ))}
            {world.minimap.marks.map((m, i) => {
              const on = !!m.id && m.id === activeId;
              return (
                <g key={i}>
                  <circle cx={m.x} cy={m.z} r={unit * 1.25} fill={on ? '#fbbf24' : '#292524'} stroke={on ? '#fff7ed' : '#d97706'} strokeWidth={unit * 0.18} />
                  <text x={m.x} y={m.z} fontSize={unit * 1.35} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={on ? '#1c1917' : '#fde68a'}>
                    {m.label}
                  </text>
                </g>
              );
            })}
            {others.map((o, i) => (
              <circle key={i} cx={o.x} cy={o.z} r={unit * 0.6} fill="#7dd3fc" opacity={0.85} />
            ))}
            {self && (
              <g transform={`translate(${self.x} ${self.z}) rotate(${(-(self.ry ?? 0) * 180) / Math.PI})`}>
                <circle r={unit * 1.6} fill="#22c55e" opacity={0.25} />
                <polygon points={`0,${unit * 1.5} ${unit},${-unit} 0,${-unit * 0.4} ${-unit},${-unit}`} fill="#4ade80" stroke="#052e16" strokeWidth={unit * 0.15} />
              </g>
            )}
          </svg>
        </div>
      )}
    </div>
  );
};
