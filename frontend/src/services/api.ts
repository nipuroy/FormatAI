/**
 * Dedicated API Client for communicating with the FormatAI Python FastAPI backend.
 * Uses environment variable for backend URL resolution and handles errors centrally.
 */

import {
  AIModelDescriptor,
  AIModelsResponse,
  AIProviderDescriptor,
  AIGenerateRequest,
  AIGenerateResponse,
  ContentAnalysisResponse,
  ContentCleanResponse,
  DocumentProcessResponse,
  DocxExportRequest,
  FormattingRequestSkeleton,
  HealthCheckResponse,
  PdfExportRequest,
  ProviderValidationResult,
} from '../types/api';

/**
 * Resolves the backend base URL using the VITE_API_URL environment variable.
 * When running behind the Vite dev server proxy, an empty string defaults to relative '/api'.
 */
export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  return '';
}

export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 60000,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails: unknown = null;
      try {
        const errorJson = await response.json();
        errorDetails = errorJson;
        if (errorJson.detail) {
          errorMessage = typeof errorJson.detail === 'string'
            ? errorJson.detail
            : JSON.stringify(errorJson.detail);
        } else if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // Fall back to HTTP status message if non-JSON body
      }
      throw new ApiError(errorMessage, response.status, errorDetails);
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timed out while waiting for backend response.', 408);
      }
      throw new ApiError(`Network error: ${error.message}`, 0);
    }
    throw new ApiError('An unexpected error occurred during API request.', 0);
  } finally {
    clearTimeout(timer);
  }
}

async function requestBlob(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 60000,
): Promise<{ blob: Blob; filename: string }> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `Export failed with HTTP ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) {
          errorMessage = typeof errorJson.detail === 'string'
            ? errorJson.detail
            : JSON.stringify(errorJson.detail);
        }
      } catch {
        // Use default
      }
      throw new ApiError(errorMessage, response.status);
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    let filename = 'document';
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, '');
    }

    const blob = await response.blob();
    return { blob, filename };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Export request timed out.', 408);
      }
      throw new ApiError(`Export failed: ${error.message}`, 0);
    }
    throw new ApiError('An unknown error occurred while exporting file.', 0);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Singleton API Client export.
 */
export const apiClient = {
  /**
   * Ping backend health endpoint.
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    return request<HealthCheckResponse>('/api/health', { method: 'GET' }, 5000);
  },

  /**
   * Analyze unformatted text metrics, formulas, headings, and AI noise.
   */
  async analyzeDocument(rawText: string): Promise<ContentAnalysisResponse> {
    return request<ContentAnalysisResponse>('/api/documents/analyze', {
      method: 'POST',
      body: JSON.stringify({ raw_text: rawText }),
    });
  },

  /**
   * Strip conversational AI prefixes, signoffs, and extraneous chatter.
   */
  async cleanDocument(rawText: string): Promise<ContentCleanResponse> {
    return request<ContentCleanResponse>('/api/documents/clean', {
      method: 'POST',
      body: JSON.stringify({ raw_text: rawText }),
    });
  },

  /**
   * Run the complete academic processing pipeline and obtain structured AST.
   */
  async processDocument(
    params: FormattingRequestSkeleton,
  ): Promise<DocumentProcessResponse> {
    return request<DocumentProcessResponse>('/api/documents/process', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Export document to genuine Microsoft Word (.docx) file.
   */
  async exportDocx(
    params: DocxExportRequest,
  ): Promise<{ blob: Blob; filename: string }> {
    return requestBlob('/api/documents/docx', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Export document to publication-grade PDF file.
   */
  async exportPdf(
    params: PdfExportRequest,
  ): Promise<{ blob: Blob; filename: string }> {
    return requestBlob('/api/documents/pdf', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Fetch all supported AI providers and their status.
   */
  async getSupportedProviders(): Promise<AIProviderDescriptor[]> {
    return request<AIProviderDescriptor[]>('/api/ai/providers', { method: 'GET' }, 8000);
  },

  /**
   * Fetch discovered or curated models for a specific AI provider.
   */
  async getProviderModels(providerName: string): Promise<AIModelDescriptor[]> {
    return request<AIModelDescriptor[]>(`/api/ai/providers/${encodeURIComponent(providerName)}/models`, { method: 'GET' }, 10000);
  },

  /**
   * Validate provider credentials and connectivity without running full generation.
   */
  async validateProvider(
    providerName: string,
    config?: { api_key?: string; base_url?: string; model?: string },
  ): Promise<ProviderValidationResult> {
    return request<ProviderValidationResult>(
      `/api/ai/providers/${encodeURIComponent(providerName)}/validate`,
      {
        method: 'POST',
        body: JSON.stringify(config || {}),
      },
      12000,
    );
  },

  /**
   * Fetch available Gemini AI models (legacy/fallback).
   */
  async getAIModels(): Promise<AIModelsResponse> {
    return request<AIModelsResponse>('/api/ai/models', { method: 'GET' }, 8000);
  },

  /**
   * Request AI assistance or synthesis across any configured provider.
   */
  async generateAI(params: AIGenerateRequest): Promise<AIGenerateResponse> {
    return request<AIGenerateResponse>('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }, params.timeout ? params.timeout * 1000 : 45000);
  },
};
