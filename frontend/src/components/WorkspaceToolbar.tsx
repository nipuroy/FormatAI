import React, { useState, useRef, useEffect } from 'react';
import {
  Heading,
  LayoutTemplate,
  Bookmark,
  Hash,
  Type,
  Search,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  FileText,
  Clock,
  BookOpen,
  Sigma,
  Quote,
  SlidersHorizontal,
  Info,
  HelpCircle,
} from 'lucide-react';
import { CitationStyle, DocxPreset, AcademicDocument } from '../types/document';
import { OperationType, ContentAnalysisResponse } from '../types/api';

interface WorkspaceToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  preset: DocxPreset;
  onPresetChange: (preset: DocxPreset) => void;
  citationStyle: CitationStyle;
  onCitationStyleChange: (style: CitationStyle) => void;
  includePageNumbers: boolean;
  onTogglePageNumbers: (val: boolean) => void;
  includeHeader: boolean;
  onToggleHeader: (val: boolean) => void;
  activeOperation: OperationType;
  onAnalyze: () => void;
  onClean: () => void;
  onFormat: () => void;
  hasContent: boolean;
  document: AcademicDocument | null;
  analysis: ContentAnalysisResponse | null;
  rawText: string;
  onOpenDetailsModal?: () => void;
  onOpenShortcuts?: () => void;
}

const PRESET_OPTIONS: { id: DocxPreset; label: string; shortDesc: string }[] = [
  { id: 'academic', label: 'Academic Standard', shortDesc: 'Times 12pt · Double Spaced · APA/MLA' },
  { id: 'research_paper', label: 'Research Paper', shortDesc: 'Helvetica · Compact 1.15x' },
  { id: 'exam', label: 'Exam Paper', shortDesc: 'Clear Question Boundaries' },
  { id: 'study_notes', label: 'Study Notes', shortDesc: 'Indented Key Takeaways' },
  { id: 'textbook', label: 'Textbook Chapter', shortDesc: 'Georgia Serif · Editorial Margins' },
];

const CITATION_OPTIONS: { id: CitationStyle; label: string }[] = [
  { id: 'apa', label: 'APA 7th' },
  { id: 'ieee', label: 'IEEE [1]' },
  { id: 'mla', label: 'MLA 9th' },
  { id: 'harvard', label: 'Harvard' },
  { id: 'chicago', label: 'Chicago' },
];

