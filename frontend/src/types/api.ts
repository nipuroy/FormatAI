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
  description?: string;
  tier?: string;
  context_length?: number;
  is_default?: boolean;
}

export interface AIProviderDescriptor {
  id: string;
  name: string;
  description: string;
  is_configured: boolean;
  is_enabled: boolean;
  default_model?: string;
  supports_discovery: boolean;
  requires_base_url: boolean;
}

export interface ProviderSpecificConfig {
  api_key?: string;
  base_url?: string;
  enabled?: boolean;
  timeout_seconds?: number;
  max_retries?: number;
  default_model?: string;
}

export interface ProviderValidationResult {
  valid: boolean;
  provider: string;
  message: string;
  model_count?: number;
  details?: Record<string, unknown>;
}

export interface AIModelsResponse {
  provider: string;
  default_model: string;
  is_configured: boolean;
  models: AIModelDescriptor[];
}

export interface AIGenerateRequest {
  prompt: string;
  provider?: string;
  model?: string;
  temperature?: number;
  provider_config?: ProviderSpecificConfig;
  fallback_providers?: string[];
  timeout?: number;
}

export interface AIGenerateResponse {
  success: boolean;
  provider: string;
  model: string;
  content: string;
  finish_reason?: string;
  fallback_occurred?: boolean;
  attempted_providers?: string[];
  metadata?: Record<string, unknown>;
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
