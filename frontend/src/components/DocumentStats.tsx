import React from 'react';
import {
  FileText,
  Clock,
  BookOpen,
  Sigma,
  Quote,
  LayoutList,
} from 'lucide-react';
import { AcademicDocument } from '../types/document';
import { ContentAnalysisResponse } from '../types/api';

interface DocumentStatsProps {
  document: AcademicDocument | null;
  analysis: ContentAnalysisResponse | null;
  rawText: string;
}

export function DocumentStats({
  document,
  analysis,
  rawText,
}: DocumentStatsProps) {
  const words = document?.statistics.word_count ?? analysis?.word_count ?? (rawText ? rawText.trim().split(/\s+/).length : 0);
  const chars = document?.statistics.character_count ?? analysis?.char_count ?? rawText.length;
  const headings = document?.statistics.heading_count ?? analysis?.heading_count ?? 0;
  const readTime = document?.statistics.estimated_read_time_minutes ?? analysis?.estimated_read_time_minutes ?? Math.max(1, Math.ceil(words / 220));
  const pages = document?.statistics.estimated_pages ?? Math.max(1, Math.ceil(words / 500));
  const mathCount = document?.metadata.detected_math_expressions?.length ?? analysis?.detected_math_count ?? 0;
  const citationsCount = document?.metadata.detected_citations?.length ?? analysis?.detected_citations_count ?? 0;

  return (
    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400 font-mono">
      <div className="flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-slate-200 font-medium">{words.toLocaleString()}</span>
        <span>words</span>
      </div>

      <span className="text-slate-700" aria-hidden="true">·</span>

      <div className="flex items-center gap-1.5">
        <span>{chars.toLocaleString()} characters</span>
      </div>

      <span className="text-slate-700" aria-hidden="true">·</span>

      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-slate-200 font-medium">{pages}</span>
        <span>{pages === 1 ? 'page' : 'pages'}</span>
      </div>

      <span className="text-slate-700" aria-hidden="true">·</span>

      <div className="flex items-center gap-1.5">
        <LayoutList className="w-3.5 h-3.5 text-amber-400" />
        <span>{headings} headings</span>
      </div>

      {mathCount > 0 && (
        <>
          <span className="text-slate-700" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5">
            <Sigma className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300 font-medium">{mathCount} formulas</span>
          </div>
        </>
      )}

      {citationsCount > 0 && (
        <>
          <span className="text-slate-700" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5">
            <Quote className="w-3.5 h-3.5 text-purple-400" />
            <span>{citationsCount} citations</span>
          </div>
        </>
      )}

      <span className="text-slate-700" aria-hidden="true">·</span>

      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        <span>{readTime} min read</span>
      </div>
    </div>
  );
}
