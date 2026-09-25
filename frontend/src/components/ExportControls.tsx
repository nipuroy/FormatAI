import React from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle,
  Loader2,
  HardDrive,
  FileDown,
} from 'lucide-react';
import { OperationType } from '../types/api';
import { LastExportInfo } from '../hooks/useDocumentPipeline';
import { formatBytes } from '../utils/formatters';
import { DocxPreset } from '../types/document';

interface ExportControlsProps {
  onExportDocx: () => void;
  onExportPdf: () => void;
  activeOperation: OperationType;
  lastExport: LastExportInfo | null;
  preset: DocxPreset;
  includePageNumbers: boolean;
  includeHeader: boolean;
  hasContent: boolean;
}

export function ExportControls({
  onExportDocx,
  onExportPdf,
  activeOperation,
  lastExport,
  preset,
  includePageNumbers,
  includeHeader,
  hasContent,
}: ExportControlsProps) {
  const isExportingDocx = activeOperation === 'exporting_docx';
  const isExportingPdf = activeOperation === 'exporting_pdf';
  const isBusy = activeOperation !== 'idle';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span>Export Controls</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          <span>Preset: {preset}</span>
          <span aria-hidden="true">·</span>
          <span>{includePageNumbers ? 'Page # on' : 'Page # off'}</span>
        </div>
      </div>

      {/* Export Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Export DOCX */}
        <button
          type="button"
          onClick={onExportDocx}
          disabled={isBusy || !hasContent}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-xs text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
        >
          {isExportingDocx ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-blue-200" />
          )}
          <span>
            {isExportingDocx ? 'Generating Word DOCX...' : 'Export Word (.docx)'}
          </span>
        </button>

        {/* Export PDF */}
        <button
          type="button"
          onClick={onExportPdf}
          disabled={isBusy || !hasContent}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-xs text-white bg-rose-700 hover:bg-rose-600 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
        >
          {isExportingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4 text-rose-200" />
          )}
          <span>
            {isExportingPdf ? 'Compiling ReportLab PDF...' : 'Export PDF (.pdf)'}
          </span>
        </button>
      </div>

      {/* Last Export Metadata Notification */}
      {lastExport && (
        <div className="mt-1 flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-emerald-300">
              {lastExport.filename}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>{formatBytes(lastExport.sizeBytes)}</span>
            <span aria-hidden="true">·</span>
            <span>{lastExport.timestamp}</span>
          </div>
        </div>
      )}
    </div>
  );
}
