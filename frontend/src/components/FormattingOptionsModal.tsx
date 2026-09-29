import React from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { CitationStyle, DocxPreset } from '../types/document';
import { FormattingControls } from './FormattingControls';
import { ExportControls } from './ExportControls';
import { OperationType } from '../types/api';
import { LastExportInfo } from '../hooks/useDocumentPipeline';

interface FormattingOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  onExportDocx: () => void;
  onExportPdf: () => void;
  activeOperation: OperationType;
  lastExport: LastExportInfo | null;
  hasContent: boolean;
}

export function FormattingOptionsModal({
  isOpen,
  onClose,
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
  disabled,
  onExportDocx,
  onExportPdf,
  activeOperation,
  lastExport,
  hasContent,
}: FormattingOptionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 text-slate-100 font-semibold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>Document Formatting & Export Options</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex flex-col gap-6">
          <FormattingControls
            preset={preset}
            onPresetChange={onPresetChange}
            citationStyle={citationStyle}
            onCitationStyleChange={onCitationStyleChange}
            includePageNumbers={includePageNumbers}
            onTogglePageNumbers={onTogglePageNumbers}
            includeHeader={includeHeader}
            onToggleHeader={onToggleHeader}
            title={title}
            onTitleChange={onTitleChange}
            disabled={disabled}
          />

          <ExportControls
            onExportDocx={onExportDocx}
            onExportPdf={onExportPdf}
            activeOperation={activeOperation}
            lastExport={lastExport}
            preset={preset}
            includePageNumbers={includePageNumbers}
            includeHeader={includeHeader}
            hasContent={hasContent}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
