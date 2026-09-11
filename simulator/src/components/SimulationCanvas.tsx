import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { engine, PIXELS_PER_METER } from '../engine/RobotEngine';
import { Play, Square, RotateCcw, Crosshair, Trophy, Activity } from 'lucide-react';

export const SimulationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  const {
    hardware,
    simState,
    code,
    trackSettings,
    updateSimState,
    toggleSim,
    resetSim
  } = useStore();

  const simStateRef = useRef(simState);
  simStateRef.current = simState;

  const hardwareRef = useRef(hardware);
  hardwareRef.current = hardware;

  const codeRef = useRef(code);
  codeRef.current = code;

  const trackSettingsRef = useRef(trackSettings);
  trackSettingsRef.current = trackSettings;

  // Redraw track when trackSettings change
  useEffect(() => {
    const trackCanvas = trackCanvasRef.current;
    if (trackCanvas) {
      const ctx = trackCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        engine.drawTrack(ctx, trackSettingsRef.current);
      }
    }
  }, [trackSettings]);

  const drawRobot = (
    ctx: CanvasRenderingContext2D,
    state: typeof simStateRef.current,
    h: typeof hardwareRef.current
  ) => {
    // 1. Draw trajectory breadcrumbs
    if (state.trail && state.trail.length > 1) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(state.trail[0].x, state.trail[0].y);
      for (let i = 1; i < state.trail.length; i++) {
        ctx.lineTo(state.trail[i].x, state.trail[i].y);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(state.robotX, state.robotY);
    ctx.rotate(state.robotAngle);

    const scale = PIXELS_PER_METER / 1000; // mm to pixels conversion (~0.7 to 1.4 px/mm)
    const wbPx = (h.wheelbase / 2) * scale;
    const rPx = h.wheelRadius * scale;
    const wPx = Math.max(3, (h.wheelWidth / 2) * scale);

    // Chassis body
    ctx.fillStyle = 'rgba(30, 58, 138, 0.85)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-rPx * 1.2, -wbPx + 3, rPx * 2.2, (wbPx - 3) * 2, 4);
    ctx.fill();
    ctx.stroke();

    // Wheels (with width visualization)
    ctx.fillStyle = '#0f172a';
    // Left wheel
    ctx.fillRect(-rPx, -wbPx - wPx, rPx * 2, wPx * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(-rPx, -wbPx - wPx, rPx * 2, wPx * 2);

    // Right wheel
    ctx.fillRect(-rPx, wbPx - wPx, rPx * 2, wPx * 2);
    ctx.strokeRect(-rPx, wbPx - wPx, rPx * 2, wPx * 2);

    // Wheel rims
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-rPx / 2, -wbPx - 1, rPx, 2);
    ctx.fillRect(-rPx / 2, wbPx - 1, rPx, 2);

    // Sensor boom bar
    const boomDistPx = h.sensorDistance * scale;
    const spacingPx = h.sensorSpacing * scale;
    const totalSensorWidthPx = (h.sensorCount - 1) * spacingPx;
    const startOffsetPx = -totalSensorWidthPx / 2;

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rPx, 0);
    ctx.lineTo(boomDistPx, 0);
    ctx.stroke();

    // Sensor PCB bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(boomDistPx - 2, startOffsetPx - 3, 4, totalSensorWidthPx + 6);

    // Sensor LEDs with active line glow
    const sensors = engine.readSensors(state, h);

    for (let i = 0; i < h.sensorCount; i++) {
      const latOffset = startOffsetPx + i * spacingPx;
      ctx.beginPath();
      ctx.arc(boomDistPx, latOffset, 3.5, 0, 2 * Math.PI);

      const val = sensors[i] || 0;
      if (val > 0.4) {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = '#10b981';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Heading direction pointer
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(18, -4);
    ctx.lineTo(18, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const update = (time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = time;

    if (simStateRef.current.isRunning) {
      const newState = engine.update(
        simStateRef.current,
        hardwareRef.current,
        codeRef.current,
        dt
      );
      updateSimState(newState);
    }

    const canvas = canvasRef.current;
    const trackCanvas = trackCanvasRef.current;
    if (canvas && trackCanvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(trackCanvas, 0, 0);
        drawRobot(ctx, simStateRef.current, hardwareRef.current);
      }
    }

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setIsDragging(true);
    updateSimState({
      robotX: coords.x,
      robotY: coords.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const coords = getCanvasCoords(e);
    const dx = coords.x - simState.robotX;
    const dy = coords.y - simState.robotY;
    if (Math.hypot(dx, dy) > 8) {
      const angle = Math.atan2(dy, dx);
      updateSimState({ robotAngle: angle });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const speedKmh = Math.abs(simState.linearVelocity * 3.6);

  return (
    <div className="flex-1 flex flex-col bg-slate-100 p-3 overflow-hidden select-none">
      {/* Top Controls Toolbar */}
      <div className="mb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            Трасса тестирования
            <span className="text-[11px] font-normal text-slate-500 hidden sm:flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5" /> (кликните для перемещения, потяните для поворота)
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleSim}
            className={`flex items-center gap-2 px-4 py-1.5 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-xs ${
              simState.isRunning 
                ? 'bg-amber-600 hover:bg-amber-700' 
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {simState.isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {simState.isRunning ? 'Пауза' : 'Старт заезда'}
          </button>
          
          <button 
            onClick={() => resetSim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сброс
          </button>
        </div>
      </div>
      
      {/* Simulation Arena Box */}
      <div className="flex-1 relative rounded-xl border border-slate-300/80 shadow-inner bg-slate-200/80 overflow-hidden flex items-center justify-center p-2">
        <canvas 
          ref={trackCanvasRef}
          width={trackSettings.width} 
          height={trackSettings.height}
          className="hidden"
        />
        <canvas 
          ref={canvasRef}
          width={trackSettings.width} 
          height={trackSettings.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="bg-white shadow-xl rounded-lg cursor-crosshair border border-slate-200"
          style={{ width: `${trackSettings.width}px`, height: `${trackSettings.height}px`, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
        
        {/* Real-time Telemetry & Lap Timing HUD */}
        <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur-md text-white p-3 rounded-xl text-xs font-mono shadow-xl border border-slate-700/60 min-w-[210px] space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Телеметрия заезда
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Кругов: {simState.lapCount}
            </span>
          </div>

          {/* Speed & Dynamics */}
          <div className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-[11px]">Скорость:</span>
              <span className="text-base font-bold text-cyan-300">
                {speedKmh.toFixed(1)} <span className="text-[10px] text-slate-400">км/ч</span>
                <span className="text-xs text-slate-400 font-normal ml-1">({simState.linearVelocity.toFixed(2)} м/с)</span>
              </span>
            </div>

            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">ШИМ L / R:</span>
              <span className="font-semibold text-slate-200">
                <span className={simState.leftMotorSpeed >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {(simState.leftMotorSpeed * 100).toFixed(0)}%
                </span>
                {' / '}
                <span className={simState.rightMotorSpeed >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {(simState.rightMotorSpeed * 100).toFixed(0)}%
                </span>
              </span>
            </div>
          </div>

          {/* Lap Times */}
          <div className="border-t border-slate-800 pt-1.5 space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                ⏱️ Текущий круг:
              </span>
              <span className="font-bold text-amber-300">
                {simState.currentLapTime.toFixed(2)} с
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                Лучший круг:
              </span>
              <span className="font-bold text-yellow-300">
                {simState.bestLapTime ? `${simState.bestLapTime.toFixed(2)} с` : '—'}
              </span>
            </div>
          </div>

          {/* Quality metric */}
          <div className="border-t border-slate-800 pt-1 flex justify-between text-[10px] text-slate-400">
            <span>Удержание линии:</span>
            <span className={simState.onLinePercentage > 85 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {simState.onLinePercentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
