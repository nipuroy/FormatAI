import { useState, useEffect } from 'react';
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
import { skillRegistry } from '../skills';

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
  const [enabledSkillsCount, setEnabledSkillsCount] = useState<number>(() => skillRegistry.getEnabled().length);

  // Subscribe to modular skills registry changes
  useEffect(() => {
    const unsubscribe = skillRegistry.subscribe(() => {
      setEnabledSkillsCount(skillRegistry.getEnabled().length);
    });
    return unsubscribe;
  }, []);

  const isBusy = activeOperation !== 'idle';
  const hasContent = Boolean(rawText.trim() || structuredDocument);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header conforming to 3-Zone Contract */}
      <Header
        connectionState={connectionState}
        latencyMs={latencyMs}
        onRefreshHealth={checkHealth}
        onOpenAISettings={() => setIsAISettingsOpen(true)}
        onOpenUserSettings={() => setIsUserSettingsOpen(true)}
        onOpenSkills={() => setIsSkillsOpen(true)}
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-3">
        {/* Processing Status & Always-Visible Workflow Process Flow */}
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
        />

        {/* Mobile View Tab Switcher (Under lg breakpoint) */}
        <div className="lg:hidden flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              mobileTab === 'editor'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Raw Input Editor
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              mobileTab === 'preview'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Academic Manuscript Preview
          </button>
        </div>

        {/* Dynamic Dual-Panel / Focused Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch min-h-[600px]">
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
    </div>
  );
}
