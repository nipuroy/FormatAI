import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
      {/* Workflow Process Stepper Container - Responsive & Fluid on Every Device */}
      <motion.div
        layout
        className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 shadow-sm flex flex-col gap-2 transition-colors duration-200"
      >
        {/* Top Stepper Flow */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Steps Horizontal Flow with Touch Scroll on Mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {workflowSteps.map((step, idx) => {
              const isLast = idx === workflowSteps.length - 1;
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';
              const isError = step.status === 'error';
              const isClickable = Boolean(
                onStepClick && (step.id === 'analyze' || step.id === 'clean' || step.id === 'format' || step.id === 'export')
              );

              // Distinct transition styles based on step status
              const buttonVariantClass = isActive
                ? 'bg-indigo-950/90 border-indigo-500/80 text-indigo-200 font-semibold shadow-sm ring-1 ring-indigo-500/40 shadow-indigo-950/50'
                : isCompleted
                ? 'bg-slate-950/70 border-emerald-900/40 text-emerald-400 font-medium hover:border-emerald-600/50 hover:bg-slate-900'
                : isError
                ? 'bg-rose-950/50 border-rose-500/60 text-rose-300 font-medium'
                : 'bg-slate-950/40 border-slate-800/70 text-slate-400 hover:text-slate-300 hover:bg-slate-900/60';

              return (
                <React.Fragment key={step.id}>
                  <motion.button
                    type="button"
                    layout
                    disabled={!isClickable || isRunning}
                    onClick={() => isClickable && onStepClick?.(step.id)}
                    initial={false}
                    animate={{
                      scale: isActive ? 1.02 : 1,
                    }}
                    whileHover={isClickable && !isRunning ? { scale: 1.03, y: -1 } : {}}
                    whileTap={isClickable && !isRunning ? { scale: 0.97 } : {}}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 25,
                      mass: 0.8,
                    }}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] rounded-lg border text-xs transition-colors duration-200 touch-manipulation shrink-0 ${buttonVariantClass} ${
                      isClickable && !isRunning ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    title={step.description}
                  >
                    {/* Animated Icon Transitions */}
                    <AnimatePresence mode="wait" initial={false}>
                      {isActive ? (
                        <motion.span
                          key="active-spinner"
                          initial={{ opacity: 0, scale: 0.4, rotate: -45 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.4, rotate: 45 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-center justify-center shrink-0"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        </motion.span>
                      ) : isCompleted ? (
                        <motion.span
                          key="completed-check"
                          initial={{ opacity: 0, scale: 0.3 }}
                          animate={{ opacity: 1, scale: [0.3, 1.25, 1] }}
                          exit={{ opacity: 0, scale: 0.4 }}
                          transition={{ duration: 0.28, ease: 'easeOut' }}
                          className="flex items-center justify-center shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </motion.span>
                      ) : isError ? (
                        <motion.span
                          key="error-alert"
                          initial={{ opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.4 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center justify-center shrink-0"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="pending-dot"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          transition={{ duration: 0.15 }}
                          className="w-2 h-2 rounded-full bg-slate-600 shrink-0"
                        />
                      )}
                    </AnimatePresence>

                    {/* Responsive labels */}
                    <span className="whitespace-nowrap font-medium">
                      {step.id === 'paste' ? (
                        <>
                          <span className="sm:hidden">1. Paste</span>
                          <span className="hidden sm:inline">1. Paste Content</span>
                        </>
                      ) : (
                        step.label
                      )}
                    </span>
                  </motion.button>

                  {!isLast && (
                    <motion.div
                      animate={{
                        color: isCompleted
                          ? 'rgba(52, 211, 153, 0.7)'
                          : isActive
                          ? 'rgba(129, 140, 248, 0.8)'
                          : 'rgba(71, 85, 105, 0.6)',
                        scale: isActive ? 1.1 : 1,
                      }}
                      transition={{ duration: 0.25 }}
                      className="inline-flex items-center shrink-0 px-0.5"
                    >
                      <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </motion.div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Operation Status Label with Smooth Fade/Slide */}
          <div className="flex items-center gap-2 text-xs shrink-0 self-end sm:self-auto">
            <AnimatePresence mode="wait">
              {isRunning ? (
                <motion.div
                  key={operationDescription || activeOperation}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 text-indigo-300 font-medium font-mono text-[11px]"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-xs">
                    {operationDescription || `Running ${activeOperation}...`}
                  </span>
                </motion.div>
              ) : (
                <motion.span
                  key="idle-ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[11px] font-mono text-slate-500 hidden md:inline"
                >
                  Automated Pipeline Ready
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Live Smoothly Animated Progress Bar when Running */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 6, marginTop: 4 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="w-full bg-slate-950 rounded-full overflow-hidden"
            >
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${Math.max(12, progressPercent)}%` }}
                transition={{
                  type: 'spring',
                  stiffness: 70,
                  damping: 18,
                  mass: 0.7,
                }}
                className="bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 h-full rounded-full shadow-[0_0_10px_rgba(99,102,241,0.4)]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Success Notification Banner with Smooth Appearance */}
      <AnimatePresence>
        {!isRunning && successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 shadow-sm"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Notification Banner with Smooth Appearance */}
      <AnimatePresence>
        {!isRunning && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 shadow-sm"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
