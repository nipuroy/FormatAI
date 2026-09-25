import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { OperationType, WorkflowStep } from '../types/api';

interface ProcessingStatusProps {
  activeOperation: OperationType;
  operationDescription: string;
  progressPercent: number;
  workflowSteps: WorkflowStep[];
  successMessage?: string | null;
  errorMessage?: string | null;
}

export function ProcessingStatus({
  activeOperation,
  operationDescription,
  workflowSteps,
  successMessage,
  errorMessage,
}: ProcessingStatusProps) {
  const isRunning = activeOperation !== 'idle';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-3">
      {/* Workflow Step Indicator */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          {workflowSteps.map((step, idx) => {
            const isLast = idx === workflowSteps.length - 1;
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            const isError = step.status === 'error';

            return (
              <React.Fragment key={step.id}>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                    isActive
                      ? 'bg-indigo-950/80 border border-indigo-500/60 text-indigo-300 font-semibold shadow-sm'
                      : isCompleted
                      ? 'bg-slate-800/80 text-emerald-400 font-medium'
                      : isError
                      ? 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
                      : 'text-slate-500 bg-slate-950/40'
                  }`}
                  title={step.description}
                >
                  {isActive ? (
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : isError ? (
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  )}
                  <span>{step.label}</span>
                </div>
                {!isLast && (
                  <ArrowRight className="w-3 h-3 text-slate-700 hidden sm:inline" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Operation Status Banner */}
      {isRunning && (
        <div className="flex items-center gap-3 p-2.5 bg-indigo-950/30 border border-indigo-500/40 rounded-lg text-xs text-indigo-200">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-white">Running Operation: </span>
            <span className="text-slate-300">{operationDescription || activeOperation}</span>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {!isRunning && successMessage && (
        <div className="flex items-center gap-2.5 p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {!isRunning && errorMessage && (
        <div className="flex items-center gap-2.5 p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-lg text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
        </div>
      )}

      {/* Idle Prompt */}
      {!isRunning && !successMessage && !errorMessage && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>Ready. Click "Analyze", "Clean", "Format", or "Run Pipeline" to proceed.</span>
        </div>
      )}
    </div>
  );
}
