import React from 'react';
import {
  X,
  Keyboard,
  Zap,
  BookOpen,
  FileSpreadsheet,
  FileDown,
  Sparkles,
  Command,
  Info,
} from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { key: `${modKey} + Enter`, description: 'Run Full Pipeline (Analyze → Clean → Format)' },
    { key: `${modKey} + Shift + F`, description: 'Format document into Academic AST' },
    { key: `${modKey} + Shift + E`, description: 'Quick export Microsoft Word DOCX' },
    { key: `${modKey} + Shift + P`, description: 'Quick export ReportLab PDF' },
    { key: `${modKey} + Shift + C`, description: 'Clean conversational AI chatter' },
    { key: `${modKey} + /`, description: 'Open this help & shortcuts guide' },
  ];

  const presets = [
    { name: 'Academic Standard', details: 'Times New Roman 12pt, double spacing, 1-inch margins, APA/MLA reference standards.' },
    { name: 'Research Paper', details: 'Compact 1.15x spacing, Helvetica typography, balanced two-tier headings, IEEE citations.' },
    { name: 'Exam Paper', details: 'Bold question stems, bordered mark distribution tables, answer fill-in lines.' },
    { name: 'Study Notes', details: 'Callout summary blocks, indented bullet takeaways, concept definitions.' },
    { name: 'Textbook Chapter', details: 'Georgia serif, wide reading margins, formula callouts, and chapter headnotes.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2.5 text-slate-100 font-semibold text-sm">
            <Keyboard className="w-4 h-4 text-indigo-400" />
            <span>FormatAI Quick Guide & Productivity Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 flex flex-col gap-6 text-xs text-slate-300">
          {/* Quick Guide Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>How the Academic Formatting Pipeline Works</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              FormatAI transforms raw text or messy AI output (ChatGPT, Claude, Gemini) into publication-ready academic manuscripts. It strips conversational chatter, standardizes LaTeX math formulas (<code className="text-indigo-300">$...$</code> and <code className="text-indigo-300">$$...$$</code>), structures markdown tables, indexes citations, and compiles directly into downloadable Microsoft Word (<code className="text-sky-300">.docx</code>) and PDF (<code className="text-rose-300">.pdf</code>) documents.
            </p>
          </div>

          {/* Keyboard Shortcuts Table */}
          <div className="flex flex-col gap-2.5">
            <h3 className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
              <Command className="w-3.5 h-3.5 text-indigo-400" />
              <span>Keyboard Shortcuts</span>
            </h3>
            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
              {shortcuts.map((sc, i) => (
                <div key={i} className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/40 hover:bg-slate-950/70 transition-colors">
                  <span className="text-slate-300">{sc.description}</span>
                  <kbd className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono font-semibold text-indigo-300 shadow-xs">
                    {sc.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Document Presets Guide */}
          <div className="flex flex-col gap-2.5">
            <h3 className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Typesetting Presets Overview</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presets.map((p, i) => (
                <div key={i} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex flex-col gap-1">
                  <div className="font-semibold text-indigo-200">{p.name}</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">{p.details}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
