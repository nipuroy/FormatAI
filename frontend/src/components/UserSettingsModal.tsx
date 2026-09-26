import React, { useState } from 'react';
import {
  Shield,
  X,
  Sliders,
  Download,
  Upload,
  RotateCcw,
  Check,
  AlertTriangle,
  FileText,
  Lock,
  Eye,
  Server,
  Key,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { useUserSettings } from '../hooks/useUserSettings';
import { DocxPreset, CitationStyle } from '../types/document';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAISettings?: () => void;
}

export function UserSettingsModal({
  isOpen,
  onClose,
  onOpenAISettings,
}: UserSettingsModalProps) {
  const {
    settings,
    updateFormatting,
    updateDocument,
    updateUI,
    updateSkills,
    resetSettings,
    exportSettings,
    importSettings,
  } = useUserSettings();

  const [activeTab, setActiveTab] = useState<'preferences' | 'security' | 'portability'>('preferences');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(settings.clientInstanceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        importSettings(text);
        setImportStatus('Successfully imported local settings profile.');
        setTimeout(() => setImportStatus(null), 3000);
      } catch (err) {
        setImportStatus(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON file'}`);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                User Settings & Client Isolation
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Strictly Local
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Partitioned browser-local preferences and zero server-side exposure architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2">
          <button
            onClick={() => setActiveTab('preferences')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'preferences'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Formatting & Document Defaults
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'security'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Security & Isolation Model
          </button>
          <button
            onClick={() => setActiveTab('portability')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'portability'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Data Portability & Wipe
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-300 text-xs">
          {/* TAB 1: Preferences */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Quick AI Provider Shortcut Card */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    AI Provider & Credentials Hub
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure your 8 supported AI adapters (Gemini, Groq, OpenRouter, Mistral, Cohere, HuggingFace, OpenAI, Custom endpoints).
                  </p>
                </div>
                {onOpenAISettings && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAISettings();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Open AI Settings
                  </button>
                )}
              </div>

              {/* Formatting Defaults Section */}
              <div className="p-5 rounded-xl bg-slate-800/20 border border-slate-800 space-y-4">
                <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Default Formatting Preferences
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Default Layout Preset</label>
                    <select
                      value={settings.formatting.preset}
                      onChange={(e) => updateFormatting({ preset: e.target.value as DocxPreset })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="academic">Academic Standard (Formal, standard margins)</option>
                      <option value="modern">Modern Research (Sleek sans-serif, tight margins)</option>
                      <option value="minimal">Minimalist (Clean, understated typography)</option>
                      <option value="formal">Formal Archival (Bookman/Serif, wide margins)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Default Citation Standard</label>
                    <select
                      value={settings.formatting.citationStyle}
                      onChange={(e) => updateFormatting({ citationStyle: e.target.value as CitationStyle })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="apa">APA (Author, Year)</option>
                      <option value="ieee">IEEE [1] Numeric Index</option>
                      <option value="mla">MLA (Author Page)</option>
                      <option value="chicago">Chicago (Author-Date)</option>
                      <option value="harvard">Harvard (Author, Year)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Default Typography Font</label>
                    <select
                      value={settings.formatting.fontFamily}
                      onChange={(e) => updateFormatting({ fontFamily: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Times New Roman">Times New Roman (Academic Standard)</option>
                      <option value="Calibri">Calibri (Clean Technical)</option>
                      <option value="Arial">Arial (Neutral Sans)</option>
                      <option value="Georgia">Georgia (Legible Serif)</option>
                      <option value="Computer Modern">Computer Modern (LaTeX Aesthetic)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Default Font Size (pt)</label>
                    <select
                      value={settings.formatting.fontSizePt}
                      onChange={(e) => updateFormatting({ fontSizePt: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value={10}>10 pt (Compact)</option>
                      <option value={11}>11 pt (Standard Academic)</option>
                      <option value={12}>12 pt (Traditional Manuscript)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-6 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.formatting.includePageNumbers}
                      onChange={(e) => updateFormatting({ includePageNumbers: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Include Page Numbers in Footer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.formatting.includeHeader}
                      onChange={(e) => updateFormatting({ includeHeader: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Include Running Header Rule</span>
                  </label>
                </div>
              </div>

              {/* Document & Pipeline Behavior */}
              <div className="p-5 rounded-xl bg-slate-800/20 border border-slate-800 space-y-4">
                <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Document Processing Preferences
                </h4>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.document.autoCleanArtifacts}
                      onChange={(e) => updateDocument({ autoCleanArtifacts: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-slate-200">Automatically Strip LLM Conversational Preamble</span>
                      <p className="text-[11px] text-slate-400">
                        Removes "Here is your paper:", "Sure, I can help with that", and conversational closing lines during cleaning.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.document.preserveMathEnvironments}
                      onChange={(e) => updateDocument({ preserveMathEnvironments: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-slate-200">Strict LaTeX Math Preservation</span>
                      <p className="text-[11px] text-slate-400">
                        Maintains exact LaTeX formula delimiters ($...$ and $$...$$) and prevents accidental unicode equation conversions.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.skills.academicSynthesisEnabled}
                      onChange={(e) => updateSkills({ academicSynthesisEnabled: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-slate-200">Enable Academic Synthesis Skill Shortcuts</span>
                      <p className="text-[11px] text-slate-400">
                        Shows one-click academic transformation buttons (Abstract & Method Restructure, Equation Standardization).
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Security & Isolation Model */}
          {activeTab === 'security' && (
            <div className="space-y-5 leading-relaxed">
              {/* Profile Isolation Banner */}
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-start gap-3">
                <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Browser-Isolated User Profile</h4>
                  <p className="text-slate-300">
                    Your settings, API keys, selected models, and document preferences are stored <strong>strictly inside your browser instance</strong> using the Web Storage API. They are never written to any shared database, server-side session, or multi-tenant database.
                  </p>
                  <div className="pt-2 flex items-center gap-2 font-mono text-[11px] text-indigo-300">
                    <span>Client Profile UUID:</span>
                    <code className="bg-slate-900 px-2 py-0.5 rounded border border-indigo-900/60">
                      {settings.clientInstanceId}
                    </code>
                    <button
                      onClick={handleCopyId}
                      className="px-2 py-0.5 rounded bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-700/50 text-[10px] text-indigo-200 transition-colors"
                    >
                      {copiedId ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Critical Technical Concepts Distinction */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Isolation */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                    <Shield className="w-4 h-4" />
                    1. Isolation (Origin Boundary)
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Enforced by the browser’s <strong>Same-Origin Policy (SOP)</strong>. Only code executing within this exact domain and port can read or write to this storage partition. Different browser profiles, private windows, or independent users on other devices cannot access each other's data.
                  </p>
                </div>

                {/* 2. Confidentiality */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <Eye className="w-4 h-4" />
                    2. Confidentiality (Ephemeral Transit)
                  </div>
                  <p className="text-[11px] text-slate-300">
                    When you invoke an AI generation or validation, your credentials are sent in the request body over encrypted TLS to the backend process strictly in-memory. The backend <strong>never writes credentials to disk, logs, or databases</strong>; they vanish from memory when the request completes.
                  </p>
                </div>

                {/* 3. Encryption (Truth in Security) */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <Lock className="w-4 h-4" />
                    3. Encryption (Storage Truth)
                  </div>
                  <p className="text-[11px] text-slate-300">
                    <strong>Honest Security:</strong> Standard browser <code>localStorage</code> is <em>not cryptographically encrypted at rest</em>. Any extension or script with origin access can read it. On shared public workstations, always use private browsing or use the "Wipe Local Profile" button below.
                  </p>
                </div>

                {/* 4. Server-Side Exposure */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
                    <Server className="w-4 h-4" />
                    4. Server-Side Exposure (Zero Cross-Leakage)
                  </div>
                  <p className="text-[11px] text-slate-300">
                    The backend architecture maintains <strong>zero multi-tenant user state</strong>. There is no user database table, no session cache in Redis, and no server-side endpoint that can return User A’s settings to User B. Concurrent requests execute in isolated thread contexts.
                  </p>
                </div>
              </div>

              {/* Security Checklist */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <h5 className="font-semibold text-slate-200 text-xs">Architecture Guarantees:</h5>
                <ul className="space-y-1.5 text-[11px] text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>No API keys or user credentials stored in shared server databases</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>No global JavaScript window variables leaking settings across modules</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Zero hardcoded API keys in application source code</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>100% Client-side export and import without intermediate server upload</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: Data Portability & Wipe */}
          {activeTab === 'portability' && (
            <div className="space-y-6">
              {importStatus && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {importStatus}
                </div>
              )}

              {/* Export & Import Profile Section */}
              <div className="p-5 rounded-xl bg-slate-800/20 border border-slate-800 space-y-4">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  Client Profile Portability
                </h4>
                <p className="text-slate-400 text-xs">
                  Transfer your local formatting preferences, AI models, and configurations between different browser profiles or computers without ever sending your data to any cloud database.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {/* Export Button */}
                  <button
                    onClick={exportSettings}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Export Local Profile (JSON)
                  </button>

                  {/* Import Button */}
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium text-xs transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 text-slate-400" />
                    Import Profile (JSON)
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Wipe / Reset Data Section */}
              <div className="p-5 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-3">
                <h4 className="text-sm font-semibold text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Danger Zone: Wipe All Local Data
                </h4>
                <p className="text-rose-200/80 text-xs">
                  Immediately purges all stored API keys, custom base URLs, layout preferences, and profile identifiers from this browser's local storage. This action is irreversible.
                </p>

                {!resetConfirmOpen ? (
                  <button
                    onClick={() => setResetConfirmOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-900/40 hover:bg-rose-900/70 text-rose-200 border border-rose-800/60 rounded-lg font-medium text-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Wipe All Local Settings
                  </button>
                ) : (
                  <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-700/80 space-y-3">
                    <p className="text-rose-100 text-xs font-semibold">
                      Are you sure you want to permanently erase all local settings and API keys?
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          resetSettings();
                          setResetConfirmOpen(false);
                          setImportStatus('All local settings and keys have been permanently cleared.');
                          setTimeout(() => setImportStatus(null), 3500);
                        }}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-semibold cursor-pointer"
                      >
                        Yes, Erase Everything
                      </button>
                      <button
                        onClick={() => setResetConfirmOpen(false)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Storage Engine: localStorage · Scoped: origin
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
