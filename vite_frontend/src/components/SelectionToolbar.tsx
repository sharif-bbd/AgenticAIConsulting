import React, { useState } from 'react';
import { Sparkles, MessageSquare, X } from 'lucide-react';

interface SelectionToolbarProps {
  position: { top: number; left: number } | null;
  selectedText: string;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  onStartComment?: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = React.memo(({
  position,
  selectedText,
  onClose,
  onSubmit,
  onStartComment,
}) => {
  const [comment, setComment] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  if (!position) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      onSubmit(comment);
      setComment('');
      setIsExpanded(false);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease forwards',
        top: position.top - 10,
        left: position.left,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'auto',
      }}
    >
      {!isExpanded ? (
        <button
          onClick={() => {
            setIsExpanded(true);
            onStartComment?.();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-bright) 100%)',
            border: '1px solid var(--brand-border)',
            boxShadow: 'var(--shadow-premium)',
            color: '#ffffff',
            padding: '7px 14px',
            borderRadius: '99px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-floating)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-premium)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          <Sparkles style={{ width: '12px', height: '12px', color: '#ffffff' }} />
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: '#ffffff',
          }}>Comment</span>
        </button>
      ) : (
        <div style={{
          width: '320px',
          background: 'var(--bg-card)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-floating)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-dim)',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '22px',
                height: '22px',
                background: 'var(--brand-muted)',
                border: '1px solid var(--brand-border)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <MessageSquare style={{ width: '11px', height: '11px', color: 'var(--brand-bright)' }} />
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--text-main)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}>Segment Comment</span>
            </div>
            <button
              onClick={onClose}
              style={{
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'}
            >
              <X style={{ width: '14px', height: '14px' }} />
            </button>
          </div>

          <div style={{ padding: '14px 16px' }}>
            {/* Context */}
            <div style={{ marginBottom: '12px' }}>
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                display: 'block',
                marginBottom: '6px',
              }}>Selected Text</span>
              <p style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                background: 'var(--bg-input)',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-dim)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.55,
              }}>
                "{selectedText}"
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <textarea
                autoFocus
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Suggest a pivot or refinement..."
                style={{
                  width: '100%',
                  height: '80px',
                  fontSize: '12px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  color: 'var(--text-main)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  resize: 'none',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  marginBottom: '10px',
                  display: 'block',
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
              <button
                type="submit"
                disabled={!comment.trim()}
                style={{
                  width: '100%',
                  height: '40px',
                  background: 'linear-gradient(135deg, var(--brand) 0%, #1d4ed8 100%)',
                  color: '#fff',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  cursor: comment.trim() ? 'pointer' : 'not-allowed',
                  opacity: comment.trim() ? 1 : 0.4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'inherit',
                  boxShadow: comment.trim() ? '0 4px 16px rgba(37,99,235,0.4)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Add Comment
                <MessageSquare style={{ width: '11px', height: '11px' }} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
