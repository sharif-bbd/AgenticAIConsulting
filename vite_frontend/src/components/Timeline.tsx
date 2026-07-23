import React from 'react';
import { Check, Clipboard, Search, Target, PenTool, BarChart3, Download } from 'lucide-react';

interface TimelineStep {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const STEPS: TimelineStep[] = [
  { id: 'INTAKE',       label: '01', sublabel: 'Intake',   icon: <Clipboard  style={{ width: '12px', height: '12px' }} /> },
  { id: 'RESEARCH',     label: '02', sublabel: 'Research', icon: <Search     style={{ width: '12px', height: '12px' }} /> },
  { id: 'QUESTION_GEN', label: '03', sublabel: 'Prep',     icon: <Target     style={{ width: '12px', height: '12px' }} /> },
  { id: 'DRAFTING',     label: '04', sublabel: 'Draft',    icon: <PenTool    style={{ width: '12px', height: '12px' }} /> },
  { id: 'CRITIQUING',   label: '05', sublabel: 'Review',   icon: <BarChart3  style={{ width: '12px', height: '12px' }} /> },
  { id: 'COMPLETE',     label: '06', sublabel: 'Export',   icon: <Download   style={{ width: '12px', height: '12px' }} /> },
];


interface TimelineProps {
  currentPhase: string;
}

export const MinimalistTimeline: React.FC<TimelineProps> = React.memo(({ currentPhase }) => {
  const getPhaseIndex = (phase: string): number => {
    // Explicit mapping for wait states (Human-in-the-Loop)
    if (phase === 'HITL_1') return 2; // Step 03: Prep
    if (phase === 'HITL_2') return 4; // Step 05: Review
    if (phase === 'OUTPUT') return 5; // Step 06: Export

    for (let i = 0; i < STEPS.length; i++) {
      if (phase.startsWith(STEPS[i].id)) return i;
    }
    return 0;
  };

  const currentIndex = getPhaseIndex(currentPhase);
  const isRunning = currentPhase.includes('RUNNING') || 
                    currentPhase.includes('RESEARCH') || 
                    ['QUESTION_GEN', 'CRITIQUING', 'DRAFTING', 'OUTPUT'].includes(currentPhase);

  return (
    <nav style={{
      width: '100%',
      borderBottom: '1px solid var(--border-dim)',
      padding: '20px 0',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        maxWidth: '100%',
      }}>
        {/* Progress Track */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          height: '1px',
          background: 'var(--border-dim)',
          zIndex: 0,
        }}>
          {/* Active Progress */}
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--brand) 0%, var(--accent) 100%)',
            width: `${(currentIndex / (STEPS.length - 1)) * 100}%`,
            transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 0 8px var(--brand-glow)',
          }} />
        </div>

        {STEPS.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex || currentPhase === 'COMPLETE';

          return (
            <div key={step.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1,
              flex: 1,
            }}>
              {/* Node */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                border: isCompleted ? 'none' : isActive ? '2px solid var(--brand-bright)' : '1px solid var(--border-subtle)',
                background: isCompleted
                  ? 'linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%)'
                  : isActive
                    ? 'var(--brand-muted)'
                    : 'var(--bg-surface)',
                boxShadow: isActive
                  ? `0 0 16px var(--brand-glow), 0 0 0 4px rgba(59,130,246,0.08)`
                  : isCompleted
                    ? '0 2px 8px rgba(37,99,235,0.4)'
                    : 'none',
              }}>
                {isCompleted ? (
                  <Check style={{ width: '13px', height: '13px', color: '#fff' }} strokeWidth={3} />
                ) : isActive ? (
                  <span style={{ color: 'var(--brand-bright)' }}>{step.icon}</span>
                ) : (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.05em',
                    fontFamily: 'var(--font-mono)',
                  }}>{step.label}</span>
                )}
              </div>

              {/* Labels */}
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: isActive ? 'var(--text-main)' : isCompleted ? 'var(--text-secondary)' : 'var(--text-muted)',
                  transition: 'color 0.3s ease',
                }}>
                  {step.sublabel}
                </span>
                {/* Active/Running status indicators removed */}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
});
