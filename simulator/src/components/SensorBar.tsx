import React from 'react';
import { useStore } from '../store/useStore';
import { Radio } from 'lucide-react';

export const SensorBar: React.FC = () => {
  const { hardware, simState } = useStore();
  const readings = simState.sensorReadings || [];
  const count = hardware.sensorCount;

  // Calculate line centroid (weighted average)
  let sumVal = 0;
  let sumPos = 0;
  for (let i = 0; i < count; i++) {
    const val = readings[i] || 0;
    if (val > 0.1) {
      sumVal += val;
      sumPos += val * i;
    }
  }
  const centroidIndex = sumVal > 0.2 ? sumPos / sumVal : null;
  const centroidPercent = centroidIndex !== null ? (centroidIndex / (count - 1)) * 100 : null;

  return (
    <div className="bg-slate-900/90 border border-slate-700/70 rounded-xl px-3 py-2 shadow-lg backdrop-blur-md flex flex-col gap-1.5 shrink-0 mt-2 text-white">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2 text-slate-300 font-bold">
          <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          <span>Линейка оптических сенсоров (QTR Array — {count} шт)</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-[10px]">
          <span>Шаг: <strong className="text-slate-200">{hardware.sensorSpacing} мм</strong></span>
          <span>Ширина: <strong className="text-slate-200">{((count - 1) * hardware.sensorSpacing).toFixed(0)} мм</strong></span>
          <span>Вынос: <strong className="text-slate-200">{hardware.sensorDistance} мм</strong></span>
        </div>
      </div>

      {/* Sensor Bars Container with Centroid Indicator */}
      <div className="relative pt-3 pb-1">
        {/* Centroid Pointer */}
        {centroidPercent !== null && (
          <div
            className="absolute top-0 transform -translate-x-1/2 transition-all duration-75 flex flex-col items-center pointer-events-none z-10"
            style={{ left: `${Math.max(2, Math.min(98, centroidPercent))}%` }}
          >
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
          </div>
        )}

        {/* Sensor Channels Grid */}
        <div className="flex items-end justify-between gap-1 h-11 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
          {Array.from({ length: count }).map((_, idx) => {
            const rawVal = readings[idx] ?? 0;
            const heightPercent = Math.min(100, Math.max(8, rawVal * 100));
            const isLine = rawVal > 0.35;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                title={`Сенсор #${idx}: ${(rawVal * 1000).toFixed(0)} / 1000`}
              >
                <div className="w-full bg-slate-800/80 rounded-t overflow-hidden flex flex-col justify-end h-full">
                  <div
                    className={`w-full transition-all duration-75 rounded-t ${
                      isLine
                        ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                        : 'bg-emerald-500/70'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
                <span className="text-[8px] font-mono text-slate-400 mt-0.5 select-none leading-none">
                  {idx}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
