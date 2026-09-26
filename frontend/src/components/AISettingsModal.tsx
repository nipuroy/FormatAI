import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  X,
  Cpu,
  Check,
  Loader2,
  Wand2,
  Send,
  AlertCircle,
  Key,
  Globe,
  RefreshCw,
  Power,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { apiClient } from '../services/api';
import {
  AIModelDescriptor,
  AIProviderDescriptor,
  ProviderValidationResult,
  AIGenerateResponse,
} from '../types/api';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  onApplyAIText: (newText: string) => void;
}

interface LocalProviderConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  selectedModel: string;
  timeoutSeconds: number;
}

const STORAGE_KEY = 'formatai_provider_configs_v1';

export function AISettingsModal({
  isOpen,
  onClose,
  currentText,
  onApplyAIText,
}: AISettingsModalProps) {
  // Provider list from backend
  const [providers, setProviders] = useState<AIProviderDescriptor[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');

  // Client-stored per-provider configs (isolated in localStorage, never sent to shared DB)
  const [configs, setConfigs] = useState<Record<string, LocalProviderConfig>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  // Models for selected provider
  const [models, setModels] = useState<AIModelDescriptor[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // Validation state
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ProviderValidationResult | null>(null);

  // Generation options
  const [temperature, setTemperature] = useState<number>(0.2);
  const [fallbackProviderId, setFallbackProviderId] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationResponse, setGenerationResponse] = useState<AIGenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showKey, setShowKey] = useState<boolean>(false);

  // Active provider config helper
  const activeConfig: LocalProviderConfig = configs[selectedProviderId] || {
    apiKey: '',
    baseUrl: '',
    enabled: true,
    selectedModel: '',
    timeoutSeconds: 30,
  };

  const updateProviderConfig = useCallback(
    (providerId: string, updates: Partial<LocalProviderConfig>) => {
      setConfigs((prev) => {
        const next = {
          ...prev,
          [providerId]: {
            ...(prev[providerId] || {
              apiKey: '',
              baseUrl: '',
              enabled: true,
              selectedModel: '',
              timeoutSeconds: 30,
            }),
            ...updates,
          },
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    },
    []
  );

  const updateActiveConfig = (updates: Partial<LocalProviderConfig>) => {
    updateProviderConfig(selectedProviderId, updates);
  };

  // Load supported providers on open
  useEffect(() => {
    if (isOpen) {
      apiClient
        .getSupportedProviders()
        .then((res) => {
          setProviders(res);
          if (!selectedProviderId && res.length > 0) {
            setSelectedProviderId(res[0].id);
          }
        })
        .catch(() => {
          // Fallback static provider catalog
          setProviders([
            { id: 'gemini', name: 'Google Gemini', description: 'Google frontier multimodal models', is_configured: true, is_enabled: true, supports_discovery: true, requires_base_url: false, default_model: 'gemini-3.8-flash' },
            { id: 'groq', name: 'Groq', description: 'Ultra-fast LPU inference', is_configured: false, is_enabled: true, supports_discovery: true, requires_base_url: false, default_model: 'llama-3.3-70b-versatile' },
            { id: 'openrouter', name: 'OpenRouter', description: 'Unified multi-model router', is_configured: false, is_enabled: true, supports_discovery: true, requires_base_url: false, default_model: 'meta-llama/llama-3.3-70b-instruct' },
            { id: 'mistral', name: 'Mistral AI', description: 'Frontier European models', is_configured: false, is_enabled: true, supports_discovery: true, requires_base_url: false, default_model: 'mistral-large-latest' },
            { id: 'cohere', name: 'Cohere', description: 'Command R+ enterprise intelligence', is_configured: false, is_enabled: true, supports_discovery: true, requires_base_url: false, default_model: 'command-r-plus-08-2024' },
            { id: 'huggingface', name: 'Hugging Face', description: 'Serverless open models', is_configured: false, is_enabled: true, supports_discovery: false, requires_base_url: false, default_model: 'meta-llama/Meta-Llama-3-8B-Instruct' },
            { id: 'openai', name: 'OpenAI', description: 'GPT-4o and reasoning models', is_configured: false, is_enabled: true, supports_discovery: true, requires_base_url: false, default_model: 'gpt-4o-mini' },
            { id: 'custom_openai', name: 'Custom OpenAI Endpoint', description: 'Ollama, vLLM, LMStudio, or private proxy', is_configured: false, is_enabled: true, supports_discovery: true, requires_base_url: true, default_model: 'llama3' },
          ]);
        });
    }
  }, [isOpen, selectedProviderId]);

  // Load models for selected provider
  const loadModels = useCallback(async (providerId: string) => {
    setIsLoadingModels(true);
    setValidationResult(null);
    try {
      const result = await apiClient.getProviderModels(providerId);
      setModels(result);

      // Validate that currently stored model belongs to this provider
      const storedModel = configs[providerId]?.selectedModel;
      const isValid = result.some((m) => m.id === storedModel);
      if (!isValid && result.length > 0) {
        const def = result.find((m) => m.is_default) || result[0];
        updateProviderConfig(providerId, { selectedModel: def.id });
      }
    } catch {
      setModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [configs, updateProviderConfig]);

  useEffect(() => {
    if (isOpen && selectedProviderId) {
      loadModels(selectedProviderId);
    }
  }, [isOpen, selectedProviderId, loadModels]);

  if (!isOpen) return null;

  // Validate current provider
  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    setErrorMsg(null);
    try {
      const res = await apiClient.validateProvider(selectedProviderId, {
        api_key: activeConfig.apiKey || undefined,
        base_url: activeConfig.baseUrl || undefined,
        model: activeConfig.selectedModel || undefined,
      });
      setValidationResult(res);
      if (res.valid) {
        // Refresh models
        loadModels(selectedProviderId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Validation failed';
      setValidationResult({
        valid: false,
        provider: selectedProviderId,
        message: msg,
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Generate action
  const handleGenerate = async (customPrompt?: string) => {
    const activePrompt = customPrompt || prompt;
    if (!activePrompt.trim() && !currentText.trim()) {
      setErrorMsg('Please specify a prompt or provide document text.');
      return;
    }

    if (selectedProviderId === 'custom_openai' && !activeConfig.baseUrl?.trim()) {
      setErrorMsg('Please specify an endpoint Base URL for Custom OpenAI (e.g. https://your-server-or-tunnel/v1).');
      return;
    }

    if (!activeConfig.enabled) {
      setErrorMsg(`Provider '${selectedProviderId}' is currently disabled. Please enable it before sending requests.`);
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setGenerationResponse(null);

    // Safeguard: Ensure model belongs to the selected provider
    const isModelValid = models.some((m) => m.id === activeConfig.selectedModel);
    const targetModel = isModelValid
      ? activeConfig.selectedModel
      : (models.find((m) => m.is_default)?.id || models[0]?.id || selectedProviderMeta?.default_model);

    const fullPrompt = activePrompt
      ? `${activePrompt}\n\nContext document:\n${currentText.slice(0, 10000)}`
      : `Please refine and structure this academic text according to high-standard research publication conventions:\n\n${currentText.slice(0, 10000)}`;

    try {
      const res = await apiClient.generateAI({
        prompt: fullPrompt,
        provider: selectedProviderId,
        model: targetModel,
        temperature,
        timeout: activeConfig.timeoutSeconds || 30,
        provider_config: {
          api_key: activeConfig.apiKey || undefined,
          base_url: activeConfig.baseUrl || undefined,
          enabled: activeConfig.enabled,
          default_model: targetModel,
          timeout_seconds: activeConfig.timeoutSeconds || 30,
        },
        fallback_providers: fallbackProviderId ? [fallbackProviderId] : undefined,
      });

      setGenerationResponse(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generationResponse?.content) {
      navigator.clipboard.writeText(generationResponse.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectedProviderMeta = providers.find((p) => p.id === selectedProviderId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-slate-800 flex items-center gap-2">
                AI Multi-Provider Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  Isolated Adapters
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Choose and configure your preferred AI provider, model, keys, and optional fallbacks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Left Providers Nav, Right Configuration & Generation */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* Provider List Sidebar */}
          <div className="md:col-span-4 border-r border-slate-200 bg-slate-50/70 p-3 overflow-y-auto space-y-1.5">
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Target Providers
            </div>
            {providers.map((p) => {
              const isSelected = p.id === selectedProviderId;
              const pConfig = configs[p.id];
              const isEnabled = pConfig?.enabled ?? p.is_enabled;
              const hasCustomKey = Boolean(pConfig?.apiKey);
              const isConfigured = hasCustomKey || p.is_configured || (p.id === 'custom_openai' && Boolean(pConfig?.baseUrl));

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProviderId(p.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                      : 'bg-white/60 hover:bg-white border-slate-200 text-slate-700'
                  } ${!isEnabled ? 'opacity-55' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Cpu className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      {p.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {!isEnabled ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                          Disabled
                        </span>
                      ) : isConfigured ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Ready
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          Setup
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{p.description}</p>
                </button>
              );
            })}

            <div className="pt-3 px-2">
              <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100/80 text-[11px] text-indigo-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Key Leakage:</strong> Provider credentials are client-isolated in local browser session storage. They are never shared across providers or stored in a database.
                </span>
              </div>
            </div>
          </div>

          {/* Configuration and Prompting Area */}
          <div className="md:col-span-8 p-6 overflow-y-auto space-y-6">
            {/* Provider Configuration Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    {selectedProviderMeta?.name || selectedProviderId}
                    {activeConfig.enabled ? (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600 font-medium">Disabled</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedProviderMeta?.description}</p>
                </div>

                {/* Enable/Disable Switch */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Provider Status:</span>
                  <button
                    onClick={() => updateActiveConfig({ enabled: !activeConfig.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      activeConfig.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                    title={activeConfig.enabled ? 'Disable Provider' : 'Enable Provider'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        activeConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Provider Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* API Key Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-slate-400" />
                      API Key / Access Token
                    </span>
                    {selectedProviderMeta?.is_configured && !activeConfig.apiKey && (
                      <span className="text-[10px] text-emerald-600 font-normal">Env Key Available</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={activeConfig.apiKey}
                      onChange={(e) => updateActiveConfig({ apiKey: e.target.value })}
                      placeholder={selectedProviderMeta?.is_configured ? 'Using system default key (or enter custom)' : 'Enter API Key...'}
                      className="w-full pl-3 pr-16 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1.5 text-[10px] text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded bg-slate-100"
                    >
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Never shared with other adapters.</p>
                </div>

                {/* Base URL (prominent for Custom OpenAI, optional for others) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    Endpoint Base URL {selectedProviderId === 'custom_openai' ? '(Required)' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    value={activeConfig.baseUrl}
                    onChange={(e) => updateActiveConfig({ baseUrl: e.target.value })}
                    placeholder={selectedProviderId === 'custom_openai' ? 'https://xxxx.ngrok-free.app/v1 or http://host:11434/v1' : 'Default API URL'}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  {selectedProviderId === 'custom_openai' && (activeConfig.baseUrl.includes('localhost') || activeConfig.baseUrl.includes('127.0.0.1')) ? (
                    <p className="text-[10px] text-amber-700 mt-1 p-1.5 bg-amber-50 rounded border border-amber-200 leading-tight">
                      <strong>Cloud note:</strong> This application runs in the cloud. Accessing a local Ollama or LM Studio model requires a public tunnel (e.g. ngrok or Cloudflare tunnel).
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      {selectedProviderId === 'custom_openai'
                        ? 'Point to your Ollama, LM Studio, vLLM, or enterprise LLM gateway.'
                        : 'Leave blank to use standard official endpoint.'}
                    </p>
                  )}
                </div>

                {/* Model Selection & Discovery */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Model Selection</label>
                    <button
                      onClick={() => loadModels(selectedProviderId)}
                      disabled={isLoadingModels}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                      Discover
                    </button>
                  </div>

                  <div className="relative">
                    <select
                      value={
                        models.some((m) => m.id === activeConfig.selectedModel)
                          ? activeConfig.selectedModel
                          : (models.find((m) => m.is_default)?.id || models[0]?.id || '')
                      }
                      onChange={(e) => updateActiveConfig({ selectedModel: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    >
                      {models.length === 0 && (
                        <option value="">
                          {selectedProviderMeta?.default_model || 'Default Model'}
                        </option>
                      )}
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.tier ? `(${m.tier})` : ''} {m.is_default ? '★' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Explicit Fallback Option */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    Explicit Fallback (Optional)
                  </label>
                  <select
                    value={fallbackProviderId}
                    onChange={(e) => setFallbackProviderId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">No Fallback (Fail Directly)</option>
                    {providers
                      .filter((p) => p.id !== selectedProviderId && (configs[p.id]?.enabled ?? p.is_enabled))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          Fall back to {p.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Only triggered if primary provider fails.
                  </p>
                </div>
              </div>

              {/* Validation Action and Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <Power className="w-3.5 h-3.5 text-slate-600" />
                      Test Connection & Credentials
                    </>
                  )}
                </button>

                {validationResult && (
                  <div
                    className={`text-xs px-3 py-1 rounded-lg flex items-center gap-1.5 ${
                      validationResult.valid
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    )}
                    <span>{validationResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Academic Prompting & Text Refinement Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-indigo-600" />
                  Academic Enhancement & Synthesis
                </h3>
                <span className="text-xs text-slate-400">
                  Target: <strong className="text-slate-700">{selectedProviderMeta?.name}</strong> (
                  {activeConfig.selectedModel || selectedProviderMeta?.default_model})
                </span>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleGenerate(
                      'Refactor this research paper according to standard IEEE/APA academic paper conventions with rigorous structure and clear hierarchy:'
                    )
                  }
                  className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs transition-colors"
                >
                  Formal Academic Structure
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleGenerate(
                      'Standardize all mathematical equations and formulas in this document into clean, standard LaTeX notation ($...$ and $$...$$):'
                    )
                  }
                  className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs transition-colors"
                >
                  Standardize LaTeX Math
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleGenerate(
                      'Eliminate conversational artifacts and synthesize author content with high academic rigor while preserving all findings:'
                    )
                  }
                  className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs transition-colors"
                >
                  Clean AI Artifacts
                </button>
              </div>

              {/* Custom Prompt Textarea */}
              <div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter custom formatting, synthesis, or restructuring instruction (optional)..."
                  rows={2}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                />
              </div>

              {/* Execute Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Temp: {temperature}</span>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || !activeConfig.enabled}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Querying {selectedProviderMeta?.name}...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Run AI Assistant
                    </>
                  )}
                </button>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Generation Error</p>
                    <p>{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Generation Output Preview */}
              {generationResponse && (
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Generated Result via {generationResponse.provider} ({generationResponse.model})
                      {generationResponse.fallback_occurred && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium">
                          Fallback Utilized
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs flex items-center gap-1 font-medium transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => {
                          onApplyAIText(generationResponse.content);
                          onClose();
                        }}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                      >
                        Apply to Document
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs text-slate-800 font-mono max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {generationResponse.content}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>8 Supported Providers: Gemini, Groq, OpenRouter, Mistral, Cohere, Hugging Face, OpenAI, Custom OpenAI</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
