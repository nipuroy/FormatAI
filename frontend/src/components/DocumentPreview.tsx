import React, { useState } from 'react';
import {
  FileText,
  Code2,
  Eye,
  BookOpen,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileSpreadsheet,
  FileDown,
  Loader2,
  Sparkles,
  Download,
} from 'lucide-react';
import { AcademicDocument, DocumentBlock } from '../types/document';
import '../styles/academicPreview.css';

interface DocumentPreviewProps {
  document: AcademicDocument | null;
  rawText: string;
  preset: string;
  includePageNumbers: boolean;
  includeHeader: boolean;
  onQuickFormat: () => void;
  isFormatting: boolean;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
  isExportingDocx?: boolean;
  isExportingPdf?: boolean;
  onSelectSample?: (sampleId: string) => void;
}

export function DocumentPreview({
  document,
  rawText,
  preset,
  includePageNumbers,
  includeHeader,
  onQuickFormat,
  isFormatting,
  onExportDocx,
  onExportPdf,
  isExportingDocx = false,
  isExportingPdf = false,
  onSelectSample,
}: DocumentPreviewProps) {
  const [viewMode, setViewMode] = useState<'paper' | 'json'>('paper');
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const handleCopyJson = () => {
    if (document) {
      navigator.clipboard.writeText(JSON.stringify(document, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyPlainText = () => {
    if (!document) return;
    const lines = document.blocks.map((b) => b.text || (b.items ? b.items.join('\n') : '')).join('\n\n');
    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(150, Math.max(70, prev + delta)));
  };

  // Helper to render mixed inline text with LaTeX math styling
  const renderInlineFormattedText = (text: string) => {
    if (!text) return null;

    // Detect inline math tokens $...$
    const parts = text.split(/(\$[^$]+\$)/g);

    return parts.map((part, index) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const mathContent = part.slice(1, -1);
        return (
          <span key={index} className="academic-math-inline font-serif font-medium">
            {mathContent}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Helper to render individual semantic blocks
  const renderBlock = (block: DocumentBlock, index: number) => {
    switch (block.block_type) {
      case 'title':
        return (
          <h1 key={block.id || index} className="academic-title">
            {block.text}
          </h1>
        );

      case 'heading': {
        const level = block.level || 1;
        if (level === 1) {
          return (
            <h2 key={block.id || index} className="academic-h1">
              {block.text}
            </h2>
          );
        }
        if (level === 2) {
          return (
            <h3 key={block.id || index} className="academic-h2">
              {block.text}
            </h3>
          );
        }
        return (
          <h4 key={block.id || index} className="academic-h3">
            {block.text}
          </h4>
        );
      }

      case 'paragraph':
        return (
          <p key={block.id || index} className="academic-paragraph">
            {renderInlineFormattedText(block.text)}
          </p>
        );

      case 'math_block':
        return (
          <div key={block.id || index} className="academic-math-display">
            {block.text.replace(/^\$\$|\$\$$/g, '').trim()}
          </div>
        );

      case 'ordered_list':
        return (
          <ol key={block.id || index} className="list-decimal list-outside ml-6 mb-3.5 space-y-1 text-slate-800">
            {(block.items || []).map((item, i) => (
              <li key={i}>{renderInlineFormattedText(item)}</li>
            ))}
          </ol>
        );

      case 'unordered_list':
        return (
          <ul key={block.id || index} className="list-disc list-outside ml-6 mb-3.5 space-y-1 text-slate-800">
            {(block.items || []).map((item, i) => (
              <li key={i}>{renderInlineFormattedText(item)}</li>
            ))}
          </ul>
        );

      case 'table':
        return (
          <div key={block.id || index} className="academic-table-container">
            <table className="academic-table">
              {block.headers && block.headers.length > 0 && (
                <thead>
                  <tr>
                    {block.headers.map((h, i) => (
                      <th
                        key={i}
                        style={{
                          textAlign: (block.alignments?.[i] as 'left' | 'center' | 'right') || 'left',
                        }}
                      >
                        {renderInlineFormattedText(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {(block.rows || []).map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          textAlign: (block.alignments?.[cIdx] as 'left' | 'center' | 'right') || 'left',
                        }}
                      >
                        {renderInlineFormattedText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return (
          <p key={block.id || index} className="academic-paragraph">
            {renderInlineFormattedText(block.text)}
          </p>
        );
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[550px] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Top Preview Control Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-800 text-xs">
        {/* Left: Title & Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>Document Preview</span>
          </div>

          {/* View Mode Toggle Controls */}
          <div className="flex items-center p-0.5 bg-slate-950/70 rounded-md border border-slate-800 ml-1">
            <button
              type="button"
              onClick={() => setViewMode('paper')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === 'paper'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>Paper</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === 'json'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>AST JSON</span>
            </button>
          </div>
        </div>

        {/* Center: Zoom Controls (for paper view) */}
        {viewMode === 'paper' && document && (
          <div className="hidden sm:flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-md p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleZoom(-10)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="px-1.5 font-mono text-slate-300 hover:text-white cursor-pointer"
              title="Reset zoom to 100%"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={() => handleZoom(10)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Right: Direct Export & Copy Actions */}
        <div className="flex items-center gap-1.5">
          {viewMode === 'json' ? (
            <button
              type="button"
              onClick={handleCopyJson}
              disabled={!document}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopyPlainText}
              disabled={!document}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer disabled:opacity-50"
              title="Copy formatted text"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
          )}

          {/* 1-Click Direct Export Buttons right in Preview */}
          {onExportDocx && (
            <button
              type="button"
              onClick={onExportDocx}
              disabled={!document || isExportingDocx}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-200 bg-blue-950/70 hover:bg-blue-900 border border-blue-500/50 rounded transition-colors cursor-pointer disabled:opacity-40"
              title="Download Microsoft Word .docx directly"
            >
              {isExportingDocx ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
              ) : (
                <FileSpreadsheet className="w-3 h-3 text-blue-400" />
              )}
              <span>.docx</span>
            </button>
          )}

          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              disabled={!document || isExportingPdf}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-200 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 rounded transition-colors cursor-pointer disabled:opacity-40"
              title="Download compiled PDF directly"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
              ) : (
                <FileDown className="w-3 h-3 text-rose-400" />
              )}
              <span>.pdf</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 flex justify-center">
        {document ? (
          viewMode === 'paper' ? (
            <div
              className="w-full transition-transform duration-150 origin-top flex justify-center"
              style={{
                transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
              }}
            >
              <div className="academic-paper-sheet w-full">
                {/* Running Header */}
                {includeHeader && (
                  <div className="academic-header-bar">
                    <span className="font-semibold truncate max-w-xs">
                      {document.title || 'FormatAI Academic Manuscript'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      PRESET: {preset.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Render Semantic Blocks */}
                <div className="space-y-1">
                  {document.blocks.map((block, idx) => renderBlock(block, idx))}
                </div>

                {/* References Section */}
                {document.references && document.references.length > 0 && (
                  <div className="mt-8 pt-4 border-t border-slate-300">
                    <h3 className="academic-h2">References</h3>
                    <ol className="list-decimal list-outside ml-6 mt-3 space-y-1.5 text-xs text-slate-700 font-serif">
                      {document.references.map((ref, rIdx) => (
                        <li key={rIdx}>{ref}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Running Footer */}
                {includePageNumbers && (
                  <div className="academic-footer-bar">
                    <span className="text-[10px] text-slate-400 font-mono">
                      FormatAI Academic Engine
                    </span>
                    <span className="font-mono text-slate-600 text-xs">
                      Page 1 of {document.statistics.estimated_pages || 1}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* AST JSON Inspector */
            <div className="w-full max-w-3xl flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>
                  Structured AST ({document.blocks.length} blocks · {document.statistics.word_count} words)
                </span>
                <span className="text-[11px] text-slate-500">
                  Schema: AcademicDocument v1.0
                </span>
              </div>
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-[700px] leading-relaxed">
                {JSON.stringify(document, null, 2)}
              </pre>
            </div>
          )
        ) : (
          /* Empty / Quick-Start Placeholder */
          <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8 max-w-md m-auto text-slate-400 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Ready to Generate Publication Manuscript
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Paste your unformatted AI text, Markdown, or LaTeX formulas on the left and format it into a publication-grade academic document.
              </p>
            </div>

            {rawText.trim() ? (
              <button
                type="button"
                onClick={onQuickFormat}
                disabled={isFormatting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:shadow"
              >
                {isFormatting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Format Current Draft Now</span>
              </button>
            ) : (
              onSelectSample && (
                <div className="w-full flex flex-col gap-2 pt-2">
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                    Or try a 1-click sample:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectSample('quantum-physics')}
                      className="p-2 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 transition-colors cursor-pointer"
                    >
                      <div className="font-medium text-slate-200">Quantum Physics</div>
                      <div className="text-[10px] text-slate-500">LaTeX math & tables</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectSample('machine-learning')}
                      className="p-2 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 transition-colors cursor-pointer"
                    >
                      <div className="font-medium text-slate-200">ML Survey</div>
                      <div className="text-[10px] text-slate-500">Deep learning citations</div>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
