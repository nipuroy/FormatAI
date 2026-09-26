import { useState } from 'react';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { useDocumentPipeline } from '../hooks/useDocumentPipeline';
import { Header } from '../components/Header';
import { InputEditor } from '../components/InputEditor';
import { FormattingControls } from '../components/FormattingControls';
import { ExportControls } from '../components/ExportControls';
import { DocumentPreview } from '../components/DocumentPreview';
import { ProcessingStatus } from '../components/ProcessingStatus';
import { ErrorNotification } from '../components/ErrorNotification';
import { DocumentStats } from '../components/DocumentStats';
import { AISettingsModal } from '../components/AISettingsModal';
import { UserSettingsModal } from '../components/UserSettingsModal';

export function DocumentFormatterPage() {
  const {
    connectionState,
    latencyMs,
    checkHealth,
    errorMessage: healthError,
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

  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  const isBusy = activeOperation !== 'idle';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        connectionState={connectionState}
        latencyMs={latencyMs}
        onRefreshHealth={checkHealth}
        onOpenAISettings={() => setIsAISettingsOpen(true)}
        onOpenUserSettings={() => setIsUserSettingsOpen(true)}
        onSelectSample={loadSample}
        onClear={clearEditor}
        activeOperation={activeOperation}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* Real-Time Processing Status Bar */}
        <ProcessingStatus
          activeOperation={activeOperation}
          operationDescription={operationDescription}
          progressPercent={progressPercent}
          workflowSteps={workflowSteps}
          successMessage={successBanner?.message}
          errorMessage={errorInfo?.message}
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

        {/* Unboxed Metadata Stats Strip (Anti-Slop) */}
        <DocumentStats
          document={structuredDocument}
          analysis={analysisResult}
          rawText={rawText}
        />

        {/* Mobile View Tab Switcher */}
        <div className="lg:hidden flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mobileTab === 'editor'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Input & Controls
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mobileTab === 'preview'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Formatted Preview
          </button>
        </div>

        {/* Dual-Panel Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
          {/* Left Panel: Input Editor & Configuration Controls */}
          <div
            className={`lg:col-span-6 flex flex-col gap-4 ${
              mobileTab === 'preview' ? 'hidden lg:flex' : 'flex'
            }`}
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

            <FormattingControls
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
            />

            <ExportControls
              onExportDocx={exportDocx}
              onExportPdf={exportPdf}
              activeOperation={activeOperation}
              lastExport={lastExport}
              preset={preset}
              includePageNumbers={includePageNumbers}
              includeHeader={includeHeader}
              hasContent={Boolean(rawText.trim() || structuredDocument)}
            />
          </div>

          {/* Right Panel: Academic Document Preview */}
          <div
            className={`lg:col-span-6 flex flex-col h-full min-h-[600px] ${
              mobileTab === 'editor' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <DocumentPreview
              document={structuredDocument}
              rawText={rawText}
              preset={preset}
              includePageNumbers={includePageNumbers}
              includeHeader={includeHeader}
              onQuickFormat={formatDocument}
              isFormatting={activeOperation === 'formatting'}
            />
          </div>
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
    </div>
  );
}
