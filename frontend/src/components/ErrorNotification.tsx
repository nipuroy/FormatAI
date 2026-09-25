import React from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { PipelineErrorInfo } from '../hooks/useDocumentPipeline';

interface ErrorNotificationProps {
  error: PipelineErrorInfo | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function ErrorNotification({
  error,
  onDismiss,
  onRetry,
}: ErrorNotificationProps) {
  if (!error) return null;

  return (
    <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3.5 shadow-lg flex items-start gap-3 text-xs text-rose-200">
      <div className="p-1 rounded bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-rose-100 uppercase tracking-wider text-[11px]">
            {error.operation} Failed
          </span>
          <span className="text-[10px] text-rose-400 font-mono">
            {error.timestamp}
          </span>
        </div>
        <p className="text-rose-200 leading-relaxed break-words font-mono text-[11px] bg-rose-950/80 p-2 rounded border border-rose-900/50">
          {error.message}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="p-1.5 rounded hover:bg-rose-900/60 text-rose-300 hover:text-white transition-colors cursor-pointer"
            title="Retry operation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1.5 rounded hover:bg-rose-900/60 text-rose-400 hover:text-white transition-colors cursor-pointer"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
