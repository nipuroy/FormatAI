import { useState, useEffect, useCallback } from 'react';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { useDocumentPipeline } from '../hooks/useDocumentPipeline';
import { Header } from '../components/Header';
import { WorkspaceToolbar } from '../components/WorkspaceToolbar';
import { InputEditor } from '../components/InputEditor';
import { DocumentPreview } from '../components/DocumentPreview';
import { ProcessingStatus } from '../components/ProcessingStatus';
import { ErrorNotification } from '../components/ErrorNotification';
import { AISettingsModal } from '../components/AISettingsModal';
import { UserSettingsModal } from '../components/UserSettingsModal';
import { SkillsModal } from '../components/SkillsModal';
import { FormattingOptionsModal } from '../components/FormattingOptionsModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { skillRegistry } from '../skills';
import { FileEdit, BookOpen, Zap, Download } from 'lucide-react';

export function DocumentFormatterPage() {
  const {
    connectionState,
    latencyMs,
    checkHealth,
  } = useBackendHealth();

  const {
    rawText,
    setRawText,
    title,
    setTitle,
    preset,
    setPreset,
    citationStyle,
    setCitationStyle,
    includePageNumbers,
    setIncludePageNumbers,
    includeHeader,
    setIncludeHeader,
    activeOperation,
    operationDescription,
    progressPercent,
    analysisResult,
    structuredDocument,
    lastExport,
    errorInfo,
    clearError,
    successBanner,
    clearSuccess,
    workflowSteps,
    analyzeContent,
    cleanContent,
    formatDocument,
    runFullPipeline,
    exportDocx,
    exportPdf,
    loadSample,
    clearEditor,
  } = useDocumentPipeline();

  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isFormattingOptionsOpen, setIsFormattingOptionsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [enabledSkillsCount, setEnabledSkillsCount] = useState<number>(() => skillRegistry.getEnabled().length);

  // Subscribe to modular skills registry changes
  useEffect(() => {
    const unsubscribe = skillRegistry.subscribe(() => {
      setEnabledSkillsCount(skillRegistry.getEnabled().length);
    });
    return unsubscribe;
  }, []);

  // Global Keyboard Shortcuts for Maximum Usability
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === 'Enter') {
        e.preventDefault();
        runFullPipeline();
      } else if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        formatDocument();
      } else if (mod && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        exportDocx();
      } else if (mod && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        exportPdf();
      } else if (mod && e.key === '/') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runFullPipeline, formatDocument, exportDocx, exportPdf]);

  const isBusy = activeOperation !== 'idle';
  const hasContent = Boolean(rawText.trim() || structuredDocument);
  const wordsCount = rawText ? rawText.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-16 sm:pb-0">
      {/* Top Header conforming to 3-Zone Contract with Responsive Mobile Controls */}
      <Header
        connectionState={connectionState}
        latencyMs={latencyMs}
        onRefreshHealth={checkHealth}
        onOpenAISettings={() => setIsAISettingsOpen(true)}
        onOpenUserSettings={() => setIsUserSettingsOpen(true)}
        onOpenSkills={() => setIsSkillsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onSelectSample={loadSample}
        onClear={clearEditor}
        activeOperation={activeOperation}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRunPipeline={runFullPipeline}
        onExportDocx={exportDocx}
        onExportPdf={exportPdf}
        hasContent={hasContent}
        enabledSkillsCount={enabledSkillsCount}
        lastExport={lastExport}
        onToggleFormattingDrawer={() => setIsFormattingOptionsOpen(true)}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3">
        {/* Processing Status & Always-Visible Workflow Process Flow with Fluid Animations */}
        <ProcessingStatus
          activeOperation={activeOperation}
          operationDescription={operationDescription}
          progressPercent={progressPercent}
          workflowSteps={workflowSteps}
          successMessage={successBanner?.message}
          errorMessage={errorInfo?.message}
          onDismissSuccess={clearSuccess}
          onDismissError={clearError}
          onStepClick={(stepId) => {
            if (stepId === 'analyze') analyzeContent();
            else if (stepId === 'clean') cleanContent();
            else if (stepId === 'format') formatDocument();
            else if (stepId === 'export') exportDocx();
          }}
        />

        {/* Dismissable Error Notification */}
        {errorInfo && (
          <ErrorNotification
            error={errorInfo}
            onDismiss={clearError}
            onRetry={
              errorInfo.operation === 'Analyze'
                ? analyzeContent
                : errorInfo.operation === 'Clean'
                ? cleanContent
                : errorInfo.operation === 'Format'
                ? formatDocument
                : errorInfo.operation === 'Export DOCX'
                ? exportDocx
                : errorInfo.operation === 'Export PDF'
                ? exportPdf
                : undefined
            }
          />
        )}

        {/* Unified Command Ribbon Toolbar (Title, Preset, Citations, Toggles, Pipeline Steps, Metrics) */}
        <WorkspaceToolbar
          title={title}
          onTitleChange={setTitle}
          preset={preset}
          onPresetChange={setPreset}
          citationStyle={citationStyle}
          onCitationStyleChange={setCitationStyle}
          includePageNumbers={includePageNumbers}
          onTogglePageNumbers={setIncludePageNumbers}
          includeHeader={includeHeader}
          onToggleHeader={setIncludeHeader}
          activeOperation={activeOperation}
          onAnalyze={analyzeContent}
          onClean={cleanContent}
          onFormat={formatDocument}
          hasContent={hasContent}
          document={structuredDocument}
          analysis={analysisResult}
          rawText={rawText}
          onOpenDetailsModal={() => setIsFormattingOptionsOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
        />

        {/* Mobile View Tab Switcher (Under lg breakpoint with counts & badges) */}
        <div className="lg:hidden flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xs">
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg transition-colors cursor-pointer touch-manipulation ${
              mobileTab === 'editor'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5 text-indigo-400" />
            <span>Raw Input Editor</span>
            {wordsCount > 0 && (
              <span className="text-[10px] font-mono text-slate-400">({wordsCount}w)</span>
            )}
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg transition-colors cursor-pointer touch-manipulation ${
              mobileTab === 'preview'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Paper Preview</span>
            {structuredDocument && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Dynamic Dual-Panel / Focused Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1 items-stretch min-h-[550px]">
          {/* Left Panel: Input Editor */}
          {(viewMode === 'split' || viewMode === 'editor') && (
            <div
              className={`flex flex-col h-full ${
                viewMode === 'editor' ? 'lg:col-span-12' : 'lg:col-span-6'
              } ${mobileTab === 'preview' ? 'hidden lg:flex' : 'flex'}`}
            >
              <InputEditor
                value={rawText}
                onChange={setRawText}
                activeOperation={activeOperation}
                onAnalyze={analyzeContent}
                onClean={cleanContent}
                onFormat={formatDocument}
                onRunFullPipeline={runFullPipeline}
              />
            </div>
          )}

          {/* Right Panel: Academic Document Preview */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div
              className={`flex flex-col h-full ${
                viewMode === 'preview' ? 'lg:col-span-12' : 'lg:col-span-6'
              } ${mobileTab === 'editor' ? 'hidden lg:flex' : 'flex'}`}
            >
              <DocumentPreview
                document={structuredDocument}
                rawText={rawText}
                preset={preset}
                includePageNumbers={includePageNumbers}
                includeHeader={includeHeader}
                onQuickFormat={formatDocument}
                isFormatting={activeOperation === 'formatting'}
                onExportDocx={exportDocx}
                onExportPdf={exportPdf}
                isExportingDocx={activeOperation === 'exporting_docx'}
                isExportingPdf={activeOperation === 'exporting_pdf'}
                onSelectSample={loadSample}
              />
            </div>
          )}
        </div>
      </main>

      {/* Floating Quick Action Button for Mobile Devices */}
      <div className="sm:hidden fixed bottom-3 right-3 z-30 flex items-center gap-2">
        {hasContent && (
          <button
            onClick={exportDocx}
            disabled={isBusy}
            className="p-3 rounded-full bg-slate-800 text-sky-300 border border-slate-700 shadow-xl cursor-pointer touch-manipulation active:scale-95 transition-transform"
            title="Download Word DOCX"
            aria-label="Export DOCX"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={runFullPipeline}
          disabled={isBusy || !hasContent}
          className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-indigo-600 text-white font-semibold text-xs shadow-2xl disabled:opacity-50 cursor-pointer touch-manipulation active:scale-95 transition-transform"
          title="Run pipeline in 1 click"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>Format & Preview</span>
        </button>
      </div>

      {/* AI Settings and Assistance Modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        currentText={rawText}
        onApplyAIText={(newText) => {
          setRawText(newText);
        }}
      />

      {/* User Settings, Privacy & Client Isolation Modal */}
      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        onOpenAISettings={() => setIsAISettingsOpen(true)}
      />

      {/* Modular Document Skills Management Modal */}
      <SkillsModal
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
      />

      {/* Detailed Formatting Rules & Options Modal */}
      <FormattingOptionsModal
        isOpen={isFormattingOptionsOpen}
        onClose={() => setIsFormattingOptionsOpen(false)}
        preset={preset}
        onPresetChange={setPreset}
        citationStyle={citationStyle}
        onCitationStyleChange={setCitationStyle}
        includePageNumbers={includePageNumbers}
        onTogglePageNumbers={setIncludePageNumbers}
        includeHeader={includeHeader}
        onToggleHeader={setIncludeHeader}
        title={title}
        onTitleChange={setTitle}
        disabled={isBusy}
        onExportDocx={exportDocx}
        onExportPdf={exportPdf}
        activeOperation={activeOperation}
        lastExport={lastExport}
        hasContent={hasContent}
      />

      {/* Keyboard Shortcuts & Quick Guide Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
