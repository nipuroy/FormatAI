/**
 * Frontend API Configuration for FormatAI.
 * Resolves API URL with graceful fallback for local development and proxying.
 */

export const getApiBaseUrl = (): string => {
  // 1. Check if VITE_API_URL is configured
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  // 2. Default to relative path (handled by Vite proxy in dev)
  return '';
};

export const API_TIMEOUT_MS = 4000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
