import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Cpu,
  Check,
  Loader2,
  Wand2,
  Send,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { AIModelDescriptor } from '../types/api';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  onApplyAIText: (newText: string) => void;
}

export function AISettingsModal({
  isOpen,
  onClose,
  currentText,
  onApplyAIText,
}: AISettingsModalProps) {
  const [models, setModels] = useState<AIModelDescriptor[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [temperature, setTemperature] = useState<number>(0.2);
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      apiClient
        .getAIModels()
        .then((res) => {
          if (res.models && res.models.length > 0) {
            setModels(res.models);
            if (res.default_model) setSelectedModel(res.default_model);
          }
        })
        .catch(() => {
          // Fallback static model list
          setModels([
            {
              id: 'gemini-2.5-flash',
              name: 'Gemini 2.5 Flash',
              description: 'Fast, high-efficiency academic processing',
              tier: 'Fast',
            },
            {
              id: 'gemini-2.5-pro',
              name: 'Gemini 2.5 Pro',
              description: 'In-depth academic reasoning and mathematical logic',
              tier: 'Pro',
            },
          ]);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (customPrompt?: string) => {
    const activePrompt = customPrompt || prompt;
    if (!activePrompt.trim() && !currentText.trim()) {
      setErrorMsg('Please specify a prompt or ensure document text is present.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedOutput(null);

    const fullPrompt = activePrompt
      ? `${activePrompt}\n\nContext document:\n${currentText.slice(0, 10000)}`
      : `Please refine and structure this academic text according to high-standard research publication conventions:\n\n${currentText.slice(0, 10000)}`;

    try {
      const res = await apiClient.generateAI({
        prompt: fullPrompt,
        model: selectedModel,
        temperature,
      });

      if (res.content) {
        setGeneratedOutput(res.content);
      } else {
        setErrorMsg('AI provider returned empty response.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (generatedOutput) {
      onApplyAIText(generatedOutput);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">AI Provider & Model Settings</h2>
              <p className="text-xs text-slate-400">Google Gemini API Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Model Selector */}
          <div>
            <label className="block font-medium text-slate-300 mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Select Gemini Model</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {models.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/80 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>{m.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {m.tier}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick AI Academic Prompts */}
          <div>
            <span className="block font-medium text-slate-300 mb-2">Quick Academic Actions</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  handleGenerate(
                    'Enhance academic tone, vocabulary precision, and flow while preserving all formulas, citations, and section headings.'
                  )
                }
                disabled={isGenerating || !currentText.trim()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Polish Academic Tone
              </button>
              <button
                type="button"
                onClick={() =>
                  handleGenerate(
                    'Generate a concise, 150-word formal academic Abstract summarizing the methodologies and findings in this paper.'
                  )
                }
                disabled={isGenerating || !currentText.trim()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Draft Abstract
              </button>
              <button
                type="button"
                onClick={() =>
                  handleGenerate(
                    'Standardize all math and chemical equations to standard LaTeX notation ($...$ inline, $$...$$ display).'
                  )
                }
                disabled={isGenerating || !currentText.trim()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Standardize LaTeX Math
              </button>
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block font-medium text-slate-300 mb-1.5">
              Custom Prompt Directive
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., Format this as a formal IEEE conference article with numbered sections..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Generated Result Preview */}
          {generatedOutput && (
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">AI Generated Result</span>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply to Editor</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {generatedOutput}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
