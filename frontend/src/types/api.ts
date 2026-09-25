import { AcademicDocument, CitationStyle, DocxPreset } from './document';

export interface HealthCheckResponse {
  status: string;
  service: string;
  backend: string;
}

export interface FormattingRequestSkeleton {
  raw_text: string;
  title?: string;
  citation_style?: CitationStyle;
  preset?: DocxPreset;
}

export interface DocumentProcessResponse {
  success: boolean;
  document: AcademicDocument;
  message: string;
}

export interface ContentAnalysisResponse {
  success: boolean;
  word_count: number;
  char_count: number;
  line_count: number;
  estimated_read_time_minutes: number;
  detected_citations_count: number;
  detected_math_count: number;
  detected_chemicals_count: number;
  detected_scientific_count: number;
  heading_count: number;
  has_ai_conversational_chatter: boolean;
  summary: string;
}

export interface ContentCleanResponse {
  success: boolean;
  cleaned_text: string;
  original_char_count: number;
  cleaned_char_count: number;
  artifacts_removed: number;
  changes_applied: string[];
  message: string;
}

export interface DocxExportRequest {
  document?: AcademicDocument;
  raw_text?: string;
  preset?: DocxPreset;
  title?: string;
  citation_style?: CitationStyle;
  include_page_numbers?: boolean;
  include_header?: boolean;
}

export interface PdfExportRequest {
  document?: AcademicDocument;
  raw_text?: string;
  preset?: DocxPreset;
  title?: string;
  citation_style?: CitationStyle;
  include_page_numbers?: boolean;
  include_header?: boolean;
}

export interface AIModelDescriptor {
  id: string;
  name: string;
  description: string;
  tier: string;
}

export interface AIModelsResponse {
  provider: string;
  default_model: string;
  is_configured: boolean;
  models: AIModelDescriptor[];
}

export interface AIGenerateRequest {
  prompt: string;
  system_instruction?: string;
  model?: string;
  temperature?: number;
  max_output_tokens?: number;
}

export interface AIGenerateResponse {
  success: boolean;
  provider: string;
  model: string;
  content: string;
  finish_reason?: string;
}

export type OperationType =
  | 'idle'
  | 'analyzing'
  | 'cleaning'
  | 'formatting'
  | 'exporting_docx'
  | 'exporting_pdf'
  | 'ai_generating'
  | 'health_check';

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface WorkflowStep {
  id: 'paste' | 'analyze' | 'clean' | 'format' | 'preview' | 'export';
  label: string;
  description: string;
  status: StepStatus;
}
