import React from 'react';
import { 
  Briefcase, 
  UserPlus, 
  Search, 
  MessageSquare, 
  PenTool, 
  ShieldCheck, 
  FileCheck,
  Settings,
  HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  currentPhase: string;
  onJump?: (phase: string) => void;
}

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  phase: string;
  onClick?: (phase: string) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, isActive, phase, onClick }) => (
  <button
    onClick={() => onClick?.(phase)}
    className={clsx(
      'flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 group',
      isActive 
        ? 'bg-blue-500/10 text-blue-400 shadow-sm' 
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
    )}
  >
    <Icon className={clsx('w-5 h-5 transition-transform duration-200 group-hover:scale-110', isActive && 'text-blue-400')} />
    <span className="font-medium text-sm">{label}</span>
    {isActive && (
      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
    )}
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ currentPhase, onJump }) => {
  const isPhaseActive = (phases: string[]) => phases.includes(currentPhase);

  const steps = [
    { label: 'Client Intake', icon: UserPlus, phase: 'INTAKE', activePhases: ['INTAKE'] },
    { label: 'Researching', icon: Search, phase: 'RESEARCH', activePhases: ['RESEARCH', 'RESEARCH_RUNNING'] },
    { label: 'Meeting Prep', icon: MessageSquare, phase: 'HITL_1', activePhases: ['QUESTION_GEN', 'HITL_1'] },
    { label: 'Drafting', icon: PenTool, phase: 'DRAFTING', activePhases: ['DRAFTING'] },
    { label: 'Review', icon: ShieldCheck, phase: 'HITL_2', activePhases: ['CRITIQUING', 'HITL_2'] },
    { label: 'Final Proposal', icon: FileCheck, phase: 'COMPLETE', activePhases: ['OUTPUT', 'COMPLETE'] },
  ];

  return (
    <aside className="w-[280px] h-screen fixed left-0 top-0 bg-[#0f172a] text-white flex flex-col p-6 z-[100] border-r border-white/5">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
          <Briefcase className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wider uppercase leading-tight">Brandis</h1>
          <p className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Strategy Engine</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
        <p className="px-4 text-[10px] font-bold text-slate-500 tracking-[0.2em] mb-4 uppercase">Workflow</p>
        {steps.map((step) => (
          <SidebarItem
            key={step.phase}
            icon={step.icon}
            label={step.label}
            phase={step.phase}
            isActive={isPhaseActive(step.activePhases)}
            onClick={onJump}
          />
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-auto pt-6 border-t border-white/5">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">
            AI
          </div>
          <div>
            <p className="text-xs font-bold text-slate-200">Advisor Pro</p>
            <p className="text-[10px] text-slate-500">v2.0 · Agentic</p>
          </div>
        </div>
        
        <div className="flex justify-around mt-4">
          <button className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
