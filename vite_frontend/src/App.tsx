import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { api } from './api';
import type { SessionStateResponse } from './api';
import { Header } from './components/Header';
import { MinimalistTimeline as Timeline } from './components/Timeline';
import { ProposalPreview } from './components/ProposalPreview';
import { IntakeControl } from './components/IntakeControl';
import { MeetingPrep } from './components/MeetingPrep';
import { ReviewApprove } from './components/ReviewApprove';
import { OutputReady } from './components/OutputReady';
import { MissionControl } from './components/MissionControl';
import { RoadmapToApproval } from './components/RoadmapToApproval';

function App() {
  // Session State
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem('agentic_session_id'));
  const [state, setState] = useState<SessionStateResponse>({
    session_id: '',
    current_phase: 'INTAKE',
    output_ready: false,
    proposal_components: {},
    total_tokens: 0,
    total_cost: 0,
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [lastLogIdx, setLastLogIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [canvasComments, setCanvasComments] = useState<{ id: string; section: string; text: string; comment: string }[]>([]);

  // Sync state from API
  const syncState = useCallback(async () => {
    // Don't poll if page is hidden to avoid focus-jump/jank
    if (document.hidden) return;
    if (!sessionId) return;
    try {
      const data = await api.getState(sessionId);
      setState(data);

      const logsData = await api.getLogs(sessionId, lastLogIdx);
      if (logsData.logs.length > 0) {
        setLogs(prev => [...prev, ...logsData.logs]);
        setLastLogIdx(logsData.next_cursor);
      }
    } catch (err) {
      console.error('State sync failed:', err);
    }
  }, [sessionId, lastLogIdx]);

  // Polling loop
  useEffect(() => {
    let interval: number;
    if (sessionId && state.current_phase !== 'COMPLETE') {
      interval = window.setInterval(syncState, 3000);
    }
    return () => clearInterval(interval);
  }, [sessionId, state.current_phase, syncState]);

  // Action Handlers
  const handleStartSession = async (brief: string) => {
    // flushSync ensures the browser paints this update IMMEDIATELY before the async fetch starts
    flushSync(() => {
      setIsLoading(true);
      setState(prev => ({ ...prev, current_phase: 'RESEARCH_RUNNING' }));
    });

    try {
      const resp = await api.startSession(brief);
      setSessionId(resp.session_id);
      localStorage.setItem('agentic_session_id', resp.session_id);
      setState(prev => ({ ...prev, current_phase: resp.current_phase, session_id: resp.session_id }));
      setLogs([]);
      setLastLogIdx(0);
      await syncState();
    } catch (err) {
      alert('Failed to start session.');
      // Revert if failed
      setState(prev => ({ ...prev, current_phase: 'INTAKE' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitTranscript = async (transcript: string, questions: string[], directive?: string) => {
    if (!sessionId) return;
    flushSync(() => {
      setIsLoading(true);
    });
    try {
      await api.submitTranscript(sessionId, transcript, questions, directive);
      await syncState();
    } catch (err) {
      alert('Failed to submit transcript.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveDraft = async (overrides: any, directive?: string) => {
    if (!sessionId) return;
    flushSync(() => {
      setIsLoading(true);
    });

    // Aggregate canvas comments into directives
    const aggregatedDirectives = [...(directive ? [directive] : [])];
    canvasComments.forEach(c => {
      aggregatedDirectives.push(`[CRITIQUE: ${c.section.replace(/_/g, ' ')}] Concerning "${c.text.slice(0, 50)}...": ${c.comment}`);
    });

    try {
      await api.approveDraft(sessionId, overrides, aggregatedDirectives.join('\n\n'));
      setCanvasComments([]); // Clear comments after revision
      await syncState();
    } catch (err) {
      alert('Approval failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCanvasCritique = async (section: string, text: string, comment: string) => {
    const newComment = {
      id: Math.random().toString(36).substr(2, 9),
      section,
      text,
      comment
    };
    setCanvasComments(prev => [...prev, newComment]);
    setLogs(prev => [...prev, `[CANVAS CRITIQUE ADDED]: ${comment}`]);
  };

  const handleDeleteComment = (id: string) => {
    setCanvasComments(prev => prev.filter(c => c.id !== id));
  };



  const handleBackToReview = async () => {
    console.log('[DEBUG] handleBackToReview called');
    if (!sessionId) {
      console.error('[DEBUG] No session ID available');
      return;
    }
    
    flushSync(() => {
      setIsLoading(true);
    });
    
    try {
      console.log('[DEBUG] Calling jumpPhase for session:', sessionId);
      const resp = await api.jumpPhase(sessionId, 'HITL_2');
      console.log('[DEBUG] jumpPhase response:', resp);
      
      await syncState();
      console.log('[DEBUG] State synced after jump');
    } catch (err) {
      console.error('[DEBUG] Failed to return to review:', err);
      alert('Failed to return to review.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!sessionId) return;
    try {
      await api.stopSession(sessionId);
      // Optionally reset immediately or wait for node exit. 
      // Most users expect immediate UI feedback.
      handleReset();
    } catch (err) {
      alert('Stop command failed.');
    }
  };

  const handleReset = () => {
    localStorage.removeItem('agentic_session_id');
    setSessionId(null);
    setState({
      session_id: '',
      current_phase: 'INTAKE',
      output_ready: false,
      proposal_components: {},
      total_tokens: 0,
      total_cost: 0,
    });
    setLogs([]);
    setLastLogIdx(0);
    setCanvasComments([]);
  };

  const renderWorkflowControl = () => {
    const isRunning = state.current_phase.includes('RUNNING') ||
      state.current_phase.includes('RESEARCH') ||
      state.current_phase === 'QUESTION_GEN' ||
      state.current_phase === 'CRITIQUING' ||
      state.current_phase === 'DRAFTING' ||
      state.current_phase === 'OUTPUT';

    if (isRunning) {
      // Proactive transition: If 6th research step is done or synthesis started, 
      // move to "Synthesizing" view even if backend phase is still RESEARCH.
      const isResearchFinishing = logs.some(log => 
        log.includes('✓ Benchmarks retrieved') || 
        log.includes('Synthesizing client dossier')
      );

      if (state.current_phase.includes('RESEARCH') && !isResearchFinishing) {
        return <MissionControl logs={logs} />;
      }

      return (
        <div style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(20px)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-premium)',
          padding: '48px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '20px',
          animation: 'slideUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Pulsing brand ring */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '2px solid var(--brand-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: 'var(--brand-bright)',
              borderRightColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--brand-muted)',
              animation: 'pulse 2s ease infinite',
            }} />
          </div>
          <div>
            <h2 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-main)',
              letterSpacing: '-0.025em',
              marginBottom: '8px',
            }}>
              Synthesizing Proposal
            </h2>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              lineHeight: 1.6,
              maxWidth: '260px',
            }}>
              The AI strategy engine is building your proposal based on the latest client discovery.
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            background: 'var(--brand-muted)',
            border: '1px solid var(--brand-border)',
            borderRadius: '99px',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--brand-bright)',
              boxShadow: '0 0 8px var(--brand-bright)',
              animation: 'pulse 1.5s ease infinite',
            }} />
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--brand-bright)',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
            }}>Agents Running</span>
          </div>
        </div>
      );
    }

    switch (state.current_phase) {
      case 'INTAKE':
        return <IntakeControl onStart={handleStartSession} isLoading={isLoading} />;
      case 'HITL_1':
        return (
          <MeetingPrep
            sessionId={sessionId!}
            questions={state.probing_questions || []}
            answers={state.question_answers || {}}
            onQuestionsUpdate={(qs) => setState(prev => ({ ...prev, probing_questions: qs }))}
            onSubmit={handleSubmitTranscript}
            isLoading={isLoading}
          />
        );
      case 'HITL_2':
        return (
          <ReviewApprove
            qualityScore={state.quality_score || 0}
            critiqueHistory={state.critique_history || []}
            activeComments={canvasComments}
            onApprove={handleApproveDraft}
            isLoading={isLoading}

          />
        );
      case 'COMPLETE':
        return (
          <OutputReady
            sessionId={sessionId!}
            onReset={handleReset}
            onBackToReview={handleBackToReview}
            isLoading={isLoading}
          />
        );
      case 'FAILED':
        return (
          <div style={{
            background: 'var(--bg-card)',
            padding: '48px 36px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.1)',
          }}>
            <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>Workflow Failed</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {state.last_error || "An unknown backend error occurred."}
            </p>
            <button 
              onClick={handleReset}
              style={{
                marginTop: '24px', padding: '12px 24px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', borderRadius: '8px', cursor: 'pointer'
              }}>
              Start New Session
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const hasContent = Object.keys(state.proposal_components || {}).length > 0;
  const isFocusView = !hasContent;

  return (
    <div className="app-container">
      <Header
        isWorking={isLoading || state.current_phase.includes('RUNNING') || state.current_phase.includes('RESEARCH') || ['QUESTION_GEN', 'CRITIQUING', 'DRAFTING', 'OUTPUT'].includes(state.current_phase)}
        isLoading={isLoading}
        sessionId={sessionId}
        onReset={handleReset}
        onStop={handleStopSession}
        totalCost={state.total_cost}
      />

      <Timeline currentPhase={state.current_phase} />

      <main className="flex-1 overflow-y-auto">
        <div className={`dashboard-layout ${isFocusView ? 'canvas-hidden' : ''}`}>
          {/* Left Column: Input and Diagnostics */}
          <div className="control-column">
            {renderWorkflowControl()}
          </div>

          {/* Right Column: High Fidelity Preview */}
          <div className="canvas-column sticky top-12">
            <ProposalPreview
              currentPhase={state.current_phase}
              components={state.proposal_components || {}}
              comments={canvasComments}
              onCritique={handleCanvasCritique}
              onDeleteComment={handleDeleteComment}
              height={state.critique_history && state.critique_history.length > 0 ? 'calc(100vh - 300px)' : undefined}
            />
            {state.critique_history && state.critique_history.length > 0 && (
              <RoadmapToApproval latestCritique={state.critique_history[state.critique_history.length - 1]} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
