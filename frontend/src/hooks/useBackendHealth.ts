import { useState, useEffect, useCallback, useRef } from 'react';
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

  const isCheckingRef = useRef<boolean>(false);

  const performCheck = useCallback(async (isManual: boolean = false) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    if (isManual) {
      setConnectionState('checking');
    }

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
      isCheckingRef.current = false;
    }
  }, []);

  const checkHealth = useCallback(async () => {
    await performCheck(true);
  }, [performCheck]);

  useEffect(() => {
    // Initial connection check
    performCheck(true);

    // Stable background heartbeat without state recursion
    const interval = setInterval(() => {
      performCheck(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [performCheck]);

  return {
    connectionState,
    healthData,
    latencyMs,
    lastChecked,
    errorMessage,
    checkHealth,
  };
}
