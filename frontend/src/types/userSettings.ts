/**
 * Type definitions for FormatAI Client-Side User Settings.
 *
 * ALL data defined in this schema is strictly USER-LOCAL.
 * Under NO circumstances should these settings be sent to or stored in
 * any shared database, server-side store, or multi-tenant repository.
 */

import { CitationStyle, DocxPreset } from './document';

export type SupportedProviderId =
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'mistral'
  | 'cohere'
  | 'huggingface'
  | 'openai'
  | 'custom_openai';

export interface ProviderLocalSettings {
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  selectedModel?: string;
  timeoutSeconds: number;
}

export interface ActiveAISettings {
  selectedProvider: SupportedProviderId;
  selectedModel: string;
  fallbackProviders: SupportedProviderId[];
  temperature: number;
}

export interface FormattingPreferences {
  preset: DocxPreset;
  citationStyle: CitationStyle;
  includePageNumbers: boolean;
  includeHeader: boolean;
  fontFamily: string;
  fontSizePt: number;
  lineSpacing: number;
  marginInches: number;
}

export interface DocumentPreferences {
  autoCleanArtifacts: boolean;
  preserveMathEnvironments: boolean;
  defaultExportFormat: 'docx' | 'pdf';
  autoAnalyzeOnChange: boolean;
}

export interface UIPreferences {
  themeMode: 'dark' | 'light' | 'system';
  previewZoomPercent: number;
  compactControls: boolean;
  showDocumentStats: boolean;
  activeMobileTab: 'editor' | 'preview';
}

export interface SkillPreferences {
  academicSynthesisEnabled: boolean;
  latexStandardizationEnabled: boolean;
  conversationalDenoisingEnabled: boolean;
  strictCitationFormatting: boolean;
}

export interface UserSettingsSchema {
  version: number;
  clientInstanceId: string;
  updatedAt: string;
  providers: Record<SupportedProviderId, ProviderLocalSettings>;
  activeAI: ActiveAISettings;
  formatting: FormattingPreferences;
  document: DocumentPreferences;
  ui: UIPreferences;
  skills: SkillPreferences;
}

export const USER_SETTINGS_SCHEMA_VERSION = 1;
export const USER_SETTINGS_STORAGE_KEY = 'formatai_client_settings_v1';
export const CLIENT_INSTANCE_ID_KEY = 'formatai_client_instance_uuid';
