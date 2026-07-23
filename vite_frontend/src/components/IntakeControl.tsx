import React from 'react';
import { Upload, FileText, ArrowRight, X, Sparkles } from 'lucide-react';
import { api } from '../api';

interface IntakeControlProps {
  onStart: (brief: string) => void;
  isLoading: boolean;
}

export const IntakeControl: React.FC<IntakeControlProps> = React.memo(({ onStart, isLoading }) => {
  const [brief, setBrief] = React.useState('');
  const [tab, setTab] = React.useState<'paste' | 'upload'>('paste');
  const [isDragging, setIsDragging] = React.useState(false);
  const [extractedData, setExtractedData] = React.useState<{ text: string; filename: string } | null>(null);

  const handleFileUpload = async (file: File) => {
    try {
      const data = await api.uploadBrief(file);
      setExtractedData({ text: data.extracted_text, filename: file.name });
      setBrief(data.extracted_text);
      setTab('paste');
    } catch (err) {
      alert('Failed to upload file. Ensure it is a valid PDF or DOCX.');
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      backdropFilter: 'blur(20px)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-premium)',
      padding: '20px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle top gradient glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, var(--brand) 0%, var(--accent) 100%)',
      }} />

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{
            width: '28px', height: '28px',
            background: 'var(--brand-muted)',
            border: '1px solid var(--brand-border)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles style={{ width: '13px', height: '13px', color: 'var(--brand-bright)' }} />
          </div>
          <h3 style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
          }}>Client Intake</h3>
        </div>
        <p style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          fontWeight: 500,
          lineHeight: 1.5,
          paddingLeft: '38px',
        }}>
          Initialize the strategy engine with a client brief or situation summary.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border-dim)',
        borderRadius: '10px',
        padding: '3px',
        gap: '2px',
        marginBottom: '16px',
      }}>
        {(['paste', 'upload'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: '7px',
              border: tab === t ? '1px solid var(--border-subtle)' : '1px solid transparent',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              color: tab === t ? 'var(--brand-bright)' : 'var(--text-muted)',
              background: tab === t ? 'var(--bg-app)' : 'transparent',
              boxShadow: tab === t ? 'var(--shadow-premium)' : 'none',
            }}
          >
            {t === 'paste' ? 'Paste Text' : 'Upload Brief'}
          </button>
        ))}
      </div>

      {tab === 'paste' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {extractedData && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'var(--success-muted)',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--success)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText style={{ width: '13px', height: '13px' }} />
                {extractedData.filename}
              </span>
              <button
                onClick={() => { setExtractedData(null); setBrief(''); }}
                style={{
                  color: 'var(--success)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: 0.7,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X style={{ width: '13px', height: '13px' }} />
              </button>
            </div>
          )}
          <textarea
            value={brief}
            autoFocus
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Current situation at Zurich Bank: Need to refine their AI governance strategy…"
            style={{
              width: '100%',
              height: '180px',
              padding: '12px 16px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              fontFamily: 'inherit',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              position: 'relative',
              zIndex: 10,
              pointerEvents: 'auto',
            }}
            className="input-placeholder-fix"
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--brand-border)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-muted)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {/* Character count */}
          {brief.length > 0 && (
            <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {brief.length.toLocaleString()} chars
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
          }}
          style={{
            height: '260px',
            border: `2px dashed ${isDragging ? 'var(--brand-bright)' : 'var(--border-subtle)'}`,
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: isDragging ? 'var(--brand-muted)' : 'var(--bg-input)',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: isDragging ? 'var(--brand-muted)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isDragging ? 'var(--brand-border)' : 'var(--border-dim)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}>
            <Upload style={{ width: '22px', height: '22px', color: isDragging ? 'var(--brand-bright)' : 'var(--text-muted)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Drop your brief here
            </p>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PDF or DOCX supported</p>
          </div>
          <input
            type="file"
            id="file-upload"
            style={{ display: 'none' }}
            accept=".pdf,.docx"
            onChange={e => e.target.files && handleFileUpload(e.target.files[0])}
          />
          <label
            htmlFor="file-upload"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--brand-bright)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              letterSpacing: '0.05em',
            }}
          >
            Browse Files
          </label>
        </div>
      )}

      <button
        disabled={isLoading || !brief.trim()}
        onClick={() => onStart(brief)}
        style={{
          width: '100%',
          marginTop: '16px',
          height: '48px',
          background: 'linear-gradient(135deg, var(--brand) 0%, #1d4ed8 100%)',
          color: '#fff',
          borderRadius: '12px',
          border: 'none',
          fontWeight: 700,
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          cursor: isLoading || !brief.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontFamily: 'inherit',
          boxShadow: isLoading || !brief.trim()
            ? 'none'
            : '0 4px 20px rgba(37, 99, 235, 0.4)',
          opacity: isLoading || !brief.trim() ? 0.4 : 1,
        }}
        onMouseEnter={e => {
          if (!isLoading && brief.trim()) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.5)';
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = brief.trim() ? '0 4px 20px rgba(37, 99, 235, 0.4)' : 'none';
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
            <span style={{ fontWeight: 800 }}>Dispatching Agents…</span>
          </div>
        ) : (
          <>
            Initiate Synthesis
            <ArrowRight style={{ width: '16px', height: '16px' }} />
          </>
        )}
      </button>
    </div>
  );
});
