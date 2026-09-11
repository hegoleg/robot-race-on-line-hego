import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Activity, X } from 'lucide-react';

export const Oscilloscope: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { simState, toggleOscilloscope } = useStore();
  const history = simState.telemetryHistory || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    // Horizontal grid
    for (let y = 20; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical grid
    for (let x = 40; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Zero-error center line
    const zeroY = height / 2;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();

    if (history.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Сбор данных телеметрии... (запустите заезд)', width / 2, height / 2);
      return;
    }

    const n = history.length;
    const stepX = width / Math.max(n - 1, 1);

    // 1. Plot Error trace (amber/yellow) -> scaled so [-1, 1] maps to [height - 10, 10]
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const pt = history[i];
      const x = i * stepX;
      const clampedErr = Math.max(-1.5, Math.min(1.5, pt.error));
      const y = zeroY - clampedErr * (height * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Plot Speed trace (cyan) -> 0 to 15 km/h
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const maxSpeedGraph = 15; // km/h
    for (let i = 0; i < n; i++) {
      const pt = history[i];
      const x = i * stepX;
      const speedNorm = Math.min(1.0, Math.max(0, pt.speed / maxSpeedGraph));
      const y = (height - 15) - speedNorm * (height - 30);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Plot Left PWM (emerald) & Right PWM (rose) differential
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const pt = history[i];
      const x = i * stepX;
      const pwmNorm = Math.max(-1, Math.min(1, pt.leftPWM / 100));
      const y = zeroY - pwmNorm * (height * 0.35);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const pt = history[i];
      const x = i * stepX;
      const pwmNorm = Math.max(-1, Math.min(1, pt.rightPWM / 100));
      const y = zeroY - pwmNorm * (height * 0.35);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Current latest point highlight
    const lastPt = history[n - 1];
    const lastX = (n - 1) * stepX;
    const lastErrY = zeroY - Math.max(-1.5, Math.min(1.5, lastPt.error)) * (height * 0.4);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(lastX, lastErrY, 3.5, 0, 2 * Math.PI);
    ctx.fill();

  }, [history]);

  const lastPt = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 shrink-0 mt-2 text-white">
      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
        <div className="flex items-center gap-3">
          <span className="font-bold flex items-center gap-1.5 text-blue-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Осциллограф PID & Динамика
          </span>
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Ошибка: {lastPt ? lastPt.error.toFixed(2) : '0.00'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              Скорость: {lastPt ? `${lastPt.speed.toFixed(1)} км/ч` : '0.0 км/ч'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              PWM L: {lastPt ? `${lastPt.leftPWM.toFixed(0)}%` : '0%'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              PWM R: {lastPt ? `${lastPt.rightPWM.toFixed(0)}%` : '0%'}
            </span>
          </div>
        </div>
        <button
          onClick={toggleOscilloscope}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
          title="Скрыть осциллограф"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative w-full h-24 bg-[#090d16] rounded-lg overflow-hidden border border-slate-800">
        <canvas
          ref={canvasRef}
          width={760}
          height={96}
          className="w-full h-full block"
        />
        <div className="absolute top-1 left-2 text-[9px] font-mono text-slate-500 pointer-events-none">
          +Error
        </div>
        <div className="absolute bottom-1 left-2 text-[9px] font-mono text-slate-500 pointer-events-none">
          -Error
        </div>
        <div className="absolute top-1 right-2 text-[9px] font-mono text-cyan-400/70 pointer-events-none">
          15 км/ч
        </div>
      </div>
    </div>
  );
};
