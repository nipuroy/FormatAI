import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/api';
import { downloadBlob } from '../services/exportService';
import {
  AcademicDocument,
  CitationStyle,
  DocxPreset,
} from '../types/document';
import {
  ContentAnalysisResponse,
  ContentCleanResponse,
  OperationType,
  WorkflowStep,
} from '../types/api';
import { SAMPLE_DOCUMENTS } from '../utils/sampleDocuments';
import { useUserSettings } from './useUserSettings';

export interface LastExportInfo {
  format: 'docx' | 'pdf';
  filename: string;
  sizeBytes: number;
  timestamp: string;
}

export interface PipelineErrorInfo {
  operation: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export function useDocumentPipeline() {
  const { settings, updateFormatting } = useUserSettings();

  // Input Document State
  const [rawText, setRawText] = useState<string>(SAMPLE_DOCUMENTS[0].content);
  const [title, setTitle] = useState<string>('Quantum Electrodynamics & Vacuum Polarization');
  const [preset, setPresetState] = useState<DocxPreset>(settings.formatting.preset);
  const [citationStyle, setCitationStyleState] = useState<CitationStyle>(settings.formatting.citationStyle);
  const [includePageNumbers, setIncludePageNumbersState] = useState<boolean>(settings.formatting.includePageNumbers);
  const [includeHeader, setIncludeHeaderState] = useState<boolean>(settings.formatting.includeHeader);

  // Sync state if user settings change (e.g. on profile reset or import)
  useEffect(() => {
    setPresetState(settings.formatting.preset);
    setCitationStyleState(settings.formatting.citationStyle);
    setIncludePageNumbersState(settings.formatting.includePageNumbers);
    setIncludeHeaderState(settings.formatting.includeHeader);
  }, [settings.formatting]);

  const setPreset = useCallback((p: DocxPreset) => {
    setPresetState(p);
    updateFormatting({ preset: p });
  }, [updateFormatting]);

  const setCitationStyle = useCallback((c: CitationStyle) => {
    setCitationStyleState(c);
    updateFormatting({ citationStyle: c });
  }, [updateFormatting]);

  const setIncludePageNumbers = useCallback((n: boolean) => {
    setIncludePageNumbersState(n);
    updateFormatting({ includePageNumbers: n });
  }, [updateFormatting]);

  const setIncludeHeader = useCallback((h: boolean) => {
    setIncludeHeaderState(h);
    updateFormatting({ includeHeader: h });
  }, [updateFormatting]);

  // Operation and Process State
  const [activeOperation, setActiveOperation] = useState<OperationType>('idle');
  const [operationDescription, setOperationDescription] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Results State
  const [analysisResult, setAnalysisResult] = useState<ContentAnalysisResponse | null>(null);
  const [cleanResult, setCleanResult] = useState<ContentCleanResponse | null>(null);
  const [structuredDocument, setStructuredDocument] = useState<AcademicDocument | null>(null);
  const [lastExport, setLastExport] = useState<LastExportInfo | null>(null);

  // Status and Error Notifications
  const [errorInfo, setErrorInfo] = useState<PipelineErrorInfo | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ message: string; timestamp: string } | null>(null);

