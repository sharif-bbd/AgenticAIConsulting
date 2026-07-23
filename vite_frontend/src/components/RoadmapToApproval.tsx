import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronRight } from 'lucide-react';

interface RoadmapToApprovalProps {
  latestCritique: any;
}

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

const Award = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

export const RoadmapToApproval: React.FC<RoadmapToApprovalProps> = React.memo(({ latestCritique }) => {
  if (!latestCritique || !latestCritique.what_would_make_me_sign) return null;

  // Prepare roadmap conditions (with legacy fallback)
  const roadmapConditions = (() => {
    let conditions = latestCritique.winning_conditions || [];
    if (conditions.length === 0 && latestCritique.what_would_make_me_sign) {
      const text = latestCritique.what_would_make_me_sign;
      // Split by (1), (2), etc.
      const parts = text.split(/(?:\(\d+\)|\d+\.|\*\*)/);
      // Skip parts[0] if it's likely an intro (ends with colon or short)
      const potentialItems = parts.map((p: string) => p.trim()).filter((p: string) => p.length > 5);
      if (potentialItems.length > 1 && (parts[0].includes(':') || parts[0].length < 100)) {
        conditions = potentialItems.slice(1);
      } else {
        conditions = potentialItems;
      }
      if (conditions.length === 0) conditions = [text];
    }
    return conditions;
  })();

  if (roadmapConditions.length === 0) return null;

  return (
    <div style={{
      marginTop: '20px',
      padding: '20px',
      background: 'rgba(16, 185, 129, 0.04)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(16, 185, 129, 0.15)',
      borderRadius: '20px',
      animation: 'slideUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'var(--success-muted)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Award style={{ width: '12px', height: '12px', color: 'var(--success)' }} />
        </div>
        <span style={{
          fontSize: '10px',
          fontWeight: 800,
          color: 'var(--success)',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        }}>Roadmap to Approval</span>
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '8px',
        scrollbarWidth: 'none', // Hide scrollbar for cleaner look
        msOverflowStyle: 'none',
      }}>
        <style dangerouslySetInnerHTML={{ __html: `
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}} />
        <div className="no-scrollbar" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {roadmapConditions.map((condition: string, idx: number) => {
            const { summary, details } = splitIssue(condition);
            return (
              <div 
                key={idx}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '14px',
                  padding: '16px',
                  minWidth: '280px',
                  maxWidth: '320px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  flexShrink: 0,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: 'var(--success)',
                    fontFamily: 'var(--font-mono)',
                    opacity: 0.6,
                    marginTop: '2px',
                  }}>0{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      lineHeight: 1.4,
                      letterSpacing: '-0.01em',
                    }}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <span style={{ margin: 0 }}>{children}</span>,
                          strong: ({ children }) => <strong style={{ color: 'var(--text-main)', fontWeight: 800 }}>{children}</strong>
                        }}
                      >
                        {summary}
                      </ReactMarkdown>
                    </div>
                    {details && (
                      <div style={{
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-dim)',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        opacity: 0.85,
                      }}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                          }}
                        >
                          {details}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Finish Line Indicator */}
          <div style={{
            minWidth: '120px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: 0.4,
            border: '2px dashed var(--border-dim)',
            borderRadius: '14px',
            padding: '16px',
          }}>
            <ChevronRight style={{ width: '20px', height: '20px' }} />
            <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sign-off</span>
          </div>
        </div>
      </div>
    </div>
  );
});
