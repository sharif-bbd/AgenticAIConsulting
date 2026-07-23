import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  MoreHorizontal, Eye, MessageSquare, X as XIcon, 
  ChevronDown, Layers, ListFilter, Maximize2, Minimize2 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SelectionToolbar } from './SelectionToolbar';

interface ProposalPreviewProps {
  currentPhase: string;
  components: Record<string, string>;
  comments: { id: string; section: string; text: string; comment: string }[];
  onCritique: (section: string, text: string, comment: string) => void;
  onDeleteComment: (id: string) => void;
  height?: string;
}

const HighlightedText = React.memo(({ text, sectionId, comments }: { 
  text: string, 
  sectionId: string, 
  comments: { id: string; section: string; text: string; comment: string }[]
}) => {
  const sectionComments = comments.filter(c => c.section === sectionId);
  if (sectionComments.length === 0) return <>{text}</>;

  // Create a map for quick lookup by text
  const commentMap = new Map(sectionComments.map(c => [c.text, c]));
  
  // Sort by length descending to match longest phrases first (standard highlight behavior)
  const phrases = Array.from(commentMap.keys()).sort((a, b) => b.length - a.length);
  
  // Build a single regex to match any of the phrases
  // Using word boundary check to avoid partial matches if needed, but here we match exact text segments
  const escapedPhrases = phrases.map(p => p.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&'));
  const regex = new RegExp(`(${escapedPhrases.join('|')})`, 'g');
  
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => {
        const comment = commentMap.get(part);
        if (comment) {
          const isDraft = comment.id === 'draft';
          return (
            <mark 
              key={`${comment.id}-${i}`}
              data-comment-id={comment.id}
              className="group relative inline-block bg-transparent"
              style={{ 
                background: isDraft ? 'var(--brand-muted)' : 'rgba(37,99,235,0.06)',
                borderBottom: `2px solid ${isDraft ? 'var(--brand-bright)' : 'rgba(37,99,235,0.3)'}`,
                borderRadius: '2px',
                transition: 'all 0.2s ease',
                color: 'inherit',
                cursor: 'pointer'
              }}
            >
              <span className="text-inherit">{part}</span>
            </mark>
          );
        }
        return part;
      })}
    </>
  );
});

const highlightTextNodes = (children: React.ReactNode, sectionId: string, comments: any[]): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return <HighlightedText text={child} sectionId={sectionId} comments={comments} />;
    }
    if (React.isValidElement(child) && child.props && (child.props as any).children) {
      return React.cloneElement(child as React.ReactElement, {
        ...(child.props as any),
        children: highlightTextNodes((child.props as any).children, sectionId, comments),
      });
    }
    return child;
  });
};

