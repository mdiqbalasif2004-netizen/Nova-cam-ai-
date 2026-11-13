import React from 'react';

interface GlassProps {
  children: React.ReactNode;
  className?: string;
  subtle?: boolean;
}

export function LiquidGlassPanel({ children, className = '', subtle = false }: GlassProps) {
  return (
    <div className={`${subtle ? 'liquid-glass-subtle' : 'liquid-glass'} rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

interface HistogramProps {
  bins: number[];
  highlightClipPct: number;
  shadowCrushPct: number;
}

export function LiveHistogram({ bins, highlightClipPct, shadowCrushPct }: HistogramProps) {
  const safeBins = bins.length === 64 ? bins : new Array<number>(64).fill(0.1);
  const w = 160;
  const h = 44;
  const points = safeBins
    .map((val, idx) => {
      const x = (idx / (safeBins.length - 1)) * w;
      const y = h - val * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaPath = `M 0,${h} L ${points.replace(/ /g, ' L ')} L ${w},${h} Z`;

  return (
    <div className="liquid-glass-subtle rounded-xl p-2.5 w-44 select-none">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-11 overflow-visible" aria-label="Live luminance histogram">
        <defs>
          <linearGradient id="novaHistGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--nova-accent)" stopOpacity="0.65" />
            <stop offset="100%" stopColor="var(--nova-accent)" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#novaHistGrad)" />
        <polyline fill="none" stroke="var(--nova-accent)" strokeWidth="1.4" points={points} />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-400">
        <span>SHDW {shadowCrushPct.toFixed(0)}%</span>
        <span>HIGH {highlightClipPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
