import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Terminal,
  Server,
  ShieldCheck,
  Check,
  Radio,
} from 'lucide-react';
import { getApiBaseUrl, fetchWithTimeout } from './config/api.ts';

interface BackendHealth {
  status: string;
  service: string;
  backend: string;
}

type ConnectionStatus = 'checking' | 'connected' | 'offline';

export default function App() {
  const [healthData, setHealthData] = useState<BackendHealth | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const checkBackendStatus = useCallback(async () => {
    setLoading(true);
    setErrorDetails(null);

    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/api/health`;

    try {
      const res = await fetchWithTimeout(endpoint, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }

      const data: BackendHealth = await res.json();
      setHealthData(data);
      setConnectionStatus('connected');
      setErrorDetails(null);
    } catch (err: unknown) {
      // Graceful fallback: do NOT crash the React app
      let message = 'Unable to reach Python FastAPI backend';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          message = 'Connection timed out while reaching FastAPI backend (port 8000)';
        } else {
          message = err.message;
        }
      }
      setHealthData(null);
      setConnectionStatus('offline');
      setErrorDetails(message);
    } finally {
      setLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    // Check connection asynchronously after initial render
    checkBackendStatus();
  }, [checkBackendStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">
              F
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">FormatAI</h1>
              <p className="text-xs text-slate-400 font-mono">Python + FastAPI Backend</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Check className="w-3.5 h-3.5" />
              Frontend is running
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 flex flex-col justify-center">
        {/* Banner Section */}
        <div className="text-center mb-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
            FormatAI
          </h2>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            AI-powered academic document formatting application
          </p>
          <div className="inline-flex flex-wrap items-center justify-center gap-2.5 mt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sm font-medium text-slate-300">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Python + FastAPI Backend</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-sm font-medium text-emerald-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Frontend is running</span>
            </div>
          </div>
        </div>

        {/* Backend Status Section */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800/80 gap-4">
            <div>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-indigo-400" />
                Backend Status
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Real-time connection monitor for the Python FastAPI service
              </p>
            </div>
            <button
              onClick={checkBackendStatus}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 transition-colors border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Checking...' : 'Refresh Status'}</span>
            </button>
          </div>

          <div className="mt-6">
            {connectionStatus === 'checking' && !healthData && (
              <div className="flex items-center justify-center py-10 text-slate-400 space-x-3">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-sm font-mono">Backend status: Checking...</span>
              </div>
            )}

            {connectionStatus === 'connected' && healthData && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-white">Backend: Connected</h4>
                    <p className="text-xs text-emerald-300/80 mt-0.5">
                      Successfully reached Python FastAPI backend at <code className="font-mono bg-emerald-950/60 px-1 py-0.5 rounded">/api/health</code>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</span>
                    <p className="mt-1 text-lg font-bold text-emerald-400 font-mono capitalize">
                      {healthData.status}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Service</span>
                    <p className="mt-1 text-lg font-bold text-white font-mono">
                      {healthData.service}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Backend Language</span>
                    <p className="mt-1 text-lg font-bold text-indigo-400 font-mono capitalize">
                      {healthData.backend}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs font-mono text-slate-400 block mb-2">Raw API Response (GET /api/health)</span>
                  <pre className="text-xs font-mono text-emerald-400 bg-slate-900 p-3 rounded-lg overflow-x-auto border border-slate-800">
                    {JSON.stringify(healthData, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {connectionStatus === 'offline' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <XCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-white">Backend: Offline</h4>
                    <p className="text-xs text-amber-200/80 mt-1">
                      {errorDetails || 'Python FastAPI backend is offline or unreachable in this runtime.'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <div className="flex items-center gap-2 mb-2 font-semibold text-slate-200">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>Run backend locally (in Python environment):</span>
                  </div>
                  <code className="block bg-slate-900 p-3 rounded-lg font-mono text-indigo-300 border border-slate-800 select-all">
                    uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
                  </code>
                  <p className="text-slate-400 text-xs mt-2">
                    In AI Studio preview, the Node.js container runs the Vite React frontend. When running locally or deploying to a full-stack environment, run both services side-by-side.
                  </p>
                </div>
              </div>
            )}

            {lastChecked && (
              <div className="mt-4 text-right">
                <span className="text-xs text-slate-500">Last checked: {lastChecked}</span>
              </div>
            )}
          </div>
        </div>

        {/* Features Preview / System Summary */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Architecture
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Independent React + TypeScript frontend with dedicated Python FastAPI backend.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              FastAPI Engine
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Pydantic-validated endpoints for health, document processing, and formatting.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-violet-400" />
              Academic Standards
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Structured pipeline for LaTeX, citations, tables, and DOCX generation.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-500">
        FormatAI &copy; {new Date().getFullYear()} &bull; Academic Document Formatting Application
      </footer>
    </div>
  );
}
