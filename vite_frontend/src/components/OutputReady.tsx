import React from 'react';
import { Download, CheckCircle2, FileText, Sparkles, RotateCcw } from 'lucide-react';

interface OutputReadyProps {
  sessionId: string;
  pdfPath?: string;
  markdownPath?: string;
  onReset: () => void;
  onBackToReview: () => void;
  isLoading?: boolean;
}

const ProjectAsset = ({ type, href, label, color }: { type: string; href: string; label: string; color: string }) => (
  <a
    href={href}
    download
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      background: 'var(--bg-input)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '14px',
      textDecoration: 'none',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-brand)';
      (e.currentTarget as HTMLAnchorElement).style.background = 'var(--brand-muted)';
      (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-subtle)';
      (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-input)';
      (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 4px 16px ${color}60`,
      }}>
        <FileText style={{ width: '20px', height: '20px', color: '#fff' }} />
      </div>
      <div style={{ textAlign: 'left' }}>
        <h3 style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: '3px',
          letterSpacing: '-0.01em',
        }}>{type} Document</h3>
        <p style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>{label}</p>
      </div>
    </div>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color: 'var(--text-muted)',
      transition: 'color 0.2s ease',
    }}>
      <span style={{
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>Download</span>
      <Download style={{ width: '14px', height: '14px' }} />
    </div>
  </a>
);

export const OutputReady: React.FC<OutputReadyProps> = React.memo(({ sessionId, onReset, onBackToReview, isLoading }) => {
  const baseUrl = 'http://localhost:8000/session';

  return (
    <div style={{
      background: 'var(--bg-card)',
      backdropFilter: 'blur(20px)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-premium)',
      padding: '48px 40px',
      textAlign: 'center',
      animation: 'fadeIn 0.6s ease forwards',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent gradient */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, var(--brand) 0%, var(--success) 50%, var(--accent) 100%)',
      }} />

      {/* Background grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
      }} />

      {/* Success Icon */}
      <div style={{
        width: '64px',
        height: '64px',
        background: 'linear-gradient(135deg, var(--success-muted) 0%, rgba(16,185,129,0.2) 100%)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        boxShadow: '0 0 32px rgba(16,185,129,0.25)',
        position: 'relative',
        zIndex: 1,
      }}>
        <CheckCircle2 style={{ width: '30px', height: '30px', color: 'var(--success)' }} />
      </div>

      <h2 style={{
        fontSize: '24px',
        fontWeight: 800,
        color: 'var(--text-main)',
        marginBottom: '10px',
        letterSpacing: '-0.035em',
        position: 'relative',
        zIndex: 1,
      }}>
        Synthesis Complete
      </h2>
      <p style={{
        fontSize: '13px',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        maxWidth: '300px',
        margin: '0 auto 40px',
        lineHeight: 1.65,
        position: 'relative',
        zIndex: 1,
      }}>
        Your strategic proposal has been generated, critiqued, and formatted for client delivery.
      </p>

      {/* Download Assets */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '36px',
        maxWidth: '400px',
        margin: '0 auto 36px',
        position: 'relative',
        zIndex: 1,
      }}>
        <ProjectAsset
          type="PDF"
          label="Professional Print Edition"
          href={`${baseUrl}/${sessionId}/download-pdf`}
          color="linear-gradient(135deg, #dc2626, #b91c1c)"
        />
        <ProjectAsset
          type="Markdown"
          label="Source Draft"
          href={`${baseUrl}/${sessionId}/download-markdown`}
          color="linear-gradient(135deg, var(--brand), #1d4ed8)"
        />
      </div>

      {/* Footer Actions */}
      <div style={{
        borderTop: '1px solid var(--border-dim)',
        paddingTop: '28px',
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
      }}>
        <button
          onClick={onBackToReview}
          disabled={isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            height: '52px',
            padding: '0 28px',
            background: 'var(--bg-input)',
            color: isLoading ? 'var(--text-muted)' : 'var(--text-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            fontWeight: 700,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseEnter={e => {
            if (isLoading) return;
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-brand)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-bright)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-muted)';
          }}
          onMouseLeave={e => {
            if (isLoading) return;
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-input)';
          }}
        >
          <RotateCcw style={{ 
            width: '15px', 
            height: '15px',
            animation: isLoading ? 'spin 1s linear infinite' : 'none'
          }} />
          {isLoading ? 'Rewinding...' : 'Back to Review'}
        </button>

        <button
          onClick={onReset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            height: '52px',
            padding: '0 32px',
            background: 'linear-gradient(135deg, var(--brand) 0%, #1d4ed8 100%)',
            color: '#fff',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 700,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.5)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(37, 99, 235, 0.4)';
          }}
        >
          <Sparkles style={{ width: '15px', height: '15px' }} />
          New Client Brief
        </button>
      </div>
    </div>
  );
});
