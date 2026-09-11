import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStore, CODE_TEMPLATES } from '../store/useStore';
import { arduinoEnv } from '../engine/ArduinoTranspiler';
import { Code2, Terminal, BookOpen, CheckCircle2, AlertCircle, FileCode } from 'lucide-react';

export const CodeEditorPanel: React.FC = () => {
  const { code, setCode, hardware } = useStore();
  const [useMonaco, setUseMonaco] = useState(true);
  const [showDocs, setShowDocs] = useState(false);

  const compileError = arduinoEnv.getCompileError();
  const runtimeError = arduinoEnv.getRuntimeError();

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tpl = CODE_TEMPLATES.find(t => t.name === e.target.value);
    if (tpl) {
      setCode(tpl.code);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-[340px] max-w-[550px] border-r border-slate-800 bg-slate-950 text-white select-none">
      {/* Header & Mode Bar */}
      <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-blue-600/20 text-blue-400 rounded border border-blue-500/30">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-200">Код Arduino (C++)</div>
            <div className="text-[10px] text-slate-400 font-mono">ESP32 / AVR Core 3.x</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowDocs(!showDocs)}
            className={`text-[11px] px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer ${
              showDocs ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Справочник функций Arduino"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Справка
          </button>
          
          <button
            onClick={() => setUseMonaco(!useMonaco)}
            className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1 cursor-pointer"
            title="Переключить движок редактора"
          >
            <Terminal className="w-3.5 h-3.5" />
            {useMonaco ? 'Monaco' : 'Простой'}
          </button>
        </div>
      </div>

      {/* Template Selector Bar */}
      <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2 text-xs">
        <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-slate-400 text-[11px] shrink-0">Шаблон:</span>
        <select
          onChange={handleTemplateChange}
          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
          defaultValue=""
        >
          <option value="" disabled>Выберите готовый алгоритм...</option>
          {CODE_TEMPLATES.map((t, idx) => (
            <option key={idx} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* API Reference Dropdown Sheet */}
      {showDocs && (
        <div className="bg-slate-900 border-b border-slate-700 p-3 text-[11px] space-y-2 max-h-56 overflow-y-auto text-slate-300 shadow-inner">
          <div className="font-bold text-xs text-blue-400 mb-1">Доступные функции и константы Arduino:</div>
          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-amber-400">readLineBlack(sensorValues)</span>: возвращает позицию линии от <span className="text-cyan-300">0</span> до <span className="text-cyan-300">{(hardware.sensorCount - 1) * 1000}</span> (центр = <span className="text-emerald-400">{(hardware.sensorCount - 1) * 500}</span>).
            </div>
            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-amber-400">setMotors(left, right)</span>: скорость моторов от <span className="text-cyan-300">-255</span> до <span className="text-cyan-300">+255</span> (или -1.0 .. +1.0).
            </div>
            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-amber-400">constrain(val, min, max)</span>, <span className="text-amber-400">map(x, in_min, in_max, out_min, out_max)</span>, <span className="text-amber-400">abs(x)</span>.
            </div>
            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-amber-400">SENSOR_COUNT</span>: текущее количество датчиков (<span className="text-cyan-300">{hardware.sensorCount}</span> шт).
            </div>
            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-amber-400">millis()</span>, <span className="text-amber-400">Serial.println(msg)</span>.
            </div>
          </div>
        </div>
      )}

      {/* Editor Main Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
        {useMonaco ? (
          <Editor
            height="100%"
            defaultLanguage="cpp"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || '')}
            loading={
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Загрузка редактора C++...
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: 12.5,
              wordWrap: 'on',
              lineNumbers: 'on',
              tabSize: 2,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        ) : (
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="w-full h-full p-3 font-mono text-xs bg-slate-950 text-slate-200 resize-none outline-none leading-relaxed border-0"
          />
        )}
      </div>

      {/* Compiler / Runtime Status Footer */}
      <div className="p-2 border-t border-slate-800 bg-slate-950 shrink-0 text-xs flex flex-col gap-1 font-mono">
        {compileError ? (
          <div className="flex items-start gap-1.5 text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-800/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-tight line-clamp-2">Ошибка компиляции: {compileError}</span>
          </div>
        ) : runtimeError ? (
          <div className="flex items-start gap-1.5 text-amber-400 bg-amber-950/40 p-1.5 rounded border border-amber-800/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-tight line-clamp-2">Ошибка loop(): {runtimeError}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>C++ код готов к исполнению</span>
            </div>
            <div className="text-slate-500">
              Сенсоров: {hardware.sensorCount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
