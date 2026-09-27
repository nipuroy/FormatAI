import { useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Zap,
  Sliders,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Sigma,
  Table as TableIcon,
  GraduationCap,
  BookOpen,
  Scissors,
  BookmarkCheck,
  Atom,
} from 'lucide-react';
import { useSkills } from '../hooks/useSkills';
import { DocumentSkill, SkillCategory } from '../skills/types';

interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SkillsModal({ isOpen, onClose }: SkillsModalProps) {
  const { skills, enabledCount, totalCount, toggleSkill, resetSkills } = useSkills();
  const [selectedCategory, setSelectedCategory] = useState<'all' | SkillCategory>('all');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories: Array<{ id: 'all' | SkillCategory; label: string }> = [
    { id: 'all', label: `All Skills (${totalCount})` },
    { id: 'formatting', label: 'Formatting' },
    { id: 'stem', label: 'STEM & Math' },
    { id: 'structure', label: 'Structure' },
    { id: 'cleanup', label: 'Cleanup' },
    { id: 'pedagogy', label: 'Pedagogy' },
  ];

  const filteredSkills = skills.filter((skill) => {
    if (selectedCategory === 'all') return true;
    return skill.category === selectedCategory;
  });

  const getSkillIcon = (id: string) => {
    switch (id) {
      case 'mathematics':
        return <Sigma className="w-4 h-4 text-cyan-400" />;
      case 'statistics':
        return <Sigma className="w-4 h-4 text-emerald-400" />;
      case 'chemistry':
        return <FlaskConical className="w-4 h-4 text-rose-400" />;
      case 'scientific_formatting':
        return <Atom className="w-4 h-4 text-indigo-400" />;
      case 'tables':
        return <TableIcon className="w-4 h-4 text-amber-400" />;
      case 'exam_questions':
        return <GraduationCap className="w-4 h-4 text-orange-400" />;
      case 'study_notes':
        return <BookOpen className="w-4 h-4 text-yellow-400" />;
      case 'markdown_cleanup':
        return <Scissors className="w-4 h-4 text-purple-400" />;
      case 'citation_references':
        return <BookmarkCheck className="w-4 h-4 text-blue-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Modular Document Skills</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {enabledCount} of {totalCount} Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Independent document processing capabilities orchestrated through a decoupled pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pipeline Architecture Banner */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Raw Input</span>
              <span className="text-indigo-400 font-bold">→</span>
              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                Skill Orchestrator
              </span>
              <span className="text-indigo-400 font-bold">→</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                Enabled Skills ({enabledCount})
              </span>
              <span className="text-indigo-400 font-bold">→</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Document Model</span>
              <span className="text-indigo-400 font-bold">→</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">DOCX / PDF Export</span>
            </div>
            <button
              onClick={resetSkills}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Reset all skills to enabled"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-900/60 border-b border-slate-800 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 text-xs rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Skills List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredSkills.map((skill: DocumentSkill) => {
            const isExpanded = expandedSkillId === skill.id;

            return (
              <div
                key={skill.id}
                className={`p-4 rounded-xl border transition-all ${
                  skill.enabled
                    ? 'bg-slate-800/40 border-slate-700/80 hover:border-slate-600'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Skill Identity & Description */}
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 mt-0.5 shrink-0">
                      {getSkillIcon(skill.id)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100 text-sm">{skill.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          v{skill.version}
                        </span>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                          {skill.category}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Priority #{skill.priority}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{skill.description}</p>
                    </div>
                  </div>

                  {/* Enable/Disable Toggle Switch */}
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skill.enabled}
                        onChange={(e) => toggleSkill(skill.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>

                    <button
                      onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                      className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
                      title={isExpanded ? 'Hide rules' : 'View rules'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Rules View */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2 text-xs">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Processing Rules ({skill.rules.length}):
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {skill.rules.map((rule) => (
                        <div key={rule.id} className="p-2.5 rounded bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <div className="font-medium text-slate-200 text-xs flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{rule.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">{rule.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div>
            A disabled skill is completely bypassed and does <span className="text-white font-medium">not</span> alter the document.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