export function WorkspaceToolbar({
  title,
  onTitleChange,
  preset,
  onPresetChange,
  citationStyle,
  onCitationStyleChange,
  includePageNumbers,
  onTogglePageNumbers,
  includeHeader,
  onToggleHeader,
  activeOperation,
  onAnalyze,
  onClean,
  onFormat,
  hasContent,
  document,
  analysis,
  rawText,
  onOpenDetailsModal,
  onOpenShortcuts,
}: WorkspaceToolbarProps) {
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  const isBusy = activeOperation !== 'idle';
  const activePresetItem = PRESET_OPTIONS.find((p) => p.id === preset) || PRESET_OPTIONS[0];

  // Derive document metrics
  const words = document?.statistics.word_count ?? analysis?.word_count ?? (rawText ? rawText.trim().split(/\s+/).length : 0);
  const chars = document?.statistics.character_count ?? analysis?.char_count ?? rawText.length;
  const pages = document?.statistics.estimated_pages ?? Math.max(1, Math.ceil(words / 500));
  const readTime = document?.statistics.estimated_read_time_minutes ?? analysis?.estimated_read_time_minutes ?? Math.max(1, Math.ceil(words / 220));
  const mathCount = document?.metadata.detected_math_expressions?.length ?? analysis?.detected_math_count ?? 0;
  const citationsCount = document?.metadata.detected_citations?.length ?? analysis?.detected_citations_count ?? 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) {
        setPresetDropdownOpen(false);
      }
    };
    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 shadow-sm flex flex-col gap-2.5">
      {/* Top Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Document Title Input */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 shrink-0">
            <Heading className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Autodetected from first heading if empty..."
              className="w-full bg-slate-950/60 hover:bg-slate-950 focus:bg-slate-950 text-xs font-medium text-slate-100 placeholder:text-slate-500 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-800 focus:border-indigo-500/60 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Center: Style Preset & Citation Selectors */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {/* Preset Selector Dropdown */}
          <div className="relative" ref={presetRef}>
            <button
              type="button"
              onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-200 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer touch-manipulation"
              title="Select document styling preset"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="whitespace-nowrap">{activePresetItem.label}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {presetDropdownOpen && (
              <div className="absolute left-0 lg:right-0 lg:left-auto mt-1 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 border-b border-slate-800 mb-1">
                  Manuscript Typesetting Presets
                </div>
                {PRESET_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onPresetChange(item.id);
                      setPresetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 text-xs rounded-lg transition-colors flex flex-col gap-0.5 cursor-pointer ${
                      preset === item.id
                        ? 'bg-indigo-950/80 text-indigo-200 font-semibold border border-indigo-500/40'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="text-[10px] text-slate-400">{item.shortDesc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Citation Style Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1 min-h-[36px]">
            <Bookmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={citationStyle}
              onChange={(e) => onCitationStyleChange(e.target.value as CitationStyle)}
              disabled={isBusy}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-1"
              title="Citation & Reference format"
            >
              {CITATION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-slate-900 text-slate-200">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Running Header & Page Number Toggles */}
          <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-lg p-0.5 min-h-[36px]">
            <button
              type="button"
              onClick={() => onTogglePageNumbers(!includePageNumbers)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer touch-manipulation ${
                includePageNumbers
                  ? 'bg-slate-800 text-indigo-300 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle automatic page numbers in document header/footer"
            >
              Page #
            </button>
            <button
              type="button"
              onClick={() => onToggleHeader(!includeHeader)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer touch-manipulation ${
                includeHeader
                  ? 'bg-slate-800 text-indigo-300 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle running title header bar in document"
            >
              Header
            </button>
          </div>

          {/* Quick Step Buttons (Tablet & Desktop) */}
          <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-800">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isBusy || !hasContent}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer touch-manipulation"
              title="Scan text structure and count elements"
            >
              <Search className="w-3 h-3 text-sky-400" />
              <span>Analyze</span>
            </button>

            <button
              type="button"
              onClick={onClean}
              disabled={isBusy || !hasContent}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer touch-manipulation"
              title="Remove AI conversational chatter and prefixes"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Clean</span>
            </button>

            <button
              type="button"
              onClick={onFormat}
              disabled={isBusy || !hasContent}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs text-indigo-200 hover:text-white bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer font-medium touch-manipulation"
              title="Format directly into academic AST structure (Ctrl+Shift+F)"
            >
              <CheckCircle2 className="w-3 h-3 text-indigo-400" />
              <span>Format</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Unboxed Document Metadata Strip with Smooth Horizontal Scroll on Mobile */}
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-x-3 gap-y-1 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          <span className="flex items-center gap-1 shrink-0">
            <FileText className="w-3 h-3 text-indigo-400" />
            <strong className="text-slate-200 font-medium">{words.toLocaleString()}</strong> words
          </span>
          <span className="text-slate-700 shrink-0" aria-hidden="true">·</span>
          <span className="shrink-0">{chars.toLocaleString()} characters</span>
          <span className="text-slate-700 shrink-0" aria-hidden="true">·</span>
          <span className="flex items-center gap-1 shrink-0">
            <BookOpen className="w-3 h-3 text-sky-400" />
            <strong className="text-slate-200 font-medium">{pages}</strong> {pages === 1 ? 'page' : 'pages'}
          </span>
          {mathCount > 0 && (
            <>
              <span className="text-slate-700 shrink-0" aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-emerald-300 font-medium shrink-0">
                <Sigma className="w-3 h-3 text-emerald-400" />
                {mathCount} formulas
              </span>
            </>
          )}
          {citationsCount > 0 && (
            <>
              <span className="text-slate-700 shrink-0" aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-purple-300 font-medium shrink-0">
                <Quote className="w-3 h-3 text-purple-400" />
                {citationsCount} citations
              </span>
            </>
          )}
          <span className="text-slate-700 shrink-0" aria-hidden="true">·</span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3 text-slate-500" />
            {readTime} min read
          </span>
        </div>

        {/* Quick Guide and Detailed Options Buttons */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="flex items-center gap-1 text-slate-400 hover:text-sky-300 transition-colors cursor-pointer touch-manipulation"
              title="View keyboard shortcuts and pipeline guide"
            >
              <HelpCircle className="w-3 h-3" />
              <span className="hidden xs:inline">Shortcuts</span>
            </button>
          )}

          {onOpenDetailsModal && (
            <button
              type="button"
              onClick={onOpenDetailsModal}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer touch-manipulation"
              title="View detailed formatting rules & options"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Options</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
