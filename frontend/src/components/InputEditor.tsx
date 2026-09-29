import React, { ChangeEvent, useState } from 'react';
import {
  FileEdit,
  Search,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  FileCode2,
} from 'lucide-react';
import { estimateWords, estimateReadTime } from '../utils/formatters';
import { OperationType } from '../types/api';

interface InputEditorProps {
  value: string;
  onChange: (val: string) => void;
  activeOperation: OperationType;
  onAnalyze: () => void;
  onClean: () => void;
  onFormat: () => void;
  onRunFullPipeline: () => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB safe limit
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.markdown', '.tex'];

export function InputEditor({
  value,
  onChange,
  activeOperation,
  onAnalyze,
  onClean,
  onFormat,
  onRunFullPipeline,
}: InputEditorProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const words = estimateWords(value);
  const chars = value.length;
  const readTime = estimateReadTime(words);
  const isBusy = activeOperation !== 'idle';

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (fileError) setFileError(null);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      e.target.value = '';
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      setFileError('Invalid file format. Please upload a plain text or Markdown file (.txt, .md).');
      e.target.value = '';
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) onChange(text);
    };
    reader.onerror = () => {
      setFileError('Failed to read file content.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <FileEdit className="w-3.5 h-3.5 text-indigo-400" />
          <span>Raw Academic Input</span>
        </div>

        {/* Metadata Counter (Zero-Pill Discipline: unboxed text with middle dots) */}
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span>{words} words</span>
          <span aria-hidden="true">·</span>
          <span>{chars} chars</span>
          <span aria-hidden="true">·</span>
          <span>{readTime}</span>
        </div>
      </div>

      {/* File Validation Error Banner */}
      {fileError && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{fileError}</span>
          </div>
          <button
            onClick={() => setFileError(null)}
            className="text-rose-400 hover:text-rose-200 cursor-pointer ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Textarea */}
      <div className="relative flex-1 min-h-[360px]">
        <textarea
          value={value}
          onChange={handleTextChange}
          disabled={isBusy}
          placeholder="Paste unformatted AI text, Markdown, LaTeX math ($E=mc^2$), or academic draft here..."
          className="w-full h-full p-4 bg-slate-950 text-slate-100 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-60 placeholder:text-slate-600"
          spellCheck={false}
        />
      </div>

      {/* Action Toolbar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {/* File Upload Trigger */}
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer transition-colors">
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Load .txt / .md</span>
            <input
              type="file"
              accept=".txt,.md,.markdown"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Pipeline Step Triggers */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Step 2: Analyze */}
          <button
            onClick={onAnalyze}
            disabled={isBusy || !value.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            title="Scan text structure, detect formulas and citations"
          >
            <Search className="w-3.5 h-3.5 text-sky-400" />
            <span>Analyze</span>
          </button>

          {/* Step 3: Clean */}
          <button
            onClick={onClean}
            disabled={isBusy || !value.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            title="Remove conversational AI intros, signoffs, and syntax chatter"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Clean</span>
          </button>

          {/* Step 4: Format */}
          <button
            onClick={onFormat}
            disabled={isBusy || !value.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            title="Construct complete academic AST model"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Format</span>
          </button>

          {/* Run Full Pipeline */}
          <button
            onClick={onRunFullPipeline}
            disabled={isBusy || !value.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            title="Run complete pipeline: Analyze → Clean → Format in one step"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Run Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
}