  // Workflow Steps Tracking
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    { id: 'paste', label: '1. Paste Content', description: 'Input raw academic text', status: 'completed' },
    { id: 'analyze', label: '2. Analyze', description: 'Scan structure, math & citations', status: 'pending' },
    { id: 'clean', label: '3. Clean', description: 'Strip conversational noise', status: 'pending' },
    { id: 'format', label: '4. Format', description: 'Construct academic AST', status: 'pending' },
    { id: 'preview', label: '5. Preview', description: 'Inspect formatted sheets', status: 'pending' },
    { id: 'export', label: '6. Export', description: 'Download DOCX or PDF', status: 'pending' },
  ]);

  const updateStepStatus = useCallback((stepId: WorkflowStep['id'], status: WorkflowStep['status']) => {
    setWorkflowSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  }, []);

  const clearError = useCallback(() => setErrorInfo(null), []);
  const clearSuccess = useCallback(() => setSuccessBanner(null), []);

  // 1. Analyze Document
  const analyzeContent = useCallback(async () => {
    if (!rawText.trim()) {
      setErrorInfo({
        operation: 'Analyze',
        message: 'Cannot analyze empty text. Please paste academic content or select a sample document.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setActiveOperation('analyzing');
    setOperationDescription('Analyzing document structure, formulas, and conversational artifacts...');
    setProgressPercent(20);
    setErrorInfo(null);
    clearSuccess();
    updateStepStatus('analyze', 'active');

    try {
      const res = await apiClient.analyzeDocument(rawText);
      setAnalysisResult(res);
      updateStepStatus('analyze', 'completed');
      setSuccessBanner({
        message: `Analysis complete: ${res.word_count} words, ${res.detected_math_count} math formulas, ${res.detected_citations_count} citations detected.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      updateStepStatus('analyze', 'error');
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setErrorInfo({
        operation: 'Analyze',
        message: msg,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setActiveOperation('idle');
      setOperationDescription('');
      setProgressPercent(0);
    }
  }, [rawText, updateStepStatus, clearSuccess]);

  // 2. Clean Content
  const cleanContent = useCallback(async () => {
    if (!rawText.trim()) {
      setErrorInfo({
        operation: 'Clean',
        message: 'Cannot clean empty text.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setActiveOperation('cleaning');
    setOperationDescription('Sanitizing conversational AI intros, signoffs, and syntax artifacts...');
    setProgressPercent(40);
    setErrorInfo(null);
    clearSuccess();
    updateStepStatus('clean', 'active');

    try {
      const res = await apiClient.cleanDocument(rawText);
      setCleanResult(res);
      setRawText(res.cleaned_text);
      updateStepStatus('clean', 'completed');
      setSuccessBanner({
        message: `Content sanitized: removed ${res.artifacts_removed} characters of conversational noise while preserving academic content.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      updateStepStatus('clean', 'error');
      const msg = err instanceof Error ? err.message : 'Cleanup failed';
      setErrorInfo({
        operation: 'Clean',
        message: msg,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setActiveOperation('idle');
      setOperationDescription('');
      setProgressPercent(0);
    }
  }, [rawText, updateStepStatus, clearSuccess]);

  // 3. Format Document (Construct Academic AST)
  const formatDocument = useCallback(async () => {
    if (!rawText.trim()) {
      setErrorInfo({
        operation: 'Format',
        message: 'Cannot format empty text.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setActiveOperation('formatting');
    setOperationDescription('Executing formatting pipeline: headings, typography, tables, and math AST...');
    setProgressPercent(60);
    setErrorInfo(null);
    clearSuccess();
    updateStepStatus('format', 'active');

    try {
      const res = await apiClient.processDocument({
        raw_text: rawText,
        title: title.trim() || undefined,
        citation_style: citationStyle,
        preset,
      });

      setStructuredDocument(res.document);
      if (res.document.title && !title.trim()) {
        setTitle(res.document.title);
      }
      updateStepStatus('format', 'completed');
      updateStepStatus('preview', 'completed');
      setSuccessBanner({
        message: `Document structured successfully: ${res.document.blocks.length} semantic blocks, ${res.document.statistics.word_count} words ready for preview & export.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      updateStepStatus('format', 'error');
      const msg = err instanceof Error ? err.message : 'Formatting failed';
      setErrorInfo({
        operation: 'Format',
        message: msg,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setActiveOperation('idle');
      setOperationDescription('');
      setProgressPercent(0);
    }
  }, [rawText, title, citationStyle, preset, updateStepStatus, clearSuccess]);

  // 4. Run Full Pipeline in One Sequence
  const runFullPipeline = useCallback(async () => {
    if (!rawText.trim()) {
      setErrorInfo({
        operation: 'Pipeline',
        message: 'Cannot run pipeline on empty content.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setErrorInfo(null);
    clearSuccess();

    // Step A: Analyze
    setActiveOperation('analyzing');
    setOperationDescription('Step 1/3: Analyzing document structure and formula semantics...');
    setProgressPercent(25);
    updateStepStatus('analyze', 'active');

    let currentText = rawText;
    try {
      const aRes = await apiClient.analyzeDocument(currentText);
      setAnalysisResult(aRes);
      updateStepStatus('analyze', 'completed');

      // Step B: Clean
      setActiveOperation('cleaning');
      setOperationDescription('Step 2/3: Stripping conversational AI preambles and formatting artifacts...');
      setProgressPercent(55);
      updateStepStatus('clean', 'active');

      const cRes = await apiClient.cleanDocument(currentText);
      setCleanResult(cRes);
      currentText = cRes.cleaned_text;
      setRawText(currentText);
      updateStepStatus('clean', 'completed');

      // Step C: Format
      setActiveOperation('formatting');
      setOperationDescription('Step 3/3: Constructing academic AST, styling headings, tables, and math...');
      setProgressPercent(85);
      updateStepStatus('format', 'active');

      const pRes = await apiClient.processDocument({
        raw_text: currentText,
        title: title.trim() || undefined,
        citation_style: citationStyle,
        preset,
      });

      setStructuredDocument(pRes.document);
      if (pRes.document.title && !title.trim()) {
        setTitle(pRes.document.title);
      }
      updateStepStatus('format', 'completed');
      updateStepStatus('preview', 'completed');

      setSuccessBanner({
        message: `Pipeline complete! Document structured into ${pRes.document.blocks.length} blocks. Ready to export.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pipeline execution encountered an error';
      setErrorInfo({
        operation: 'Pipeline Execution',
        message: msg,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setActiveOperation('idle');
      setOperationDescription('');
      setProgressPercent(0);
    }
  }, [rawText, title, citationStyle, preset, updateStepStatus, clearSuccess]);

  // 5. Export DOCX
  const exportDocx = useCallback(async () => {
    setActiveOperation('exporting_docx');
    setOperationDescription('Generating Microsoft Word (.docx) package with native Office Math markup...');
    setErrorInfo(null);
    clearSuccess();
    updateStepStatus('export', 'active');

    try {
      const { blob, filename } = await apiClient.exportDocx({
        document: structuredDocument || undefined,
        raw_text: structuredDocument ? undefined : rawText,
        preset,
        title: title.trim() || undefined,
        citation_style: citationStyle,
        include_page_numbers: includePageNumbers,
        include_header: includeHeader,
      });

      downloadBlob(blob, filename);

      const info: LastExportInfo = {
        format: 'docx',
        filename,
        sizeBytes: blob.size,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLastExport(info);
      updateStepStatus('export', 'completed');
      setSuccessBanner({
        message: `DOCX export complete: "${filename}" (${Math.round(blob.size / 1024)} KB) downloaded successfully.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      updateStepStatus('export', 'error');
      const msg = err instanceof Error ? err.message : 'DOCX export failed';
      setErrorInfo({
        operation: 'Export DOCX',
        message: msg,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setActiveOperation('idle');
      setOperationDescription('');
    }
  }, [structuredDocument, rawText, preset, title, citationStyle, includePageNumbers, includeHeader, updateStepStatus, clearSuccess]);

  // 6. Export PDF
  const exportPdf = useCallback(async () => {
    setActiveOperation('exporting_pdf');
    setOperationDescription('Compiling publication-grade PDF with ReportLab vector engine...');
    setErrorInfo(null);
    clearSuccess();
    updateStepStatus('export', 'active');

    try {
      const { blob, filename } = await apiClient.exportPdf({
        document: structuredDocument || undefined,
        raw_text: structuredDocument ? undefined : rawText,
        preset,
        title: title.trim() || undefined,
        citation_style: citationStyle,
        include_page_numbers: includePageNumbers,
        include_header: includeHeader,
      });

      downloadBlob(blob, filename);

      const info: LastExportInfo = {
        format: 'pdf',
        filename,
        sizeBytes: blob.size,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLastExport(info);
      updateStepStatus('export', 'completed');
      setSuccessBanner({
        message: `PDF export complete: "${filename}" (${Math.round(blob.size / 1024)} KB) downloaded successfully.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      updateStepStatus('export', 'error');
      const msg = err instanceof Error ? err.message : 'PDF export failed';
      setErrorInfo({
        operation: 'Export PDF',
        message: msg,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setActiveOperation('idle');
      setOperationDescription('');
    }
  }, [structuredDocument, rawText, preset, title, citationStyle, includePageNumbers, includeHeader, updateStepStatus, clearSuccess]);

  // Load Sample Document
  const loadSample = useCallback((sampleId: string) => {
    const found = SAMPLE_DOCUMENTS.find((s) => s.id === sampleId);
    if (found) {
      setRawText(found.content);
      setTitle(found.title);
      setAnalysisResult(null);
      setCleanResult(null);
      setStructuredDocument(null);
      setErrorInfo(null);
      setSuccessBanner({
        message: `Loaded sample: "${found.title}". Click "Analyze" or "Run Full Pipeline" to begin.`,
        timestamp: new Date().toLocaleTimeString(),
      });
      setWorkflowSteps([
        { id: 'paste', label: '1. Paste Content', description: 'Sample document loaded', status: 'completed' },
        { id: 'analyze', label: '2. Analyze', description: 'Scan structure, math & citations', status: 'pending' },
        { id: 'clean', label: '3. Clean', description: 'Strip conversational noise', status: 'pending' },
        { id: 'format', label: '4. Format', description: 'Construct academic AST', status: 'pending' },
        { id: 'preview', label: '5. Preview', description: 'Inspect formatted sheets', status: 'pending' },
        { id: 'export', label: '6. Export', description: 'Download DOCX or PDF', status: 'pending' },
      ]);
    }
  }, []);

  // Clear Editor
  const clearEditor = useCallback(() => {
    setRawText('');
    setTitle('');
    setAnalysisResult(null);
    setCleanResult(null);
    setStructuredDocument(null);
    setErrorInfo(null);
    setSuccessBanner(null);
    setWorkflowSteps([
      { id: 'paste', label: '1. Paste Content', description: 'Waiting for academic text input', status: 'active' },
      { id: 'analyze', label: '2. Analyze', description: 'Scan structure, math & citations', status: 'pending' },
      { id: 'clean', label: '3. Clean', description: 'Strip conversational noise', status: 'pending' },
      { id: 'format', label: '4. Format', description: 'Construct academic AST', status: 'pending' },
      { id: 'preview', label: '5. Preview', description: 'Inspect formatted sheets', status: 'pending' },
      { id: 'export', label: '6. Export', description: 'Download DOCX or PDF', status: 'pending' },
    ]);
  }, []);

  return {
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
    cleanResult,
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
    setStructuredDocument,
    setActiveOperation,
    setOperationDescription,
    setErrorInfo,
    setSuccessBanner,
  };
}
