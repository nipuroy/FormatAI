import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Sparkles,
  RefreshCw,
  Trash2,
  BookOpen,
  Shield,
  Zap,
  Columns,
  Maximize2,
  Download,
  FileSpreadsheet,
  FileDown,
  CheckCircle2,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
  HelpCircle,
  MoreVertical,
} from 'lucide-react';
import { BackendConnectionState } from '../hooks/useBackendHealth';
import { SAMPLE_DOCUMENTS } from '../utils/sampleDocuments';
import { OperationType } from '../types/api';
import { LastExportInfo } from '../hooks/useDocumentPipeline';
import { formatBytes } from '../utils/formatters';

interface HeaderProps {
  connectionState: BackendConnectionState;
  latencyMs: number | null;
  onRefreshHealth: () => void;
  onOpenAISettings: () => void;
  onOpenUserSettings: () => void;
  onOpenSkills?: () => void;
  onOpenShortcuts?: () => void;
  onSelectSample: (sampleId: string) => void;
  onClear: () => void;
  activeOperation: OperationType | string;
  viewMode?: 'split' | 'editor' | 'preview';
  onViewModeChange?: (mode: 'split' | 'editor' | 'preview') => void;
  onRunPipeline?: () => void;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
  hasContent?: boolean;
  enabledSkillsCount?: number;
  lastExport?: LastExportInfo | null;
  onToggleFormattingDrawer?: () => void;
}

