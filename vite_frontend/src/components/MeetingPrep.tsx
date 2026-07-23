import React, { useState } from 'react';
import { Zap, RefreshCw, ArrowRight, Lightbulb } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';

interface MeetingPrepProps {
  sessionId: string;
  questions: string[];
  answers: Record<string, string>;
  onQuestionsUpdate: (questions: string[]) => void;
  onSubmit: (transcript: string, questions: string[], directive?: string) => void;
  isLoading: boolean;
}

export const MeetingPrep: React.FC<MeetingPrepProps> = React.memo(({
  sessionId,
  questions,
  answers,
  onQuestionsUpdate,
  onSubmit,
  isLoading,
}) => {
  const [transcript, setTranscript] = useState('');
  const [directive, setDirective] = useState('');
  const [refineDir, setRefineDir] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    if (!refineDir.trim()) return;
    setIsRegenerating(true);
    try {
      const resp = await api.refineQuestions(sessionId, refineDir);
      onQuestionsUpdate(resp.probing_questions);
      setRefineDir('');
    } catch {
      alert('Failed to regenerate questions.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const [persona, setPersona] = useState('');

  const handleFinalSubmit = () => {
    let finalDirective = directive;
    if (persona === 'Fritz') {
      const fritzText = `Evaluate this proposal using the persona of Fritz:
Fritz is a very experienced IT manager in his mid-fifties. Originally, he is a computer scientist from ETH Zurich, who after leaving ETH did a PhD on a managerial IT topic at a university, and then started his career as IT manager in various organizations and roles, either being a line manager for large organizations (up to several thousand people reporting to him), or as a project manager for large scale projects (100m+ budget). Fritz is interested in understanding technology, but not necessarily at great depth, focusing more on what a technology can achieve for the business than the details of the technology as such. For this, he loves interacting with technical experts, who explain to him the technology in sufficient depth to assess business utility, without getting bogged down in nitty gritty details. He trusts technical experts a lot, once they have established credibility with him. In organizations, he is a genuine innovator, pushing novel ways of doing things, empowering technical experts to try out new solutions. Using marketing speech without solid backup or a good explanation very quickly undermines the trust Fritz has in the person, and a person having done so usually ends up as being ignored by him. From a Myers-Briggs type, he is an INTJ, often characterized as "Architect", with some traits of an ENTJ "Commander".`;
      finalDirective = finalDirective ? `${finalDirective}\n\n${fritzText}` : fritzText;
    }
    onSubmit(transcript, questions, finalDirective);
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    backdropFilter: 'blur(20px)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-premium)',
    padding: '32px',
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Probing Questions Card */}
      <div style={cardStyle}>
        {/* Top accent */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, var(--brand) 0%, var(--accent) 100%)',
        }} />

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              background: 'var(--brand-muted)',
              border: '1px solid var(--brand-border)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Lightbulb style={{ width: '13px', height: '13px', color: 'var(--brand-bright)' }} />
            </div>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
            }}>Probing Questions</h3>
          </div>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            lineHeight: 1.5,
            paddingLeft: '38px',
          }}>
            Refine AI-generated questions to prepare for the discovery meeting.
          </p>
        </div>

        {/* Questions Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
          gap: '16px', 
          marginBottom: '32px' 
        }}>
          {questions.map((q, i) => {
            const ans = answers[q];
            const isPreAnswered = ans && ans !== 'Requires meeting' && ans !== 'INSUFFICIENT_DATA';

            const match = q.match(/^\*\*\[(.*?)\]\*\*\s*(.*)$/);
            const category = match ? match[1] : null;
            const questionText = match ? match[2] : q;

            return (
              <div key={i} className="discovery-card" style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.3s ease',
                position: 'relative',
                animation: `slideUp 0.5s ease forwards ${i * 0.05}s`,
                opacity: 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: 'var(--brand-bright)',
                      fontFamily: 'var(--font-mono)',
                      opacity: 0.5,
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {category && (
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--brand-bright)',
                        background: 'var(--brand-muted)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--brand-border)',
                      }}>
                        {category}
                      </span>
                    )}
                  </div>
                  
                  <div style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: isPreAnswered ? 'var(--success)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <div style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: isPreAnswered ? 'var(--success)' : 'var(--text-muted)',
                    }} />
                    {isPreAnswered ? 'Synthesized' : 'Requires Meeting'}
                  </div>
                </div>

                <div style={{
                  width: '100%',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: 500,
                  lineHeight: 1.6,
                }}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ color: 'var(--text-main)', fontWeight: 700 }}>{children}</strong>
                    }}
                  >
                    {questionText}
                  </ReactMarkdown>
                </div>

                {isPreAnswered && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: 'rgba(16, 185, 129, 0.05)',
                    borderRadius: '10px',
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                  }}>
                    <div style={{
                      fontSize: '8px',
                      fontWeight: 800,
                      color: 'var(--success)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <Zap style={{ width: '10px', height: '10px' }} />
                      Agent Intel
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      fontWeight: 500,
                    }}>
                      {ans}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Refine input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={refineDir}
            onChange={e => setRefineDir(e.target.value)}
            placeholder="Feedback to refine questions..."
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-dim)',
              borderRadius: '10px',
              color: 'var(--text-main)',
              fontFamily: 'inherit',
              fontSize: '12px',
              outline: 'none',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-border)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-dim)'}
          />
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating || !refineDir.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: isRegenerating || !refineDir.trim() ? 'var(--text-muted)' : 'var(--text-main)',
              fontFamily: 'inherit',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: isRegenerating || !refineDir.trim() ? 'not-allowed' : 'pointer',
              opacity: isRegenerating || !refineDir.trim() ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw style={{
              width: '12px',
              height: '12px',
              animation: isRegenerating ? 'spin 0.8s linear infinite' : 'none',
            }} />
            Refine
          </button>
        </div>
      </div>

      {/* Discovery Results Card */}
      <div style={cardStyle}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>Discovery Results</h3>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            lineHeight: 1.5,
          }}>
            Paste the meeting transcript or summary to trigger the drafting engine.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Paste raw transcript, notes, or high-level summary here..."
            style={{
              width: '100%',
              height: '200px',
              padding: '16px 20px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              fontFamily: 'inherit',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 1.65,
              resize: 'none',
              outline: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--brand-border)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-muted)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '-8px',
            marginRight: '8px',
          }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              color: transcript.length < 5 && transcript.trim().length > 0 ? 'var(--error)' : 'var(--text-muted)',
              background: 'var(--bg-card)',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}>
              {transcript.trim().length} / 5 characters min
            </span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              display: 'block',
              marginBottom: '8px',
            }}>
              Adversarial Persona (Optional)
            </label>
            <select
              value={persona}
              onChange={e => setPersona(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: '13px',
                outline: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">Default (No specific persona)</option>
              <option value="Fritz">Fritz (Experienced IT Manager, ETH Zurich INTJ)</option>
            </select>
          </div>

          <div>
            <label style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              display: 'block',
              marginBottom: '8px',
            }}>
              Strategic Directive (Optional)
            </label>
            <input
              value={directive}
              onChange={e => setDirective(e.target.value)}
              placeholder="e.g. Focus on digital transformation risks..."
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: '13px',
                fontWeight: 400,
                outline: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--brand-border)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-muted)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        <button
          disabled={isLoading || transcript.trim().length < 5}
          onClick={handleFinalSubmit}
          style={{
            width: '100%',
            marginTop: '24px',
            height: '52px',
            background: 'linear-gradient(135deg, var(--brand) 0%, #1d4ed8 100%)',
            color: '#fff',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 700,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            cursor: isLoading || transcript.trim().length < 5 ? 'not-allowed' : 'pointer',
            opacity: isLoading || transcript.trim().length < 5 ? 0.4 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontFamily: 'inherit',
            boxShadow: isLoading || transcript.trim().length < 5 ? 'none' : '0 4px 20px rgba(37, 99, 235, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={e => {
            if (!isLoading && transcript.trim().length >= 5) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.5)';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = transcript.trim().length >= 5 ? '0 4px 20px rgba(37, 99, 235, 0.4)' : 'none';
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', animation: 'pulse 1.5s ease infinite' }}>
              <div style={{
                width: '14px', height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              <span style={{ fontWeight: 800 }}>Synthesizing Draft…</span>
            </div>
          ) : (
            <>
              Submit & Synthesize
              <ArrowRight style={{ width: '16px', height: '16px' }} />
            </>
          )}
        </button>
      </div>
    </div>
  );
});
