const API_BASE = 'http://localhost:8000/session';

export interface UploadBriefResponse {
  filename: string;
  extracted_text: string;
  char_count: number;
  page_count?: number;
  warning?: string;
}

export interface StartSessionResponse {
  session_id: string;
  message: string;
  current_phase: string;
}

export interface SessionStateResponse {
  session_id: string;
  current_phase: string;
  client_profile?: Record<string, any>;
  probing_questions?: string[];
  question_answers?: Record<string, string>;
  proposal_components?: Record<string, string>;
  quality_score?: number;
  revision_count?: number;
  critique_history?: any[];
  selected_frameworks?: string[];
  hitl_interrupt_data?: any;
  output_ready: boolean;
  pdf_path?: string;
  markdown_path?: string;
  total_tokens: number;
  total_cost: number;
}

export const api = {
  uploadBrief: async (file: File): Promise<UploadBriefResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload-brief`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  startSession: async (brief: string): Promise<StartSessionResponse> => {
    const res = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_inputs: [brief] }),
    });
    if (!res.ok) throw new Error('Start failed');
    return res.json();
  },

  getState: async (sessionId: string): Promise<SessionStateResponse> => {
    const res = await fetch(`${API_BASE}/${sessionId}/state`);
    if (!res.ok) throw new Error('Failed to fetch state');
    return res.json();
  },

  getLogs: async (sessionId: string, cursor: number): Promise<{ logs: string[]; next_cursor: number }> => {
    const res = await fetch(`${API_BASE}/${sessionId}/logs?cursor=${cursor}`);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },

  submitTranscript: async (sessionId: string, transcript: string, questions: string[], directive?: string): Promise<SessionStateResponse> => {
    const res = await fetch(`${API_BASE}/${sessionId}/submit-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_transcript: transcript,
        human_directives: directive ? [directive] : [],
        updated_questions: questions,
      }),
    });
    if (!res.ok) throw new Error('Submission failed');
    return res.json();
  },

  refineQuestions: async (sessionId: string, directive: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/${sessionId}/refine-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refinement_directive: directive }),
    });
    if (!res.ok) throw new Error('Refinement failed');
    return res.json();
  },

  approveDraft: async (sessionId: string, overrides?: Record<string, string>, directive?: string): Promise<SessionStateResponse> => {
    const res = await fetch(`${API_BASE}/${sessionId}/approve-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposal_overrides: overrides,
        human_directives: directive ? [directive] : [],
      }),
    });
    if (!res.ok) throw new Error('Approval failed');
    return res.json();
  },

  injectDirective: async (sessionId: string, directive: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/${sessionId}/inject-directive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directive }),
    });
    if (!res.ok) throw new Error('Injection failed');
    return res.json();
  },

  jumpPhase: async (sessionId: string, targetPhase: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/${sessionId}/jump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_phase: targetPhase }),
    });
    if (!res.ok) throw new Error('Jump failed');
    return res.json();
  },

  stopSession: async (sessionId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/${sessionId}/stop`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Stop failed');
    return res.json();
  },
};
