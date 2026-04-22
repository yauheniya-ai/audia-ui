// components/MusicVisualizer.tsx
import { useEffect, useRef, useState } from "react";

const WAVES = [
  { freq: 1.7, phase: 0.0 },
  { freq: 2.5, phase: 1.3 },
  { freq: 1.3, phase: 2.6 },
  { freq: 2.9, phase: 0.9 },
  { freq: 2.1, phase: 3.8 },
];

const COLORS = ["#a855f7", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];

const BAR_W   = 5;
const BAR_H   = 3;
const BAR_R   = 1.5;
const ROW_GAP = 2;
const COL_GAP = 3;
const ROWS    = 3;
const COLS    = 5;
const PAD     = 2;
const STEP    = BAR_H + ROW_GAP;
const SVG_W   = COLS * BAR_W + (COLS - 1) * COL_GAP + PAD * 2;
const SVG_H   = ROWS * BAR_H + (ROWS - 1) * ROW_GAP + PAD * 2;

interface MusicVisualizerProps {
  isDark: boolean;
}

export default function MusicVisualizer({ isDark }: MusicVisualizerProps) {
  const [heights, setHeights] = useState<number[]>([2, 3, 4, 2, 3]);
  const rafRef = useRef<number>(0);
  const t0Ref  = useRef<number>(Date.now());

  useEffect(() => {
    const tick = () => {
      const t = (Date.now() - t0Ref.current) / 1000;
      setHeights(
        WAVES.map(({ freq, phase }) =>
          Math.max(1, Math.round(((Math.sin(t * freq + phase) + 1) / 2) * 5))
        )
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const dimColor = isDark ? "#ffffff" : "#000000";

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
      {COLORS.map((color, ci) => {
        const x = PAD + ci * (BAR_W + COL_GAP);
        return (
          <g key={ci}>
            {Array.from({ length: ROWS }, (_, di) => {
              const pos = ROWS - di;
              const y   = PAD + di * STEP;
              const lit = pos <= heights[ci];
              return (
                <rect
                  key={di}
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={BAR_H}
                  rx={BAR_R}
                  ry={BAR_R}
                  fill={lit ? color : dimColor}
                  opacity={lit ? 1 : 0.08}
                  style={{ transition: "fill 60ms linear, opacity 60ms linear" }}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}