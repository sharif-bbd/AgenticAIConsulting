import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp, MessageSquare, ShieldAlert, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';

interface CircularGaugeProps {
  score: number;
}

const CircularGauge: React.FC<CircularGaugeProps> = ({ score }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const getColor = (s: number) => s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--brand-bright)';
  const getGlow = (s: number) => s >= 80 ? 'rgba(16,185,129,0.4)' : s >= 60 ? 'rgba(245,158,11,0.4)' : 'rgba(59,130,246,0.4)';

  return (
    <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
      <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle
          strokeWidth="5"
          stroke="var(--border-dim)"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
        />
        <circle
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke={getColor(score)}
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.5s ease',
            filter: `drop-shadow(0 0 8px ${getGlow(score)})`,
          }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontSize: '22px',
          fontWeight: 800,
          color: getColor(score),
          letterSpacing: '-0.04em',
          lineHeight: 1,
          fontFamily: 'var(--font-mono)',
        }}>
          {Math.round(score)}
        </span>
        <span style={{
          fontSize: '7px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          marginTop: '3px',
        }}>
          Score
        </span>
      </div>
    </div>
  );
};

interface MetricBarProps {
  label: string;
  value: number;
  max?: number;
}

const MetricBar: React.FC<MetricBarProps> = ({ label, value, max = 25 }) => {
  const [width, setWidth] = useState(0);
  const pct = (value / max) * 100;

  React.useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setWidth(pct), 100);
    return () => clearTimeout(timer);
  }, [pct]);

  const getBarColor = (p: number) => p >= 80 ? 'var(--success)' : p >= 60 ? 'var(--warning)' : 'var(--brand-bright)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: '9px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
        }}>{label}</span>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--text-main)',
          fontFamily: 'var(--font-mono)',
        }}>
          {value}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{max}</span>
        </span>
      </div>
      <div style={{
        height: '6px',
        background: 'rgba(15, 23, 42, 0.05)',
        borderRadius: '99px',
        overflow: 'hidden',
        border: '1px solid var(--border-dim)',
      }}>
        <div style={{
          height: '100%',
          width: `${width}%`,
          background: getBarColor(pct),
          borderRadius: '99px',
          transition: 'width 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: `0 0 10px ${pct >= 80 ? 'rgba(16,185,129,0.3)' : pct >= 60 ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'}`,
          position: 'relative',
        }}>
          {/* Subtle shine effect */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            transform: 'translateX(-100%)',
            animation: 'shimmer 2.5s infinite linear',
          }} />
        </div>
      </div>
    </div>
  );
};

interface ReviewApproveProps {
  qualityScore: number;
  critiqueHistory: any[];
  activeComments?: { id: string; section: string; text: string; comment: string }[];
  onApprove: (overrides?: any, directive?: string) => void;
  isLoading?: boolean;
  isMaximized?: boolean;
}

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

export const ReviewApprove: React.FC<ReviewApproveProps> = React.memo(({
  qualityScore,
  critiqueHistory,
  activeComments = [],
  onApprove,
  isLoading,
  isMaximized = false,
}) => {
  const [directive, setDirective] = useState('');
  const [persona, setPersona] = useState('');

  const handleFinalApprove = () => {
    let finalDirective = directive;
    if (persona === 'Fritz') {
      const fritzText = `Evaluate this proposal using the persona of Fritz:
Fritz is a very experienced IT manager in his mid-fifties. Originally, he is a computer scientist from ETH Zurich, who after leaving ETH did a PhD on a managerial IT topic at a university, and then started his career as IT manager in various organizations and roles, either being a line manager for large organizations (up to several thousand people reporting to him), or as a project manager for large scale projects (100m+ budget). Fritz is interested in understanding technology, but not necessarily at great depth, focusing more on what a technology can achieve for the business than the details of the technology as such. For this, he loves interacting with technical experts, who explain to him the technology in sufficient depth to assess business utility, without getting bogged down in nitty gritty details. He trusts technical experts a lot, once they have established credibility with him. In organizations, he is a genuine innovator, pushing novel ways of doing things, empowering technical experts to try out new solutions. Using marketing speech without solid backup or a good explanation very quickly undermines the trust Fritz has in the person, and a person having done so usually ends up as being ignored by him. From a Myers-Briggs type, he is an INTJ, often characterized as "Architect", with some traits of an ENTJ "Commander".`;
      finalDirective = finalDirective ? `${finalDirective}\n\n${fritzText}` : fritzText;
    }
    onApprove(undefined, finalDirective);
  };
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    const newIndices = new Set(expandedIndices);
    if (newIndices.has(index)) newIndices.delete(index);
    else newIndices.add(index);
    setExpandedIndices(newIndices);
  };



  const splitIssue = (text: string) => {
    // 1. Primary pattern (Strict): **SEVERITY: Summary** Details
    const strictMatch = text.match(/^(\*\*(.*?):\s*(.*?)\*\*)\s*([\s\S]*)$/);
    if (strictMatch) {
      return {
        severity: strictMatch[2].trim().toUpperCase(),
        summary: strictMatch[3].trim(),
        details: strictMatch[4].trim()
      };
    }

    // 2. Loose pattern: SEVERITY: Summary - Details (No bolding)
    const looseMatch = text.match(/^(CRITICAL|HIGH|MEDIUM|LOW|URGENT):\s*(.*?)\s*[-:]\s*([\s\S]*)$/i);
    if (looseMatch) {
      return {
        severity: looseMatch[1].trim().toUpperCase(),
        summary: looseMatch[2].trim(),
        details: looseMatch[3].trim()
      };
    }

    // 3. Fallback: **Summary** Details
    const boldFallback = text.match(/^(\*\*(.*?)\*\*)\s*([\s\S]*)$/);
    if (boldFallback) {
      return { severity: '', summary: boldFallback[2], details: boldFallback[3] };
    }

    return { severity: '', summary: text, details: '' };
  };

  const SeverityBadge = ({ level }: { level: string }) => {
    if (!level) return null;

    let colors = { bg: 'var(--brand-muted)', text: 'var(--brand-bright)', border: 'var(--brand-border)' };

    if (level === 'CRITICAL') {
      colors = { bg: 'rgba(239, 68, 68, 0.08)', text: '#f87171', border: 'rgba(239, 68, 68, 0.2)' };
    } else if (level === 'HIGH') {
      colors = { bg: 'rgba(245, 158, 11, 0.08)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.2)' };
    }

    return (
      <span style={{
        fontSize: '9px',
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: '6px',
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginRight: '10px',
        flexShrink: 0,
      }}>
        {level}
      </span>
    );
  };
  const latestCritique = critiqueHistory[critiqueHistory.length - 1];
  const scores = latestCritique?.scores || { urgency: 0, empathy: 0, clarity: 0, differentiation: 0 };
  const critiqueCount = activeComments.length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      animation: 'slideUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
      maxWidth: isMaximized ? '900px' : undefined,
    }}>
      {/* ... Hero Assessment Card remains same ... */}
      <div style={{ ...cardStyle }}>
        {/* Top accent */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, var(--brand) 0%, var(--accent) 100%)',
        }} />

        {/* Header Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                <TrendingUp style={{ width: '14px', height: '14px', color: 'var(--brand-bright)' }} />
              </div>
              <h2 style={{
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--text-main)',
                letterSpacing: '-0.03em',
              }}>
                Quality Assessment
              </h2>
            </div>
            <p style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              paddingLeft: '40px',
            }}>
              Adversarial Executive Review · Round 0{critiqueHistory.length}
            </p>
          </div>
          <CircularGauge score={qualityScore * 100} />
        </div>

        {/* Metric Bars */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMaximized ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
          columnGap: '32px',
          rowGap: '20px',
          marginBottom: latestCritique ? '28px' : 0,
        }}>
          <MetricBar label="Strategic Depth" value={scores.urgency} />
          <MetricBar label="Client Alignment" value={scores.empathy} />
          <MetricBar label="Clarity & Flow" value={scores.clarity} />
          <MetricBar label="Differentiation" value={scores.differentiation} />
        </div>

        {latestCritique ? (
          <>
            <div style={{ height: '1px', background: 'var(--border-dim)', margin: '4px 0 24px' }} />

            {/* Verdict */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px',
              }}>
                <ShieldAlert style={{ width: '14px', height: '14px', color: 'var(--warning)' }} />
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                }}>Executive Verdict</span>
              </div>
              <blockquote style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                fontStyle: 'italic',
                borderLeft: '3px solid var(--brand)',
                paddingLeft: '16px',
                margin: 0,
              }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p style={{ margin: 0, display: 'inline' }}>{children}</p>,
                    em: ({ children }) => <em style={{ color: 'var(--text-main)', fontWeight: 600 }}>{children}</em>,
                    strong: ({ children }) => <strong style={{ color: 'var(--text-main)', fontWeight: 700 }}>{children}</strong>
                  }}
                >
                  {`"${latestCritique.overall_verdict}"`}
                </ReactMarkdown>
              </blockquote>
              <p style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginTop: '8px',
                paddingLeft: '19px',
              }}>
                — {latestCritique.executive_persona}
              </p>
            </div>

            {/* Issues */}
            <div>
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                display: 'block',
                marginBottom: '12px',
              }}>
                Core Resistance Points
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {latestCritique.top_3_issues?.map((issue: string, i: number) => {
                  const { severity, summary, details } = splitIssue(issue);
                  const isExpanded = expandedIndices.has(i);

                  return (
                    <div
                      key={i}
                      onClick={() => toggleExpand(i)}
                      className="discovery-card"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '16px',
                        background: 'var(--bg-input)',
                        borderRadius: '12px',
                        border: isExpanded ? '1px solid var(--brand-border)' : '1px solid var(--border-subtle)',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: isExpanded ? 'var(--brand-bright)' : 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          minWidth: '20px',
                          marginTop: '2px',
                        }}>0{i + 1}</span>

                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '4px',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            lineHeight: 1.4,
                            letterSpacing: '-0.02em',
                          }}>
                            <SeverityBadge level={severity} />
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p style={{ margin: 0, display: 'inline' }}>{children}</p>,
                                strong: ({ children }) => <strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>{children}</strong>
                              }}
                            >
                              {summary}
                            </ReactMarkdown>
                          </div>
                        </div>

                        {details ? (
                          <div style={{
                            padding: '4px',
                            borderRadius: '4px',
                            background: isExpanded ? 'var(--brand-muted)' : 'transparent',
                            transition: 'all 0.2s ease',
                          }}>
                            {isExpanded
                              ? <ChevronUp style={{ width: '12px', height: '12px', color: 'var(--brand-bright)' }} />
                              : <ChevronDown style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                            }
                          </div>
                        ) : null}
                      </div>

                      {details ? (
                        <div style={{
                          height: isExpanded ? 'auto' : '0',
                          opacity: isExpanded ? 1 : 0,
                          overflow: 'hidden',
                          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          paddingLeft: '32px',
                        }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.6,
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border-dim)',
                            marginTop: '8px',
                          }}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                                strong: ({ children }) => <strong style={{ color: 'var(--text-main)', fontWeight: 700 }}>{children}</strong>
                              }}
                            >
                              {details}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

          </>
        ) : null}
      </div>

      {/* Control Actions */}
      <div style={{
        ...cardStyle,
        borderColor: critiqueCount > 0 ? 'var(--brand-border)' : 'var(--border-brand)',
        maxWidth: isMaximized ? '600px' : undefined,
        margin: isMaximized ? '0 auto' : undefined,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare style={{ width: '14px', height: '14px', color: 'var(--brand-bright)' }} />
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-main)',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
            }}>Revision Directive</span>
          </div>

          {critiqueCount > 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'var(--brand-muted)',
              border: '1px solid var(--brand-border)',
              borderRadius: '99px',
              animation: 'pulse 2s ease infinite'
            }}>
              <Sparkles style={{ width: '10px', height: '10px', color: 'var(--brand-bright)' }} />
              <span style={{
                fontSize: '9px',
                fontWeight: 800,
                color: 'var(--brand-bright)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {critiqueCount} Active Highlights
              </span>
            </div>
          ) : null}
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

        <textarea
          placeholder="Inject a course correction, e.g. 'Align more closely with the CFO's efficiency targets and reduce implementation timeline'..."
          autoFocus
          className="input-placeholder-fix"
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '14px 16px',
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
            transition: 'all 0.2s ease',
            marginBottom: '16px',
            display: 'block',
            position: 'relative',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
          value={directive}
          onChange={e => setDirective(e.target.value)}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'var(--brand-border)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-muted)';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />

        <button
          onClick={handleFinalApprove}
          disabled={isLoading}
          style={{
            width: '100%',
            height: '52px',
            background: 'linear-gradient(135deg, var(--brand) 0%, #1d4ed8 100%)',
            color: '#fff',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 700,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontFamily: 'inherit',
            opacity: isLoading ? 0.5 : 1,
            boxShadow: isLoading ? 'none' : '0 4px 20px rgba(37, 99, 235, 0.4)',
          }}
          onMouseEnter={e => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.5)';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = isLoading ? 'none' : '0 4px 20px rgba(37, 99, 235, 0.4)';
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
              <span style={{ fontWeight: 800 }}>Refining Framework…</span>
            </div>
          ) : (
            <>
              <ArrowRight style={{ width: '16px', height: '16px' }} />
              Execute Revision
            </>
          )}
        </button>
      </div>
    </div>
  );
});


