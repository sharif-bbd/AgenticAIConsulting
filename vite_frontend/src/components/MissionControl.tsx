import React, { useMemo, useEffect, useRef } from 'react';
import { 
  Search, Globe, Shield, Newspaper, BarChart3, Binary, 
  CheckCircle2, Loader2, FastForward, Activity, Zap
} from 'lucide-react';

interface MissionControlProps {
  logs: string[];
}

interface ResearchStep {
  id: number;
  label: string;
  description: string;
  icon: React.ElementType;
}

const RESEARCH_STEPS: ResearchStep[] = [
  { id: 1, label: 'Company Intelligence', description: 'Extracting profile and strategic positioning', icon: Binary },
  { id: 2, label: 'Industry Dynamics', description: 'Analyzing market shifts and vertical trends', icon: Globe },
  { id: 3, label: 'Problem Context', description: 'Enriching technical and business problem depth', icon: Search },
  { id: 4, label: 'Regulatory Landscape', description: 'Checking compliance and legal constraints', icon: Shield },
  { id: 5, label: 'News & Real-time PR', description: 'Sourcing recent events and public statements', icon: Newspaper },
  { id: 6, label: 'Benchmarks & Cases', description: 'Identifying relevant success stories and data', icon: BarChart3 },
];

export const MissionControl: React.FC<MissionControlProps> = ({ logs }) => {
  const feedRef = useRef<HTMLDivElement>(null);

  const { stepStates, intelFeed, activeQueries } = useMemo(() => {
    const states: Record<number, 'pending' | 'running' | 'completed'> = {};
    const intel: { type: 'intel' | 'query'; message: string; timestamp: string }[] = [];
    const queries: string[] = [];
    
    RESEARCH_STEPS.forEach(s => states[s.id] = 'pending');

    let maxStepReached = 0;

    logs.forEach((log) => {
      // 1. Efficient Step tracking
      if (log.startsWith('[')) {
        const startMatch = log.match(/^\[(\d)\/6\]/);
        if (startMatch) {
          const stepId = parseInt(startMatch[1]);
          if (stepId > maxStepReached) {
            // Mark all previous active steps as completed
            for (let i = 1; i < stepId; i++) {
              if (states[i] === 'running') states[i] = 'completed';
            }
            maxStepReached = stepId;
          }
          states[stepId] = 'running';
        }
      }

      // 2. Specific completion markers
      if (log.includes('✓ ')) {
        if (log.includes('Company profile')) states[1] = 'completed';
        else if (log.includes('Industry trends')) states[2] = 'completed';
        else if (log.includes('Problem context')) states[3] = 'completed';
        else if (log.includes('Regulatory context')) states[4] = 'completed';
        else if (log.includes('Recent news')) states[5] = 'completed';
        else if (log.includes('Benchmarks')) states[6] = 'completed';
      }

      // 3. Intel Feed Parsing (More targeted startsWith)
      if (log[0] === '[') {
        if (log.startsWith('[QUERY]')) {
          const msg = log.substring(7).trim();
          intel.push({ type: 'query', message: msg, timestamp: 'RECENT' });
          queries.push(msg);
        } else if (log.startsWith('[INTEL]')) {
          const msg = log.substring(7).trim();
          intel.push({ type: 'intel', message: msg, timestamp: 'RECENT' });
        }
      }
    });

    return { stepStates: states, intelFeed: intel, activeQueries: queries };
  }, [logs]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [intelFeed]);

  const allCompleted = Object.values(stepStates).every(s => s === 'completed');
  const currentQuery = activeQueries[activeQueries.length - 1];

  return (
    <div className="mission-control-container animate-fade-in" style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {/* Top Status Header */}
      <div className="card" style={{ padding: '24px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'var(--brand-muted)',
              borderRadius: '99px',
              marginBottom: '12px',
            }}>
              {allCompleted ? 
                <CheckCircle2 style={{ width: '12px', height: '12px', color: 'var(--success)' }} /> : 
                <Activity style={{ width: '12px', height: '12px', color: 'var(--brand)', animation: 'pulse 1.5s ease infinite' }} />
              }
              <span style={{
                fontSize: '9px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--brand)',
              }}>
                {allCompleted ? 'Cycle Complete' : 'Active Discovery Matrix'}
              </span>
            </div>
            
            <h2 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.03em',
            }}>
              {allCompleted ? 'Synthesis Initialized' : 'Gathering Strategic Intel'}
            </h2>
          </div>

          <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  System Load
              </div>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '12px' }}>
                  {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{ 
                          width: '4px', 
                          height: `${Math.random() * 100}%`, 
                          background: 'var(--brand)', 
                          borderRadius: '1px',
                          opacity: allCompleted ? 0.2 : 0.4 + (i * 0.1),
                          transition: 'height 0.3s ease'
                      }} />
                  ))}
              </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', minHeight: '480px' }}>
        {/* Left Column: Progress Steps */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 800, 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            marginBottom: '12px',
            paddingLeft: '4px'
          }}>
            Discovery Routine
          </div>
          {RESEARCH_STEPS.map((step) => {
            const state = stepStates[step.id];
            const isActive = state === 'running';
            const isDone = state === 'completed';

            return (
              <div key={step.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: isActive ? 'var(--brand-muted)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'var(--brand-border)' : 'transparent',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: state === 'pending' ? 0.4 : 1,
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: isDone ? 'var(--success-muted)' : isActive ? 'var(--brand)' : 'var(--bg-app)',
                  border: isDone ? '1px solid var(--success)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                }}>
                  {isDone ? (
                    <CheckCircle2 style={{ width: '16px', height: '16px', color: 'var(--success)' }} />
                  ) : (
                    <step.icon style={{ width: '14px', height: '14px', color: isActive ? '#fff' : 'var(--text-muted)' }} />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: isDone ? 'var(--success)' : isActive ? 'var(--brand)' : 'var(--text-main)',
                  }}>
                    {step.label}
                  </div>
                </div>
                
                {isActive && <Loader2 style={{ width: '12px', height: '12px', color: 'var(--brand)' }} className="animate-spin" />}
              </div>
            );
          })}
        </div>

        {/* Right Column: Intelligence Feed */}
        <div className="card" style={{ 
          padding: '24px', 
          display: 'flex', 
          flexDirection: 'column',
          background: 'rgba(2, 6, 23, 0.02)',
          border: '1px solid var(--border-dim)',
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-dim)'
          }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              color: 'var(--text-main)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Zap style={{ width: '12px', height: '12px', color: 'var(--brand)' }} />
              Live Intelligence Stream
            </div>
            <div style={{ 
              fontSize: '10px', 
              fontFamily: 'var(--font-mono)', 
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: allCompleted ? 'var(--text-dim)' : 'var(--success)', animation: allCompleted ? 'none' : 'pulse 1s infinite' }} />
              RAW_LOG_FEED:OK
            </div>
          </div>

          <div 
            ref={feedRef}
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              paddingRight: '8px',
              maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
            }}
          >
            {intelFeed.length === 0 ? (
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '24px',
                  padding: '40px'
                }}>
                    <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                        {/* Central Hub */}
                        <div style={{
                          position: 'absolute',
                          inset: '25px',
                          background: 'var(--brand)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                          boxShadow: '0 0 20px var(--brand)',
                          animation: 'pulse 2s ease infinite'
                        }}>
                          <Zap style={{ width: '16px', height: '16px', color: '#fff' }} />
                        </div>

                        {/* Orbiting Satellite Rings */}
                        {[0, 1, 2].map((i) => (
                          <div key={i} style={{
                            position: 'absolute',
                            inset: 0,
                            border: '1px solid var(--brand-border)',
                            borderRadius: '50%',
                            animation: `spin ${3 + i}s linear infinite`,
                            opacity: 0.3 - (i * 0.1),
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: '-3px',
                              left: '50%',
                              width: '6px',
                              height: '6px',
                              background: 'var(--brand-bright)',
                              borderRadius: '50%',
                              boxShadow: '0 0 8px var(--brand-bright)'
                            }} />
                          </div>
                        ))}
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: 700, 
                        color: 'var(--text-main)',
                        marginBottom: '6px',
                        letterSpacing: '-0.01em'
                      }}>
                        Initializing Agent Network
                      </div>
                      <div style={{ 
                        fontSize: '10px', 
                        fontWeight: 500, 
                        color: 'var(--text-muted)',
                        maxWidth: '200px',
                        lineHeight: 1.5
                      }}>
                        Establishing secure handshake with discovery satellites...
                      </div>
                    </div>
                </div>
            ) : (
                intelFeed.map((item, i) => (
                    <div key={i} style={{
                        background: item.type === 'intel' ? 'rgba(5, 150, 105, 0.03)' : 'transparent',
                        border: '1px solid',
                        borderColor: item.type === 'intel' ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        animation: 'fadeIn 0.3s ease-out forwards',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start'
                    }}>
                        <div style={{ marginTop: '3px' }}>
                            {item.type === 'intel' ? 
                                <Zap style={{ width: '12px', height: '12px', color: 'var(--success)' }} /> : 
                                <FastForward style={{ width: '12px', height: '12px', color: 'var(--brand)' }} />
                            }
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ 
                                fontSize: '12px', 
                                lineHeight: 1.5, 
                                color: item.type === 'intel' ? 'var(--text-main)' : 'var(--text-secondary)',
                                fontWeight: item.type === 'intel' ? 600 : 500,
                                fontFamily: item.type === 'query' ? 'var(--font-mono)' : 'inherit'
                            }}>
                                {item.type === 'query' && <span style={{ color: 'var(--brand)', marginRight: '6px' }}>&gt;</span>}
                                {item.message}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                                {item.timestamp} — {item.type === 'intel' ? 'FINDING_CONFIRMED' : 'ROUTINE_SEARCH'}
                            </div>
                        </div>
                    </div>
                ))
            )}
          </div>

          {currentQuery && !allCompleted && (
            <div style={{ 
                marginTop: '16px', 
                padding: '12px 16px', 
                background: 'var(--brand)', 
                borderRadius: '10px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.3)'
            }}>
                <div className="animate-spin">
                    <Loader2 style={{ width: '14px', height: '14px' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>Current Operation</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {currentQuery}
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
