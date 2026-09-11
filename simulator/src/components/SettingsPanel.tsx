import React, { useEffect, useRef } from 'react';
import { useStore, HARDWARE_PRESETS } from '../store/useStore';
import { Settings, Sliders, BatteryCharging, Zap, Gauge, Layers, Info } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const {
    hardware,
    updateHardware,
    applyPreset,
    trackSettings,
    updateTrackSettings,
    getTheoreticalTopSpeed
  } = useStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleNumChange = (name: keyof typeof hardware, val: number) => {
    updateHardware({ [name]: val });
  };

  const handleTrackChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    updateTrackSettings({ [name]: name === 'type' ? value : parseFloat(value) || 0 });
  };

  const topSpeed = getTheoreticalTopSpeed();
  const totalSensorWidthMm = (hardware.sensorCount - 1) * hardware.sensorSpacing;

  // Draw technical blueprint / layout schematic of the robot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 30;
    const scale = 1.25; // blueprint zoom factor

    ctx.save();
    ctx.translate(cx, cy);

    // Dimension grid & center axes
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(-100, 0); ctx.lineTo(100, 0);
    ctx.moveTo(0, -90); ctx.lineTo(0, 40);
    ctx.stroke();
    ctx.setLineDash([]);

    const wbPx = (hardware.wheelbase / 2) * scale;
    const rPx = hardware.wheelRadius * scale;
    const wPx = Math.max(4, (hardware.wheelWidth / 2) * scale);

    // Left wheel (Top in local space)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-rPx, -wbPx - wPx, rPx * 2, wPx * 2);
    ctx.strokeRect(-rPx, -wbPx - wPx, rPx * 2, wPx * 2);

    // Right wheel (Bottom in local space)
    ctx.fillRect(-rPx, wbPx - wPx, rPx * 2, wPx * 2);
    ctx.strokeRect(-rPx, wbPx - wPx, rPx * 2, wPx * 2);

    // Motor housings
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-rPx + 4, -wbPx + wPx, 22 * scale, 12 * scale);
    ctx.fillRect(-rPx + 4, wbPx - wPx - 12 * scale, 22 * scale, 12 * scale);

    // Chassis body
    ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-22 * scale, -wbPx + 4, 38 * scale, (wbPx - 4) * 2, 6);
    ctx.fill();
    ctx.stroke();

    // Sensor boom & array
    const boomDistPx = hardware.sensorDistance * scale;
    const arrayWidthPx = totalSensorWidthMm * scale;
    
    // Support boom
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(boomDistPx, 0);
    ctx.stroke();

    // Sensor PCB bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(boomDistPx - 2, -arrayWidthPx / 2 - 4, 6, arrayWidthPx + 8);

    // Sensor phototransistor LEDs
    const spacingPx = hardware.sensorSpacing * scale;
    for (let i = 0; i < hardware.sensorCount; i++) {
      const y = -arrayWidthPx / 2 + i * spacingPx;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(boomDistPx + 1, y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Direction arrow
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();

    ctx.restore();
  }, [hardware, totalSensorWidthMm]);

  return (
    <div className="w-[340px] bg-white border-l border-slate-200 flex flex-col h-full text-xs shrink-0 select-none">
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-600" />
          <h2 className="font-bold text-slate-800 text-sm">Компоновка робота</h2>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Preset Selector */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-3 rounded-xl border border-blue-100">
          <div className="flex items-center gap-1.5 mb-2 font-semibold text-blue-900">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Готовые пресеты конфигураций:</span>
          </div>
          <div className="space-y-1.5">
            {HARDWARE_PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(p)}
                className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-600 hover:text-white border border-blue-100 hover:border-blue-600 transition shadow-xs text-slate-800 cursor-pointer group"
              >
                <div className="font-semibold text-[11px] group-hover:text-white">{p.name}</div>
                <div className="text-[10px] text-slate-500 group-hover:text-blue-100 line-clamp-1">{p.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Blueprint Visualizer */}
        <section className="bg-slate-50 border border-slate-200 rounded-xl p-2">
          <div className="flex justify-between items-center px-1 mb-1 text-[11px] font-semibold text-slate-700">
            <span>Чертеж шасси (1:1 масштаб)</span>
            <span className="text-[10px] text-slate-500 font-mono">Ширина сенсоров: {totalSensorWidthMm.toFixed(0)} мм</span>
          </div>
          <div className="flex justify-center bg-white rounded-lg border border-slate-200/80 shadow-xs py-1">
            <canvas ref={canvasRef} width={260} height={180} />
          </div>
        </section>

        {/* Calculated Performance Metrics */}
        <section className="bg-slate-900 text-white p-3 rounded-xl shadow-sm border border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-xs text-blue-400">
            <Gauge className="w-4 h-4" />
            <span>Расчетные параметры динамики</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
              <div className="text-[10px] text-slate-400">Макс. скорость</div>
              <div className="text-sm font-bold font-mono text-cyan-300">{topSpeed.mps.toFixed(2)} м/с</div>
              <div className="text-[10px] text-slate-400 font-mono font-medium">({topSpeed.kmh.toFixed(1)} км/ч)</div>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
              <div className="text-[10px] text-slate-400">Сцепление шин</div>
              <div className="text-sm font-bold font-mono text-emerald-400">{(hardware.tireGrip * 100).toFixed(0)}%</div>
              <div className="text-[10px] text-slate-400 font-mono font-medium">{hardware.wheelWidth} мм ширина</div>
            </div>
          </div>
        </section>

        {/* 1. Chassis & Wheels */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Шасси и колеса</span>
          </div>
          <div className="space-y-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Длина базы (колея между колесами)</span>
                <span className="font-mono font-bold text-blue-600">{hardware.wheelbase} мм</span>
              </div>
              <input
                type="range" min="45" max="140" step="1"
                value={hardware.wheelbase}
                onChange={(e) => handleNumChange('wheelbase', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Радиус колеса (D = {hardware.wheelRadius * 2} мм)</span>
                <span className="font-mono font-bold text-blue-600">{hardware.wheelRadius} мм</span>
              </div>
              <input
                type="range" min="10" max="35" step="1"
                value={hardware.wheelRadius}
                onChange={(e) => handleNumChange('wheelRadius', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Ширина профиля колес (пятно контакта)</span>
                <span className="font-mono font-bold text-blue-600">{hardware.wheelWidth} мм</span>
              </div>
              <input
                type="range" min="5" max="25" step="1"
                value={hardware.wheelWidth}
                onChange={(e) => handleNumChange('wheelWidth', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Коэффициент сцепления резины (Grip)</span>
                <span className="font-mono font-bold text-blue-600">{hardware.tireGrip.toFixed(2)}x</span>
              </div>
              <input
                type="range" min="0.6" max="2.0" step="0.05"
                value={hardware.tireGrip}
                onChange={(e) => handleNumChange('tireGrip', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Масса робота с аккумулятором</span>
                <span className="font-mono font-bold text-blue-600">{hardware.weight} г</span>
              </div>
              <input
                type="range" min="50" max="350" step="5"
                value={hardware.weight}
                onChange={(e) => handleNumChange('weight', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>
        </section>

        {/* 2. Motors & Power */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            <BatteryCharging className="w-3.5 h-3.5 text-blue-600" />
            <span>Двигатели и питание</span>
          </div>
          <div className="space-y-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Обороты мотора (RPM при номинале)</span>
                <span className="font-mono font-bold text-blue-600">{hardware.motorRPM} об/мин</span>
              </div>
              <input
                type="range" min="300" max="3500" step="50"
                value={hardware.motorRPM}
                onChange={(e) => handleNumChange('motorRPM', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-600 mb-1">Батарея (В)</label>
                <select
                  value={hardware.batteryVoltage}
                  onChange={(e) => handleNumChange('batteryVoltage', parseFloat(e.target.value))}
                  className="w-full border border-slate-300 rounded p-1.5 bg-white text-xs font-mono font-semibold"
                >
                  <option value={3.7}>1S LiPo (3.7 В)</option>
                  <option value={7.4}>2S LiPo (7.4 В)</option>
                  <option value={11.1}>3S LiPo (11.1 В)</option>
                  <option value={14.8}>4S LiPo (14.8 В)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-600 mb-1">КПД драйвера (%)</label>
                <input
                  type="number" min="50" max="99" step="1"
                  value={Math.round(hardware.driverEfficiency * 100)}
                  onChange={(e) => handleNumChange('driverEfficiency', (parseFloat(e.target.value) || 80) / 100)}
                  className="w-full border border-slate-300 rounded p-1.5 bg-white text-xs font-mono font-semibold"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Sensor Array */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span>Сенсорная планка</span>
          </div>
          <div className="space-y-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Количество ИК-датчиков</span>
                <span className="font-mono font-bold text-blue-600">{hardware.sensorCount} шт</span>
              </div>
              <div className="flex gap-1.5">
                {[3, 5, 8, 12, 16].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumChange('sensorCount', num)}
                    className={`flex-1 py-1 rounded border text-xs font-semibold cursor-pointer transition ${
                      hardware.sensorCount === num
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Расстояние между датчиками (Pitch)</span>
                <span className="font-mono font-bold text-blue-600">{hardware.sensorSpacing} мм</span>
              </div>
              <input
                type="range" min="4" max="22" step="0.5"
                value={hardware.sensorSpacing}
                onChange={(e) => handleNumChange('sensorSpacing', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Вынос планки вперед (Overhang)</span>
                <span className="font-mono font-bold text-blue-600">{hardware.sensorDistance} мм</span>
              </div>
              <input
                type="range" min="20" max="120" step="1"
                value={hardware.sensorDistance}
                onChange={(e) => handleNumChange('sensorDistance', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Высота сенсоров над полом</span>
                <span className="font-mono font-bold text-blue-600">{hardware.sensorHeight} мм</span>
              </div>
              <input
                type="range" min="1" max="10" step="0.5"
                value={hardware.sensorHeight}
                onChange={(e) => handleNumChange('sensorHeight', parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>
        </section>

        {/* 4. Track Settings */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>Параметры трассы</span>
          </div>
          <div className="space-y-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-1">Тип трассы</label>
              <select
                name="type" value={trackSettings.type} onChange={handleTrackChange}
                className="w-full border border-slate-300 rounded p-1.5 bg-white text-xs font-semibold"
              >
                <option value="infinity">Восьмерка (Infinity)</option>
                <option value="oval">Овал (Oval)</option>
                <option value="sharp">Острые изломы (Sharp 90°)</option>
                <option value="slalom">Слалом (S-образные дуги)</option>
                <option value="hairpin">Шпилька 180° и шикана</option>
              </select>
            </div>
            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>Ширина линии трека</span>
                <span className="font-mono font-bold text-blue-600">{trackSettings.lineWidth} мм</span>
              </div>
              <input
                type="range" name="lineWidth" min="10" max="40" step="1"
                value={trackSettings.lineWidth} onChange={handleTrackChange}
                className="w-full accent-blue-600"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
