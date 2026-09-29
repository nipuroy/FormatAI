import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  X,
  Sparkles,
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
  onStepClick?: (stepId: WorkflowStep['id']) => void;
}

export function ProcessingStatus({
  activeOperation,
  operationDescription,
  progressPercent = 0,
  workflowSteps,
  successMessage,
  errorMessage,
  onDismissSuccess,
  onDismissError,
  onStepClick,
}: ProcessingStatusProps) {
  const isRunning = activeOperation !== 'idle';

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Workflow Process Stepper Container - Always Visible */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-sm flex flex-col gap-2.5 transition-all">
        {/* Top Stepper Flow */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Steps Horizontal Flow */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs">
            {workflowSteps.map((step, idx) => {
              const isLast = idx === workflowSteps.length - 1;
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';
              const isError = step.status === 'error';
              const isClickable = Boolean(onStepClick && (step.id === 'analyze' || step.id === 'clean' || step.id === 'format' || step.id === 'export'));

              return (
                <React.Fragment key={step.id}>
                  <button
                    type="button"
                    disabled={!isClickable || isRunning}
                    onClick={() => isClickable && onStepClick?.(step.id)}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs transition-all ${
                      isActive
                        ? 'bg-indigo-950/90 border-indigo-500/80 text-indigo-200 font-semibold shadow-sm ring-1 ring-indigo-500/40'
                        : isCompleted
                        ? 'bg-slate-950/70 border-slate-800 text-emerald-400 font-medium hover:border-slate-700'
                        : isError
                        ? 'bg-rose-950/50 border-rose-500/60 text-rose-300 font-medium'
                        : 'bg-slate-950/40 border-slate-800/70 text-slate-400 hover:text-slate-300'
                    } ${isClickable && !isRunning ? 'cursor-pointer hover:bg-slate-800' : 'cursor-default'}`}
                    title={step.description}
                  >
                    {isActive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : isError ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                    )}
                    <span className="whitespace-nowrap">{step.label}</span>
                  </button>

                  {!isLast && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:inline" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Operation Status Label (when running) or Ready status */}
          <div className="flex items-center gap-2 text-xs ml-auto">
            {isRunning ? (
              <div className="flex items-center gap-2 text-indigo-300 font-medium font-mono text-[11px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span className="truncate max-w-[200px] sm:max-w-xs">{operationDescription || `Running ${activeOperation}...`}</span>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-slate-500 hidden md:inline">
                Automated Pipeline Ready
              </span>
            )}
          </div>
        </div>

        {/* Live Progress Bar when running */}
        {isRunning && (
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 h-full transition-all duration-300 rounded-full animate-pulse"
              style={{ width: `${Math.max(15, progressPercent)}%` }}
            />
          </div>
        )}
      </div>

      {/* Success Notification Banner */}
      {!isRunning && successMessage && (
        <div className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{successMessage}</span>
          </div>
          {onDismissSuccess && (
            <button
              onClick={onDismissSuccess}
              className="p-1 text-emerald-400 hover:text-emerald-200 cursor-pointer rounded transition-colors shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Error Notification Banner */}
      {!isRunning && errorMessage && (
        <div className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="p-1 text-rose-400 hover:text-rose-200 cursor-pointer rounded transition-colors shrink-0"
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
