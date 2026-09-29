import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  X,
} from 'lucide-react';
import { OperationType, WorkflowStep } from '../types/api';

interface ProcessingStatusProps {
  activeOperation: OperationType | string;
  operationDescription: string;
  progressPercent?: number;
  workflowSteps: WorkflowStep[];
  successMessage?: string | null;
  errorMessage?: string | null;
  onDismissSuccess?: () => void;
  onDismissError?: () => void;
}

export function ProcessingStatus({
  activeOperation,
  operationDescription,
  workflowSteps,
  successMessage,
  errorMessage,
  onDismissSuccess,
  onDismissError,
}: ProcessingStatusProps) {
  const isRunning = activeOperation !== 'idle';

  // If idle and no banners, keep layout uncluttered
  if (!isRunning && !successMessage && !errorMessage) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Active Pipeline Operation Bar */}
      {isRunning && (
        <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-3 shadow-md flex flex-col gap-2.5 animate-fadeIn">
          {/* Top Info */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-indigo-300 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
              <span>{operationDescription || `Running ${activeOperation}...`}</span>
            </div>
            <span className="font-mono text-[11px] text-indigo-400">Processing...</span>
          </div>

          {/* Stepper Visualization */}
          <div className="flex items-center flex-wrap gap-1.5 text-[11px] pt-1 border-t border-slate-800">
            {workflowSteps.map((step, idx) => {
              const isLast = idx === workflowSteps.length - 1;
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';
              const isError = step.status === 'error';

              return (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-colors ${
                      isActive
                        ? 'bg-indigo-950 border border-indigo-500/60 text-indigo-200 font-semibold'
                        : isCompleted
                        ? 'bg-slate-800 text-emerald-400 font-medium'
                        : isError
                        ? 'bg-rose-950/50 border border-rose-500/40 text-rose-300'
                        : 'text-slate-500 bg-slate-950/50'
                    }`}
                  >
                    {isActive ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    ) : isError ? (
                      <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    )}
                    <span>{step.label}</span>
                  </div>
                  {!isLast && (
                    <ArrowRight className="w-2.5 h-2.5 text-slate-700 hidden sm:inline" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {!isRunning && successMessage && (
        <div className="flex items-center justify-between gap-2.5 p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          {onDismissSuccess && (
            <button
              onClick={onDismissSuccess}
              className="p-1 text-emerald-400 hover:text-emerald-200 cursor-pointer rounded"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Error Notification Banner */}
      {!isRunning && errorMessage && (
        <div className="flex items-center justify-between gap-2.5 p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="p-1 text-rose-400 hover:text-rose-200 cursor-pointer rounded"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
