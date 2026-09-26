import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import { HealthCheckResponse } from '../types/api';

export type BackendConnectionState = 'checking' | 'connected' | 'offline';

export interface UseBackendHealthResult {
  connectionState: BackendConnectionState;
  healthData: HealthCheckResponse | null;
  latencyMs: number | null;
  lastChecked: string | null;
  errorMessage: string | null;
  checkHealth: () => Promise<void>;
}

export function useBackendHealth(): UseBackendHealthResult {
  const [connectionState, setConnectionState] = useState<BackendConnectionState>('checking');
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setConnectionState((prev) => (prev === 'offline' ? 'checking' : prev));
    setErrorMessage(null);
    const start = performance.now();

    try {
      const data = await apiClient.checkHealth();
      const elapsed = Math.round(performance.now() - start);
      setHealthData(data);
      setLatencyMs(elapsed);
      setConnectionState('connected');
      setErrorMessage(null);
    } catch (err: unknown) {
      setConnectionState('offline');
      setHealthData(null);
      setLatencyMs(null);
      const msg = err instanceof Error ? err.message : 'FastAPI backend is unreachable.';
      setErrorMessage(msg);
    } finally {
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    checkHealth();

    // Fast retry (3s) while establishing connection; 30s heartbeat when stable
    const intervalMs = connectionState === 'connected' ? 30000 : 3000;
    const timer = setTimeout(checkHealth, intervalMs);

    return () => clearTimeout(timer);
  }, [checkHealth, connectionState]);

  return {
    connectionState,
    healthData,
    latencyMs,
    lastChecked,
    errorMessage,
    checkHealth,
  };
}
