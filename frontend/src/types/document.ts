/**
 * Document AST and formatting model definitions matching backend Python models.
 */

export type BlockType =
  | 'title'
  | 'heading'
  | 'paragraph'
  | 'ordered_list'
  | 'unordered_list'
  | 'table'
  | 'blockquote'
  | 'code_block'
  | 'math_block'
  | 'thematic_break'
  | 'reference_entry';

export type CitationStyle = 'apa' | 'ieee' | 'mla' | 'harvard' | 'chicago';

export type DocxPreset =
  | 'academic'
  | 'research_paper'
  | 'exam'
  | 'study_notes'
  | 'textbook';

export interface DocumentBlock {
  id: string;
  block_type: BlockType;
  text: string;
  level?: number;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  alignments?: string[];
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentStatistics {
  word_count: number;
  character_count: number;
  paragraph_count: number;
  heading_count: number;
  estimated_pages: number;
  estimated_read_time_minutes: number;
}

export interface DocumentMetadata {
  doc_id: string;
  title?: string;
  citation_style?: CitationStyle;
  detected_citations?: string[];
  detected_chemicals?: string[];
  detected_scientific_terms?: string[];
  detected_math_expressions?: string[];
  created_at?: string;
}

export interface AcademicDocument {
  id: string;
  title?: string;
  abstract?: string;
  citation_style: CitationStyle;
  blocks: DocumentBlock[];
  references: string[];
  statistics: DocumentStatistics;
  metadata: DocumentMetadata;
}
