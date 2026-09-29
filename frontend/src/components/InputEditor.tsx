import React, { ChangeEvent, useState, useRef, DragEvent } from 'react';
import {
  FileEdit,
  Search,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Copy,
  Check,
  Trash2,
  Sigma,
  Quote,
  Heading,
  Table,
  List,
  Upload,
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
  const [copied, setCopied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const words = estimateWords(value);
  const chars = value.length;
  const readTime = estimateReadTime(words);
  const isBusy = activeOperation !== 'idle';

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (fileError) setFileError(null);
  };

  const processFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      setFileError('Invalid file format. Please upload a plain text, Markdown, or LaTeX file (.txt, .md, .tex).');
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
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper to insert markdown/LaTeX syntax at cursor
  const insertSyntax = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);

    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 10);
  };

  return (
    <div
      className={`flex flex-col h-full min-h-[550px] bg-slate-900 border rounded-xl overflow-hidden shadow-sm transition-colors ${
        isDragging ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Utility Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
            <FileEdit className="w-3.5 h-3.5 text-indigo-400" />
            <span>Raw Input</span>
          </div>

          {/* Upload Button */}
          <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer transition-colors ml-1">
            <Upload className="w-3 h-3 text-sky-400" />
            <span>Upload File</span>
            <input
              type="file"
              accept=".txt,.md,.markdown,.tex"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Quick Insert Snippet Controls */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => insertSyntax('$', '$', 'E = mc^2')}
            className="px-1.5 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Insert inline LaTeX math ($...$)"
          >
            $math$
          </button>
          <button
            type="button"
            onClick={() => insertSyntax('\n$$\n', '\n$$\n', 'E = \\sqrt{p^2 c^2 + m_0^2 c^4}')}
            className="px-1.5 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Insert display LaTeX math equation ($$...$$)"
          >
            $$eq$$
          </button>
          <button
            type="button"
            onClick={() => insertSyntax('[', ']', '1')}
            className="px-1.5 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Insert citation tag ([1])"
          >
            [cite]
          </button>
          <button
            type="button"
            onClick={() => insertSyntax('\n## ', '\n', 'Section Title')}
            className="px-1.5 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Insert heading (##)"
          >
            ## H2
          </button>
          <button
            type="button"
            onClick={() => insertSyntax('\n| Header 1 | Header 2 |\n|:---|:---|\n| Data 1 | Data 2 |\n')}
            className="px-1.5 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Insert table snippet"
          >
            | Table |
          </button>
        </div>

        {/* Copy & Metrics */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!value}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
            title="Copy raw text to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <span className="text-slate-700" aria-hidden="true">·</span>

          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <span>{words}w</span>
            <span aria-hidden="true">·</span>
            <span>{chars}c</span>
          </div>
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

      {/* Main Textarea Area */}
      <div className="relative flex-1 min-h-[360px] flex flex-col">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextChange}
          disabled={isBusy}
          placeholder="Paste raw unformatted AI text, Markdown, LaTeX math ($E=mc^2$), tables, or draft here... Or drag and drop a .txt/.md file onto this panel."
          className="flex-1 w-full p-4 bg-slate-950 text-slate-100 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-60 placeholder:text-slate-600"
          spellCheck={false}
        />

        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-indigo-950/85 backdrop-blur-xs border-2 border-dashed border-indigo-400 rounded flex flex-col items-center justify-center pointer-events-none z-10 text-indigo-200 gap-2">
            <Upload className="w-8 h-8 animate-bounce text-indigo-400" />
            <span className="text-sm font-semibold">Drop file to load (.txt, .md, .tex)</span>
          </div>
        )}
      </div>

      {/* Action Toolbar Bottom */}
      <div className="p-2.5 sm:p-3 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
          Drop files directly · Markdown & LaTeX supported
        </div>

        {/* Pipeline Step Triggers */}
        <div className="flex items-center flex-wrap gap-1.5 ml-auto">
          {/* Analyze */}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isBusy || !value.trim()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            title="Scan text structure, detect formulas and citations"
          >
            <Search className="w-3.5 h-3.5 text-sky-400" />
            <span>Analyze</span>
          </button>

          {/* Clean */}
          <button
            type="button"
            onClick={onClean}
            disabled={isBusy || !value.trim()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            title="Remove conversational AI intros, signoffs, and syntax chatter"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Clean</span>
          </button>

          {/* Format */}
          <button
            type="button"
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
            type="button"
            onClick={onRunFullPipeline}
            disabled={isBusy || !value.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm transition-all disabled:opacity-50 cursor-pointer"
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