export function Header({
  connectionState,
  latencyMs,
  onRefreshHealth,
  onOpenAISettings,
  onOpenUserSettings,
  onOpenSkills,
  onOpenShortcuts,
  onSelectSample,
  onClear,
  activeOperation,
  viewMode = 'split',
  onViewModeChange,
  onRunPipeline,
  onExportDocx,
  onExportPdf,
  hasContent = false,
  enabledSkillsCount = 10,
  lastExport,
  onToggleFormattingDrawer,
}: HeaderProps) {
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sampleRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isBusy = activeOperation !== 'idle';
  const isExportingDocx = activeOperation === 'exporting_docx';
  const isExportingPdf = activeOperation === 'exporting_pdf';

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sampleRef.current && !sampleRef.current.contains(e.target as Node)) {
        setSampleMenuOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        {/* Zone 1: Single text element wordmark + clean health indicator */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/70 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <a
              href="/"
              className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-indigo-200 transition-colors flex items-center gap-1.5"
            >
              <span>FormatAI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            </a>
          </div>

          {/* Backend Connection Indicator (Discrete, unboxed text with status dot) */}
          <button
            onClick={onRefreshHealth}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer touch-manipulation"
            title="Click to re-verify FastAPI connection"
          >
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                connectionState === 'connected'
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                  : connectionState === 'checking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-mono text-[10px] sm:text-[11px]">
              {connectionState === 'connected'
                ? `Active${latencyMs !== null ? ` · ${latencyMs}ms` : ''}`
                : connectionState === 'checking'
                ? 'Connecting...'
                : 'Offline'}
            </span>
            <RefreshCw
              className={`w-3 h-3 text-slate-500 hover:text-slate-300 ${
                connectionState === 'checking' ? 'animate-spin' : ''
              }`}
            />
          </button>
        </div>

        {/* Zone 2: Viewport Mode Switcher & Quick Navigation (Desktop) */}
        <div className="hidden lg:flex items-center gap-1 p-0.5 bg-slate-950/70 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => onViewModeChange?.('split')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              viewMode === 'split'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Side-by-side Editor and Academic Preview"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split View</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange?.('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              viewMode === 'editor'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Focus purely on writing and raw LaTeX"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Editor Focus</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange?.('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              viewMode === 'preview'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Full page academic publication preview"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Paper Preview</span>
          </button>
        </div>

        {/* Zone 3: Primary Actions & Utility Group */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sample Picker Dropdown (Tablet & Desktop) */}
          <div className="relative hidden md:block" ref={sampleRef}>
            <button
              onClick={() => setSampleMenuOpen(!sampleMenuOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors cursor-pointer touch-manipulation"
              title="Load pre-built academic sample documents"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Samples</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {sampleMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Pre-Built Academic Manuscripts
                </div>
                {SAMPLE_DOCUMENTS.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      onSelectSample(doc.id);
                      setSampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 hover:text-white flex flex-col gap-0.5 cursor-pointer border-b border-slate-800/50 last:border-b-0"
                  >
                    <span className="font-medium text-slate-100">{doc.title}</span>
                    <span className="text-[11px] text-slate-400">{doc.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick 1-Click Export Center Dropdown */}
          {(onExportDocx || onExportPdf) && (
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={isBusy || !hasContent}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors disabled:opacity-50 cursor-pointer touch-manipulation"
                title="Download document as Word DOCX or PDF"
              >
                {isExportingDocx || isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span className="hidden xs:inline">Export</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1.5 z-50 flex flex-col gap-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
                    Export Formatted Publication
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onExportDocx?.();
                      setExportMenuOpen(false);
                    }}
                    disabled={isBusy || !hasContent}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-md transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-medium text-slate-100">Microsoft Word</div>
                        <div className="text-[10px] text-slate-400">.docx with equations & styles</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onExportPdf?.();
                      setExportMenuOpen(false);
                    }}
                    disabled={isBusy || !hasContent}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-md transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <div className="font-medium text-slate-100">PDF Document</div>
                        <div className="text-[10px] text-slate-400">ReportLab compiled print PDF</div>
                      </div>
                    </div>
                  </button>

                  {lastExport && (
                    <div className="mt-1 pt-1.5 border-t border-slate-800 px-2 py-1 text-[10px] text-slate-400 flex items-center justify-between">
                      <span className="truncate max-w-[120px] font-mono text-emerald-400">
                        {lastExport.filename}
                      </span>
                      <span>{formatBytes(lastExport.sizeBytes)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Primary CTA: Run Full Pipeline */}
          {onRunPipeline && (
            <button
              onClick={onRunPipeline}
              disabled={isBusy || !hasContent}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap touch-manipulation"
              title="Run complete pipeline: Analyze → Clean → Format in one step (Ctrl+Enter)"
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 fill-current text-indigo-200" />
              )}
              <span>Run Pipeline</span>
            </button>
          )}

          {/* Desktop Utility Tools Group */}
          <div className="hidden md:flex items-center gap-1 pl-1 border-l border-slate-800">
            {/* Skills Modal Button with badge */}
            {onOpenSkills && (
              <button
                onClick={onOpenSkills}
                className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-md transition-colors relative cursor-pointer"
                title={`Configure modular document skills (${enabledSkillsCount} active)`}
              >
                <Zap className="w-4 h-4" />
                {enabledSkillsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500/90 text-[9px] font-mono font-bold text-slate-950 rounded-full flex items-center justify-center">
                    {enabledSkillsCount}
                  </span>
                )}
              </button>
            )}

            {/* AI Settings Modal Button */}
            <button
              onClick={onOpenAISettings}
              className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              title="Configure AI provider and prompt settings"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* User Settings & Privacy Isolation Button */}
            <button
              onClick={onOpenUserSettings}
              className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              title="Client-local preferences, security model, and isolation status"
            >
              <Shield className="w-4 h-4" />
            </button>

            {/* Shortcuts & Quick Guide Button */}
            {onOpenShortcuts && (
              <button
                onClick={onOpenShortcuts}
                className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="Keyboard shortcuts & formatting guide (Ctrl+/)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            {/* Clear Editor */}
            <button
              onClick={onClear}
              disabled={isBusy}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
              title="Clear current editor text and formatted document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Overflow Menu Button (Smartphones < md) */}
          <div className="relative md:hidden" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer touch-manipulation"
              title="More options and settings"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {mobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 text-xs">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                  Actions & Settings
                </div>

                {/* Samples Option */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSampleMenuOpen(true);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-slate-200 hover:bg-slate-800 rounded-md text-left cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Load Sample Draft</span>
                </button>

                {/* Skills Option */}
                {onOpenSkills && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSkills();
                    }}
                    className="flex items-center justify-between px-2.5 py-2 text-slate-200 hover:bg-slate-800 rounded-md text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>Modular Skills</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                      {enabledSkillsCount}
                    </span>
                  </button>
                )}

                {/* AI Settings Option */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAISettings();
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-slate-200 hover:bg-slate-800 rounded-md text-left cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>AI Assistance & Model</span>
                </button>

                {/* Privacy Option */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenUserSettings();
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-slate-200 hover:bg-slate-800 rounded-md text-left cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>Settings & Privacy</span>
                </button>

                {/* Shortcuts & Guide Option */}
                {onOpenShortcuts && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenShortcuts();
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-slate-200 hover:bg-slate-800 rounded-md text-left cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-sky-400" />
                    <span>Guide & Shortcuts</span>
                  </button>
                )}

                {/* Clear Option */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onClear();
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-rose-300 hover:bg-rose-950/40 rounded-md text-left cursor-pointer border-t border-slate-800/80 mt-1"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Clear Editor</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
