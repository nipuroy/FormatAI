import React, { useState } from 'react';
import {
  FileText,
  Code2,
  Eye,
  BookOpen,
  Sigma,
  Copy,
  Check,
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
}

export function DocumentPreview({
  document,
  rawText,
  preset,
  includePageNumbers,
  includeHeader,
  onQuickFormat,
  isFormatting,
}: DocumentPreviewProps) {
  const [viewMode, setViewMode] = useState<'paper' | 'json'>('paper');
  const [copiedJson, setCopiedJson] = useState(false);

  const handleCopyJson = () => {
    if (document) {
      navigator.clipboard.writeText(JSON.stringify(document, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
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
                        {h}
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

      case 'blockquote':
        return (
          <blockquote key={block.id || index} className="academic-abstract">
            “{block.text}”
          </blockquote>
        );

      case 'code_block':
        return (
          <pre key={block.id || index} className="p-3 my-3 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-800 overflow-x-auto">
            {block.text}
          </pre>
        );

      case 'thematic_break':
        return <hr key={block.id || index} className="my-6 border-slate-300" />;

      default:
        return (
          <div key={block.id || index} className="academic-paragraph">
            {renderInlineFormattedText(block.text)}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Preview Header & Controls */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Eye className="w-3.5 h-3.5 text-indigo-400" />
          <span>Academic Document Preview</span>
        </div>

        {/* View Mode Toggle Controls */}
        <div className="flex items-center gap-1.5 p-0.5 bg-slate-950/60 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('paper')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'paper'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>Paper View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'json'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>AST JSON</span>
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 flex justify-center">
        {document ? (
          viewMode === 'paper' ? (
            <div className="academic-paper-sheet w-full">
              {/* Running Header */}
              {includeHeader && (
                <div className="academic-header-bar">
                  <span className="font-semibold truncate max-w-xs">
                    {document.title || 'FormatAI Academic Manuscript'}
                  </span>
                  <span>Preset: {preset.toUpperCase()}</span>
                </div>
              )}

              {/* Render Blocks */}
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
                  <span className="text-[10px] text-slate-400 font-mono">FormatAI Publication Engine</span>
                  <span className="font-mono text-slate-600">
                    Page 1 of {document.statistics.estimated_pages || 1}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* AST JSON Inspector */
            <div className="w-full max-w-3xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Structured AST ({document.blocks.length} blocks)
                </span>
                <button
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
                >
                  {copiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedJson ? 'Copied' : 'Copy AST'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-[600px] leading-relaxed">
                {JSON.stringify(document, null, 2)}
              </pre>
            </div>
          )
        ) : (
          /* Empty Placeholder */
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-sm m-auto text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">No Structured Document Yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                Paste content and click "Format" or "Run Pipeline" to construct the publication-grade preview.
              </p>
            </div>
            {rawText.trim() && (
              <button
                type="button"
                onClick={onQuickFormat}
                disabled={isFormatting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors cursor-pointer shadow-sm"
              >
                <span>Format Document Now</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
