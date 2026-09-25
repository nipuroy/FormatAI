import { useState } from 'react';
import {
  FileText,
  Sparkles,
  RefreshCw,
  Server,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { BackendConnectionState } from '../hooks/useBackendHealth';
import { SAMPLE_DOCUMENTS } from '../utils/sampleDocuments';

interface HeaderProps {
  connectionState: BackendConnectionState;
  latencyMs: number | null;
  onRefreshHealth: () => void;
  onOpenAISettings: () => void;
  onSelectSample: (sampleId: string) => void;
  onClear: () => void;
  activeOperation: string;
}

export function Header({
  connectionState,
  latencyMs,
  onRefreshHealth,
  onOpenAISettings,
  onSelectSample,
  onClear,
  activeOperation,
}: HeaderProps) {
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-100 shadow-sm">
            <FileText className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">FormatAI</h1>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                v0.1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              AI-Powered Academic Document Formatting Engine · Python FastAPI Backend
            </p>
          </div>
        </div>

        {/* Action Controls & Backend Status */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Sample Picker Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSampleMenuOpen(!sampleMenuOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
              title="Load pre-built academic sample documents"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load Sample</span>
            </button>

            {sampleMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1.5 z-40"
                onMouseLeave={() => setSampleMenuOpen(false)}
              >
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Academic Examples
                </div>
                {SAMPLE_DOCUMENTS.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      onSelectSample(doc.id);
                      setSampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex flex-col gap-0.5 cursor-pointer"
                  >
                    <span className="font-medium text-slate-100">{doc.title}</span>
                    <span className="text-[11px] text-slate-400">{doc.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Settings Modal Button */}
          <button
            onClick={onOpenAISettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
            title="Configure AI provider and model settings"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Settings</span>
          </button>

          {/* Clear Editor */}
          <button
            onClick={onClear}
            disabled={activeOperation !== 'idle'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            title="Clear current text and output"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          {/* Backend Health & Latency Indicator */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                  : connectionState === 'checking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="hidden sm:inline">
              {connectionState === 'connected'
                ? `FastAPI ${latencyMs !== null ? `(${latencyMs}ms)` : ''}`
                : connectionState === 'checking'
                ? 'Connecting...'
                : 'Backend Offline'}
            </span>
            <button
              onClick={onRefreshHealth}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              title="Ping Python backend"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