const MarkdownRenderer = React.memo(({ content, sectionId, comments, draftHighlight }: {
  content: string;
  sectionId: string;
  comments: any[];
  draftHighlight: any;
}) => {
  const allComments = React.useMemo(() => draftHighlight 
    ? [...comments, { id: 'draft', section: draftHighlight.section, text: draftHighlight.text, comment: '' }]
    : comments, [comments, draftHighlight]);

  const blockProps = (props: any) => {
    const { node, children, ...rest } = props;
    return { ...rest, children: highlightTextNodes(children, sectionId, allComments) };
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (props: any) => <p {...blockProps(props)} />,
        li: (props: any) => <li {...blockProps(props)} />,
        h1: (props: any) => <h1 {...blockProps(props)} />,
        h2: (props: any) => <h2 {...blockProps(props)} />,
        h3: (props: any) => <h3 {...blockProps(props)} />,
        h4: (props: any) => <h4 {...blockProps(props)} />,
        td: (props: any) => <td {...blockProps(props)} />,
        th: (props: any) => <th {...blockProps(props)} />,
        blockquote: (props: any) => <blockquote {...blockProps(props)} />,
        strong: ({ node, ...props }) => <strong {...props} />,
        em: ({ node, ...props }) => <em {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

export const ProposalPreview: React.FC<ProposalPreviewProps> = ({ currentPhase, components, comments, onCritique, onDeleteComment, height }) => {
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [activeSection, setActiveSection] = useState('');
  const [draftHighlight, setDraftHighlight] = useState<{ section: string, text: string } | null>(null);
  const [commentOffsets, setCommentOffsets] = useState<Record<string, number>>({});
  
  const keys = Object.keys(components);
  const isExportPhase = currentPhase === 'COMPLETE';
  const hasComments = comments.length > 0;
  const showSidebar = !isExportPhase && hasComments;
  
  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Accordion State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  const contentRef = useRef<HTMLDivElement>(null);

  // Initialize sections as expanded by default, but only for new keys
  React.useEffect(() => {
    setExpandedSections(prev => {
      const keys = Object.keys(components);
      if (keys.length === 0) return prev;
      
      const next = { ...prev };
      let changed = false;
      keys.forEach(key => {
        if (next[key] === undefined) {
          next[key] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [components]);

  const updateOffsets = React.useCallback(() => {
    if (!contentRef.current) return;
    
    // Batch DOM measurements in a single frame
    requestAnimationFrame(() => {
      if (!contentRef.current) return;
      const newOffsets: Record<string, number> = {};
      const containerRect = contentRef.current.getBoundingClientRect();
      const marks = contentRef.current.querySelectorAll('mark[data-comment-id]');
      
      marks.forEach((mark) => {
        const id = (mark as HTMLElement).dataset.commentId;
        if (id) {
          const rect = mark.getBoundingClientRect();
          newOffsets[id] = Math.round(rect.top - containerRect.top + contentRef.current!.scrollTop);
        }
      });

      // Avoid unnecessary state updates with deep comparison check
      setCommentOffsets(prev => {
        const hasChanged = Object.keys(newOffsets).length !== Object.keys(prev).length ||
          Object.keys(newOffsets).some(key => Math.abs(newOffsets[key] - prev[key]) > 0.5);
        return hasChanged ? newOffsets : prev;
      });
    });
  }, [comments, draftHighlight, components]);

  // Track coordinates of highlights
  useLayoutEffect(() => {
    updateOffsets();
    
    let resizeTimer: any;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateOffsets, 100);
    };

    window.addEventListener('resize', handleResize);
    // Re-check after potential transitions
    const transitionTimer = setTimeout(updateOffsets, 400); 

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      clearTimeout(transitionTimer);
    };
  }, [updateOffsets, expandedSections, showSidebar]);

  // Re-calculate offsets after a new comment is added (grid layout may have changed)
  React.useEffect(() => {
    if (comments.length === 0) return;
    // Wait for CSS grid transition (400ms) + a small buffer before measuring
    const t1 = setTimeout(updateOffsets, 50);
    const t2 = setTimeout(updateOffsets, 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [comments.length]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    Object.keys(components).forEach(key => { next[key] = true; });
    setExpandedSections(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    Object.keys(components).forEach(key => { next[key] = false; });
    setExpandedSections(next);
  };

  const handleMouseUp = () => {
    if (currentPhase === 'COMPLETE') return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!contentRef.current) return;
    const contentRect = contentRef.current.getBoundingClientRect();

    let node: Node | null = range.startContainer;
    let sectionName = '';
    while (node && node !== contentRef.current) {
      if (node instanceof HTMLElement && node.dataset.section) {
        sectionName = node.dataset.section;
        break;
      }
      node = node.parentNode;
    }

    setSelectedText(selection.toString());
    setActiveSection(sectionName);
    
    setToolbarPos({
      top: rect.top - contentRect.top + contentRef.current.scrollTop,
      left: rect.left - contentRect.left + rect.width / 2,
    });
  };

  // Auto-hide toolbar when selection is cleared
  React.useEffect(() => {
    const handleSelectionChange = () => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const selection = window.getSelection();
      if ((!selection || selection.isCollapsed) && !draftHighlight) {
        handleCloseToolbar();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [draftHighlight]);

  const handleStartComment = () => {
    setDraftHighlight({ section: activeSection, text: selectedText });
  };

  const handleCloseToolbar = () => {
    setToolbarPos(null);
    setSelectedText('');
    setDraftHighlight(null);
    
    const activeEl = document.activeElement;
    if (!(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'))) {
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleCritiqueSubmit = (comment: string) => {
    onCritique(activeSection, selectedText, comment);
    handleCloseToolbar();
  };

  const canvasElement = (
    <div 
      className={isFullscreen ? 'canvas-fullscreen-portal' : ''}
      style={{
        background: isFullscreen ? '#ffffff' : 'var(--bg-card)',
        backdropFilter: isFullscreen ? 'none' : 'blur(20px)',
        borderRadius: isFullscreen ? '0' : 'var(--radius-lg)',
        border: isFullscreen ? 'none' : '1px solid var(--border-subtle)',
        boxShadow: isFullscreen ? 'none' : 'var(--shadow-floating)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: isFullscreen ? '100vh' : (height || 'calc(100vh - 100px)'),
        width: isFullscreen ? '100vw' : 'auto',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Canvas Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 28px',
        borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-glass)',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}>
            Marc Brandis · Strategic Consulting
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '9px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }}>Decision Core</span>
            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-dim)' }} />
            <span style={{
              fontSize: '9px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }}>v2.1 Analysis</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {keys.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-dim)',
              borderRadius: '10px',
              marginRight: '8px',
            }}>
              <button
                onClick={expandAll}
                title="Expand All"
                style={{
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-glass-hover)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <Layers style={{ width: '12px', height: '12px' }} />
                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full</span>
              </button>
              <div style={{ width: '1px', height: '12px', background: 'var(--border-dim)' }} />
              <button
                onClick={collapseAll}
                title="Collapse All"
                style={{
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-glass-hover)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <ListFilter style={{ width: '12px', height: '12px' }} />
                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brief</span>
              </button>
            </div>
          )}

          {keys.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              background: 'var(--brand-muted)',
              borderRadius: '99px',
              border: '1px solid var(--brand-border)',
            }}>
              <div style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'var(--brand-bright)',
                boxShadow: '0 0 6px var(--brand-bright)',
                animation: 'pulse 2s ease infinite',
              }} />
              <span style={{
                fontSize: '8px',
                fontWeight: 800,
                color: 'var(--brand-bright)',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}>Canvas Active</span>
            </div>
          )}
          
          <div style={{ width: '1px', height: '16px', background: 'var(--border-dim)', margin: '0 4px' }} />

          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
            style={{
              color: isFullscreen ? 'var(--brand-bright)' : 'var(--text-muted)',
              background: isFullscreen ? 'var(--brand-muted)' : 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (!isFullscreen) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-glass)';
              }
            }}
            onMouseLeave={e => {
              if (!isFullscreen) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                (e.currentTarget as HTMLButtonElement).style.background = 'none';
              }
            }}
          >
            {isFullscreen ? <Minimize2 style={{ width: '16px', height: '16px' }} /> : <Maximize2 style={{ width: '16px', height: '16px' }} />}
          </button>

          <button style={{
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '6px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-glass)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLButtonElement).style.background = 'none';
            }}
          >
            <MoreHorizontal style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showSidebar ? 'minmax(0, 1fr) 280px' : '1fr',
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        transition: 'grid-template-columns 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        
        {/* Scrollable Content Column */}
        <div
          ref={contentRef}
          onMouseUp={handleMouseUp}
          style={{
            overflowY: 'auto',
            padding: showSidebar ? '40px 0 60px 72px' : '40px 0 60px 0',
            cursor: currentPhase === 'COMPLETE' ? 'default' : 'text',
            animation: 'fadeIn 0.6s ease forwards',
            scrollBehavior: 'smooth',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {toolbarPos && (
            <SelectionToolbar
              position={toolbarPos}
              selectedText={selectedText}
              onClose={handleCloseToolbar}
              onSubmit={handleCritiqueSubmit}
              onStartComment={handleStartComment}
            />
          )}

          {keys.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '20px',
              padding: '60px 40px',
            }}>
              <div style={{
                width: '72px',
                height: '72px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Eye style={{ width: '28px', height: '28px', color: 'var(--text-muted)' }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Canvas Ready</h3>
              <p style={{ opacity: 0.6, fontSize: '12px' }}>Waiting for intelligence synthesis...</p>
            </div>
          ) : (
            <div style={{ 
              width: '100%',
              maxWidth: '600px', 
              margin: showSidebar ? '0' : '0 auto',
              transition: 'margin 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              {keys.map((key, index) => {
                const isExpanded = expandedSections[key];
                const sectionNumber = `${index + 1}.0`;
                
                const currentContent = components[key]?.trim() || '';
                const prevKey = index > 0 ? keys[index - 1] : null;
                const prevContent = prevKey ? components[prevKey]?.trim() || '' : '';
                
                const endsWithPunctuation = /[.!?:"”]$/.test(prevContent);
                const startsWithLowercase = /^[a-z]/.test(currentContent);
                const isSeamlessJoin = prevContent && !endsWithPunctuation && startsWithLowercase;

                return (
                  <section 
                    key={key} 
                    data-section={key} 
                    style={{ 
                      marginBottom: isExpanded ? (isSeamlessJoin ? '24px' : '48px') : '4px',
                      transition: 'margin-bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative',
                    }}
                  >
                    <button 
                      onClick={() => toggleSection(key)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: isSeamlessJoin ? '8px' : '16px',
                        borderBottom: isSeamlessJoin ? '1px dashed var(--border-dim)' : '1px solid var(--border-dim)',
                        marginBottom: isExpanded ? (isSeamlessJoin ? '16px' : '28px') : '12px',
                        marginTop: isSeamlessJoin ? '-4px' : '0',
                        opacity: isSeamlessJoin ? 0.6 : 1,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderBottomColor = 'var(--border-active)';
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderBottomColor = 'var(--border-dim)';
                        if (isSeamlessJoin && !isExpanded) e.currentTarget.style.opacity = '0.6';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="badge badge-brand" style={{ 
                          padding: isSeamlessJoin ? '2px 8px' : '4px 10px',
                          fontSize: isSeamlessJoin ? '8px' : '9px'
                        }}>
                          {sectionNumber}
                        </span>
                        <span style={{
                          fontSize: isSeamlessJoin ? '9px' : '11px',
                          fontWeight: 800,
                          color: isExpanded ? 'var(--text-main)' : 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.2em',
                          transition: 'color 0.3s ease',
                        }}>
                          {key.replace(/_/g, ' ')}
                          {isSeamlessJoin && <span style={{ marginLeft: '8px', opacity: 0.5, fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>(Continuous)</span>}
                        </span>
                      </div>
                      <div style={{ 
                        color: 'var(--text-dim)', 
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}>
                        <ChevronDown style={{ width: '14px', height: '14px' }} />
                      </div>
                    </button>

                    <div style={{
                      display: 'grid',
                      gridTemplateRows: isExpanded ? '1fr' : '0fr',
                      transition: 'grid-template-rows 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      overflow: 'hidden',
                      opacity: isExpanded ? 1 : 0,
                      transform: isExpanded ? 'translateY(0)' : 'translateY(-8px)',
                      filter: isExpanded ? 'blur(0)' : 'blur(4px)',
                      pointerEvents: isExpanded ? 'auto' : 'none',
                      transitionProperty: 'grid-template-rows, opacity, transform, filter',
                    }}>
                      <div style={{ minHeight: 0 }}>
                        <div className="proposal-body" style={{ 
                          marginTop: isSeamlessJoin ? '-8px' : '0'
                        }}>
                          <MarkdownRenderer 
                            content={components[key]}
                            sectionId={key}
                            comments={comments}
                            draftHighlight={draftHighlight}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* Static Margin Column */}
        {showSidebar && (
          <div style={{
            borderLeft: '1px solid var(--border-dim)',
            background: 'rgba(255,255,255,0.01)',
            position: 'relative',
            overflow: 'visible',
          }}>
            {comments.map((comment) => {
              const top = commentOffsets[comment.id];
              const isExpanded = expandedSections[comment.section];
              if (top === undefined || !isExpanded) return null;
              
              return (
                <div
                  key={comment.id}
                  style={{
                    position: 'absolute',
                    top: top,
                    left: '12px',
                    width: '256px',
                    transform: 'translateY(-20px)',
                    animation: 'fadeIn 0.3s ease forwards',
                    zIndex: 5,
                  }}
                >
                  <CommentCard 
                    comment={comment} 
                    onDelete={onDeleteComment} 
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Canvas Footer */}
      <div style={{
        padding: '12px 28px',
        borderTop: '1px solid var(--border-dim)',
        background: 'var(--bg-glass)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '9px', opacity: 0.4, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', opacity: 0.5 }} />
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand)', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, background: '#ffffff', zIndex: 9999, overflow: 'auto' }}>
        {canvasElement}
      </div>,
      document.body
    );
  }

  return canvasElement;
};

const CommentCard = React.memo(({ comment, onDelete }: { comment: any, onDelete: (id: string) => void }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: 'var(--shadow-premium)',
    fontSize: '11px',
    lineHeight: 1.5,
    position: 'relative',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}>
        <MessageSquare style={{ width: '10px', height: '10px' }} />
        <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comment</span>
      </div>
      <button 
        onClick={() => onDelete(comment.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
      >
        <XIcon style={{ width: '12px', height: '12px' }} />
      </button>
    </div>
    <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{comment.comment}</p>
    
    <div style={{
      position: 'absolute',
      right: '100%',
      top: '20px',
      width: '12px',
      height: '1px',
      background: 'var(--border-subtle)',
    }} />
  </div>
));
