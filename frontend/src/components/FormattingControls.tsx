import React from 'react';
import {
  SlidersHorizontal,
  Bookmark,
  Hash,
  Heading,
  Type,
  LayoutTemplate,
} from 'lucide-react';
import { CitationStyle, DocxPreset } from '../types/document';

interface FormattingControlsProps {
  preset: DocxPreset;
  onPresetChange: (preset: DocxPreset) => void;
  citationStyle: CitationStyle;
  onCitationStyleChange: (style: CitationStyle) => void;
  includePageNumbers: boolean;
  onTogglePageNumbers: (val: boolean) => void;
  includeHeader: boolean;
  onToggleHeader: (val: boolean) => void;
  title: string;
  onTitleChange: (title: string) => void;
  disabled?: boolean;
}

const PRESET_OPTIONS: { id: DocxPreset; label: string; desc: string }[] = [
  { id: 'academic', label: 'Academic Standard', desc: 'Times New Roman 12pt, double spacing, APA/MLA' },
  { id: 'research_paper', label: 'Research Paper', desc: 'Helvetica/Arial, compact 1.15 line height' },
  { id: 'exam', label: 'Exam Paper', desc: 'Clear question boundaries, bold section tags' },
  { id: 'study_notes', label: 'Study Notes', desc: 'Indented summaries and callout blocks' },
  { id: 'textbook', label: 'Textbook Chapter', desc: 'Georgia serif, balanced reading margins' },
];

const CITATION_OPTIONS: { id: CitationStyle; label: string }[] = [
  { id: 'apa', label: 'APA 7th Edition' },
  { id: 'ieee', label: 'IEEE (Numeric [1])' },
  { id: 'mla', label: 'MLA 9th Edition' },
  { id: 'harvard', label: 'Harvard Reference' },
  { id: 'chicago', label: 'Chicago Manual' },
];

export function FormattingControls({
  preset,
  onPresetChange,
  citationStyle,
  onCitationStyleChange,
  includePageNumbers,
  onTogglePageNumbers,
  includeHeader,
  onToggleHeader,
  title,
  onTitleChange,
  disabled = false,
}: FormattingControlsProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
          <span>Formatting Controls</span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Backend Rules</span>
      </div>

      {/* Document Title Override */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
          <Heading className="w-3.5 h-3.5 text-slate-400" />
          <span>Document Title</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={disabled}
          placeholder="Autodetected from first heading if empty..."
          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Preset Selector */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
          <LayoutTemplate className="w-3.5 h-3.5 text-slate-400" />
          <span>Style Preset</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PRESET_OPTIONS.map((item) => {
            const isSelected = preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onPresetChange(item.id)}
                className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/70 text-indigo-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold flex items-center justify-between">
                  <span>{item.label}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  {item.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Citation Style and Layout Flags */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 border-t border-slate-800/80">
        {/* Citation Style */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-slate-400" />
            <span>Citation Style</span>
          </label>
          <select
            value={citationStyle}
            onChange={(e) => onCitationStyleChange(e.target.value as CitationStyle)}
            disabled={disabled}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {CITATION_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Page Numbers */}
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 py-1.5">
            <input
              type="checkbox"
              checked={includePageNumbers}
              onChange={(e) => onTogglePageNumbers(e.target.checked)}
              disabled={disabled}
              className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              Dynamic Page Numbers
            </span>
          </label>
        </div>

        {/* Running Header */}
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 py-1.5">
            <input
              type="checkbox"
              checked={includeHeader}
              onChange={(e) => onToggleHeader(e.target.checked)}
              disabled={disabled}
              className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="flex items-center gap-1">
              <Type className="w-3.5 h-3.5 text-slate-400" />
              Running Headers
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
