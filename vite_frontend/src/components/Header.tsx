import React from 'react';
import { RefreshCw, DollarSign, Radio } from 'lucide-react';

interface HeaderProps {
  isWorking?: boolean;
  isLoading?: boolean;
  sessionId?: string | null;
  onReset?: () => void;
  onStop?: () => void;
  totalCost?: number;
}

export const Header: React.FC<HeaderProps> = React.memo(({ isWorking, isLoading, sessionId, onReset, onStop, totalCost = 0 }) => {
  const isActive = isWorking || isLoading;

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: '28px',
      paddingBottom: '28px',
      flexShrink: 0,
      borderBottom: '1px solid var(--border-dim)',
      position: 'relative',
    }}>
      {/* ... existing branding ... */}
      {/* Branding Removed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      </div>

      {/* System Meta & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Stats Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1px',
          background: 'var(--bg-glass)',
          border: isActive ? '1px solid var(--brand-border)' : '1px solid var(--border-subtle)',
          borderRadius: '14px',
          overflow: 'hidden',
          transition: 'all 0.5s ease',
        }}>
          {/* Run Cost */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '10px 20px',
            minWidth: '120px',
          }}>
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginBottom: '4px',
            }}>
              <DollarSign style={{ width: '9px', height: '9px' }} />
              Token Cost
            </span>
            <span style={{
              fontSize: '15px',
              fontWeight: 800,
              color: 'var(--text-main)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-0.02em',
            }}>
              ${totalCost.toFixed(3)}
            </span>
          </div>

          <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border-dim)' }} />

          {/* Engine Status */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '10px 20px',
            minWidth: '110px',
            background: isActive ? 'var(--brand-muted)' : 'transparent',
            transition: 'all 0.5s ease',
          }}>
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              color: isActive ? 'var(--brand)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginBottom: '4px',
            }}>
              <Radio style={{ width: '9px', height: '9px' }} />
              {isLoading ? 'Processing' : 'Engine State'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isActive ? 'var(--brand-bright)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 0 8px var(--brand-bright)' : 'none',
                animation: isActive ? 'pulse 1.5s ease infinite' : 'none',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isActive ? 'var(--brand-bright)' : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {isLoading ? 'Busy' : isWorking ? 'Active' : 'Standby'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        {sessionId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isWorking && onStop && (
              <button
                onClick={onStop}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.1)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.05)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239, 68, 68, 0.2)';
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'currentColor' }} />
                Stop Agent
              </button>
            )}

            <button
              onClick={onReset}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-active)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-glass)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <RefreshCw style={{ width: '12px', height: '12px' }} />
              New Run
            </button>
          </div>
        )}
      </div>
    </header>
  );
});
