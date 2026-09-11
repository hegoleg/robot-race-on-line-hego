import { SettingsPanel } from './components/SettingsPanel';
import { CodeEditorPanel } from './components/CodeEditorPanel';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Bot } from 'lucide-react';

function App() {
  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen overflow-hidden bg-slate-100 font-sans select-none">
        <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md z-10 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Bot className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Line Robot Simulator
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-medium px-2 py-0.5 rounded-full border border-blue-400/30">
                  Ufa-Dynamics Edition
                </span>
              </h1>
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span>Симулятор гонок роботов по линии</span>
          </div>
        </header>
        
        <main className="flex flex-1 overflow-hidden">
          <CodeEditorPanel />
          <SimulationCanvas />
          <SettingsPanel />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
