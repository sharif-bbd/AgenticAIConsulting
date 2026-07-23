"""
Streamlit frontend for the Agentic Business Proposal system.
Clean dual-pane layout: workflow controls left, live proposal right.
"""

from __future__ import annotations
import time
from pathlib import Path

import httpx
import streamlit as st

API_BASE = "http://localhost:8000/session"

# ── Page config ───────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Proposal Generator · Marc Brandis Strategic Consulting",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Global CSS ────────────────────────────────────────────────────────────────

st.markdown("""
<style>
  /* ── Base ── */
  [data-testid="stAppViewContainer"] { background: #f8f9fa; }
  [data-testid="stMain"] { padding-top: 0; }
  div[data-testid="stSidebar"] { display: none; }
  .block-container { padding: 1.5rem 2rem 2rem 2rem !important; max-width: 100% !important; }

  /* ── Typography ── */
  html, body, [class*="css"] { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; }

  /* ── Header banner ── */
  .app-header {
    background: #1a2942;
    color: white;
    padding: 18px 28px 16px 28px;
    border-radius: 10px;
    margin-bottom: 20px;
    display: flex;
    align-items: baseline;
    gap: 16px;
  }
  .app-header h1 { margin: 0; font-size: 1.3rem; font-weight: 700; color: white; }
  .app-header span { font-size: 0.82rem; color: #93aac8; font-weight: 400; }

  /* ── Phase badge ── */
  .phase-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
    margin-bottom: 16px;
    letter-spacing: 0.3px;
  }
  .phase-waiting  { background:#fff3cd; color:#856404; border:1px solid #ffc107; }
  .phase-running  { background:#cfe2ff; color:#084298; border:1px solid #b6d4fe; }
  .phase-action   { background:#fff0e0; color:#8a4500; border:1px solid #ffb366; }
  .phase-done     { background:#d1e7dd; color:#0a3622; border:1px solid #a3cfbb; }

  /* ── Step cards (left pane) ── */
  .step-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 18px 20px;
    margin-bottom: 14px;
  }
  .step-card.active { border-color: #3b6fd4; border-width: 2px; }
  .step-header {
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #64748b;
    margin-bottom: 10px;
  }
  .step-header.active { color: #3b6fd4; }

  /* ── Proposal section cards (right pane) ── */
  .proposal-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px 22px;
    margin-bottom: 12px;
  }
  .section-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #3b6fd4;
    margin-bottom: 10px;
  }
  .section-text {
    font-size: 0.9rem;
    line-height: 1.65;
    color: #1e293b;
    white-space: pre-wrap;
  }

  /* ── Score bar ── */
  .score-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 7px;
    font-size: 0.82rem;
  }
  .score-label { width: 120px; color: #475569; font-weight: 500; }
  .score-bar-bg {
    flex: 1;
    background: #e2e8f0;
    border-radius: 6px;
    height: 7px;
    overflow: hidden;
  }
  .score-bar-fill {
    height: 7px;
    border-radius: 6px;
    background: #3b6fd4;
    transition: width 0.4s;
  }
  .score-num { width: 36px; text-align: right; color: #1e293b; font-weight: 600; }

  /* ── Critique box ── */
  .critique-card {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    padding: 14px 16px;
    font-size: 0.84rem;
    line-height: 1.55;
    color: #1e293b;
    margin-top: 10px;
  }
  .critique-title { font-weight: 700; color: #92400e; margin-bottom: 8px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; }

  /* ── Log entries ── */
  .log-entry {
    font-size: 0.8rem;
    color: #64748b;
    padding: 4px 0;
    border-bottom: 1px solid #f1f5f9;
  }

  /* ── Right pane header ── */
  .pane-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #94a3b8;
    margin-bottom: 14px;
  }
  .client-chip {
    display: inline-flex;
    gap: 8px;
    background: #f1f5f9;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 0.78rem;
    color: #475569;
    font-weight: 500;
    margin-bottom: 14px;
  }
  .empty-state {
    text-align: center;
    padding: 60px 30px;
    color: #94a3b8;
  }
  .empty-state .icon { font-size: 2.5rem; margin-bottom: 12px; }
  .empty-state p { font-size: 0.88rem; line-height: 1.6; max-width: 280px; margin: 0 auto; }

  /* ── Question list ── */
  .question-item {
    background: #f8fafc;
    border-left: 3px solid #3b6fd4;
    border-radius: 0 6px 6px 0;
    padding: 8px 12px;
    font-size: 0.85rem;
    color: #1e293b;
    margin-bottom: 6px;
    line-height: 1.45;
  }

  /* ── Streamlit widget tweaks ── */
  .stTextArea textarea {
    border-radius: 8px !important;
    border-color: #e2e8f0 !important;
    font-size: 0.87rem !important;
  }
  .stTextInput input {
    border-radius: 8px !important;
    border-color: #e2e8f0 !important;
    font-size: 0.87rem !important;
  }
  .stButton > button {
    border-radius: 8px !important;
    font-weight: 600 !important;
    font-size: 0.85rem !important;
  }
  div[data-testid="stMetric"] {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 16px;
  }
</style>
""", unsafe_allow_html=True)

# ── Session state ─────────────────────────────────────────────────────────────

defaults = {
    "session_id": None,
    "current_phase": "INTAKE",
    "messages": [],
    "proposal_components": {},
    "probing_questions": [],
    "critique_history": [],
    "quality_score": 0.0,
    "client_profile": {},
    "selected_frameworks": [],
    "pdf_path": None,
    "markdown_path": None,
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── API helpers ───────────────────────────────────────────────────────────────

def api_post(endpoint: str, payload: dict, timeout: float = 300.0) -> dict | None:
    try:
        r = httpx.post(f"{API_BASE}{endpoint}", json=payload, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        st.error(f"API error {e.response.status_code}: {e.response.text[:300]}")
    except Exception as e:
        st.error(f"Connection error: {e}")
    return None

def api_get(endpoint: str) -> dict | None:
    try:
        r = httpx.get(f"{API_BASE}{endpoint}", timeout=30.0)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        st.error(f"API error: {e}")
    return None

def poll_until_phase(target_phases: set[str], interval: float = 4.0):
    """Poll GET /state until the session reaches one of the target phases."""
    sync_state()
    if st.session_state.current_phase in target_phases:
        return
    time.sleep(interval)
    sync_state()
    st.rerun()

def sync_state():
    if not st.session_state.session_id:
        return
    data = api_get(f"/{st.session_state.session_id}/state")
    if not data:
        return
    st.session_state.current_phase      = data.get("current_phase", st.session_state.current_phase)
    st.session_state.proposal_components = data.get("proposal_components") or {}
    st.session_state.probing_questions   = data.get("probing_questions") or []
    st.session_state.critique_history    = data.get("critique_history") or []
    st.session_state.quality_score       = data.get("quality_score") or 0.0
    st.session_state.client_profile      = data.get("client_profile") or {}
    st.session_state.selected_frameworks = data.get("selected_frameworks") or []
    if data.get("pdf_path"):
        st.session_state.pdf_path = data["pdf_path"]
    if data.get("markdown_path"):
        st.session_state.markdown_path = data["markdown_path"]

def add_log(msg: str):
    st.session_state.messages.append(msg)

# ── Phase helpers ─────────────────────────────────────────────────────────────

PHASE_CONFIG = {
    "INTAKE":       ("waiting",  "⬜", "Ready to start"),
    "RESEARCH":     ("running",  "🔵", "Agent 1 — Researching client..."),
    "QUESTION_GEN": ("running",  "🔵", "Agent 2 — Generating questions..."),
    "HITL_1":       ("action",   "🟠", "Action required: Review questions & submit transcript"),
    "DRAFTING":     ("running",  "🔵", "Agents 3 & 4 — Drafting proposal..."),
    "CRITIQUING":   ("running",  "🔵", "Agent 5 — Adversarial review in progress..."),
    "HITL_2":       ("action",   "🟠", "Action required: Review draft & approve"),
    "OUTPUT":       ("running",  "🔵", "Agent 6 — Generating final document..."),
    "COMPLETE":     ("done",     "🟢", "Proposal complete"),
}

def render_phase_badge(phase: str):
    cfg = PHASE_CONFIG.get(phase, ("waiting", "⬜", phase))
    cls = f"phase-{cfg[0]}"
    st.markdown(
        f'<div class="phase-badge {cls}">{cfg[1]}&nbsp; {cfg[2]}</div>',
        unsafe_allow_html=True,
    )

def score_bar_html(label: str, value: int, max_val: int = 25) -> str:
    pct = int(value / max_val * 100)
    color = "#22c55e" if pct >= 72 else "#f59e0b" if pct >= 48 else "#ef4444"
    return f"""
    <div class="score-row">
      <div class="score-label">{label}</div>
      <div class="score-bar-bg"><div class="score-bar-fill" style="width:{pct}%;background:{color}"></div></div>
      <div class="score-num">{value}/25</div>
    </div>"""

# ── Header ────────────────────────────────────────────────────────────────────

st.markdown("""
<div class="app-header">
  <h1>📄 Proposal Generator</h1>
  <span>Marc Brandis Strategic Consulting &nbsp;·&nbsp; ETH Zurich Prototype</span>
</div>
""", unsafe_allow_html=True)

phase = st.session_state.current_phase
if st.session_state.session_id:
    render_phase_badge(phase)

# ── Two-column layout ─────────────────────────────────────────────────────────

left, right = st.columns([1, 1.25], gap="large")

# ══════════════════════════════════════════════════════════════════════════════
# LEFT PANE — Workflow controls
# ══════════════════════════════════════════════════════════════════════════════

with left:

    # ── STEP 1: Submit brief ──────────────────────────────────────────────────
    is_step1_active = phase in ("INTAKE",) or not st.session_state.session_id
    card_class = "step-card active" if is_step1_active else "step-card"
    header_class = "step-header active" if is_step1_active else "step-header"

    st.markdown(f'<div class="{card_class}">', unsafe_allow_html=True)
    st.markdown(f'<div class="{header_class}">Step 1 — Client Brief</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

    if is_step1_active:
        brief = st.text_area(
            "Paste the fuzzy client request",
            height=180,
            placeholder=(
                "e.g. 'I had coffee with the CDO of HelvetiaLogistics — they need to do something about AI "
                "before their Q3 board review. A competitor just launched an AI portal and the board panicked...'"
            ),
            label_visibility="collapsed",
        )
        if st.button("▶  Start — Research & Generate Questions", type="primary",
                     disabled=not (brief or "").strip(), use_container_width=True):
            with st.spinner("Agent 1 researching · Agent 2 generating questions..."):
                result = api_post("/start", {"client_inputs": [brief]})
            if result:
                st.session_state.session_id = result["session_id"]
                st.session_state.current_phase = "HITL_1"
                add_log(f"Session started: {result['session_id'][:8]}…")
                sync_state()
                st.rerun()

    elif phase != "INTAKE":
        profile = st.session_state.client_profile
        company = profile.get("company_name", "—")
        industry = profile.get("industry", "")
        st.markdown(
            f'<div style="font-size:0.85rem;color:#475569;padding:4px 0">'
            f'✅ &nbsp;<strong>{company}</strong>&nbsp; · {industry}</div>',
            unsafe_allow_html=True,
        )

    # ── STEP 2: Questions & transcript ───────────────────────────────────────
    if phase in ("HITL_1", "QUESTION_GEN") or (
        st.session_state.session_id and phase not in ("INTAKE",)
        and not st.session_state.probing_questions == []
        and phase == "HITL_1"
    ):
        st.markdown("")
        is_active = phase == "HITL_1"
        card_class = "step-card active" if is_active else "step-card"
        header_class = "step-header active" if is_active else "step-header"

        st.markdown(f'<div class="{card_class}">', unsafe_allow_html=True)
        st.markdown(f'<div class="{header_class}">Step 2 — Meeting Preparation</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

        if is_active:
            questions = st.session_state.probing_questions
            if questions:
                st.caption("Edit questions if needed, then conduct your meeting and paste the transcript below.")
                edited_qs = []
                for i, q in enumerate(questions):
                    eq = st.text_input(f"Q{i+1}", value=q, key=f"q_{i}", label_visibility="collapsed")
                    edited_qs.append(eq)
            else:
                st.info("Questions loading…")
                edited_qs = []

            st.markdown("**Meeting transcript**")
            transcript = st.text_area(
                "transcript",
                height=200,
                placeholder="Paste your meeting notes or transcript after conducting the client meeting…",
                label_visibility="collapsed",
                key="transcript_input",
            )
            directive = st.text_input(
                "Strategic directive (optional)",
                placeholder="e.g. 'Client mainly worried about board optics, not raw cost savings'",
                key="directive_input",
            )

            if st.button("▶  Submit Transcript & Draft Proposal", type="primary",
                         disabled=not (transcript or "").strip(), use_container_width=True):
                payload = {
                    "meeting_transcript": transcript,
                    "human_directives": [directive] if directive.strip() else [],
                    "updated_questions": [q for q in edited_qs if q.strip()],
                }
                with st.spinner("Submitting transcript..."):
                    result = api_post(f"/{st.session_state.session_id}/submit-transcript", payload, timeout=30.0)
                if result:
                    st.session_state.current_phase = result.get("current_phase", "DRAFTING")
                    add_log("Transcript submitted — agents drafting proposal...")
                    st.rerun()

    # ── STEP 3: Review & approve ──────────────────────────────────────────────
    if phase in ("HITL_2", "CRITIQUING", "OUTPUT", "COMPLETE") and st.session_state.session_id:
        st.markdown("")
        is_active = phase == "HITL_2"
        card_class = "step-card active" if is_active else "step-card"
        header_class = "step-header active" if is_active else "step-header"

        st.markdown(f'<div class="{card_class}">', unsafe_allow_html=True)
        st.markdown(f'<div class="{header_class}">Step 3 — Review & Approve</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

        if is_active:
            # Quality score
            score = int((st.session_state.quality_score or 0) * 100)
            revisions = st.session_state.client_profile.get("_revisions", "—")
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Quality Score", f"{score} / 100")
            with col2:
                rc = 0
                if st.session_state.critique_history:
                    rc = len(st.session_state.critique_history)
                st.metric("Revision Rounds", rc)

            # Latest critique summary
            if st.session_state.critique_history:
                latest = st.session_state.critique_history[-1]
                scores = latest.get("scores", {})
                verdict = latest.get("overall_verdict", "")
                bars = (
                    score_bar_html("Urgency",         scores.get("urgency", 0))
                    + score_bar_html("Empathy",        scores.get("empathy", 0))
                    + score_bar_html("Clarity",        scores.get("clarity", 0))
                    + score_bar_html("Differentiation",scores.get("differentiation", 0))
                )
                issues = latest.get("top_3_issues", [])
                issues_html = "".join(f"<li>{i}</li>" for i in issues)
                persona = latest.get("executive_persona", "Senior Executive")
                st.markdown(f"""
                <div class="critique-card">
                  <div class="critique-title">Adversarial Review — {persona}</div>
                  {bars}
                  <div style="margin-top:10px;font-style:italic;color:#6b7280;font-size:0.82rem">"{verdict}"</div>
                  {"<ul style='margin-top:8px;padding-left:18px;font-size:0.82rem'>" + issues_html + "</ul>" if issues else ""}
                </div>""", unsafe_allow_html=True)

            final_dir = st.text_input(
                "Final adjustments (optional)",
                placeholder="e.g. 'Fee: CHF 4,500/day for Marc. Start date April 14.'",
                key="final_dir",
            )
            if st.button("✅  Approve & Generate Final Document", type="primary", use_container_width=True):
                payload = {
                    "proposal_overrides": None,
                    "human_directives": [final_dir] if final_dir.strip() else [],
                }
                with st.spinner("Submitting approval..."):
                    result = api_post(f"/{st.session_state.session_id}/approve-draft", payload, timeout=30.0)
                if result:
                    st.session_state.current_phase = result.get("current_phase", "OUTPUT")
                    add_log("Draft approved — generating final document...")
                    st.rerun()

        elif phase == "COMPLETE":
            st.success("✅ Proposal finalized")

    # ── STEP 4: Download ──────────────────────────────────────────────────────
    if phase == "COMPLETE" and st.session_state.session_id:
        st.markdown("")
        st.markdown('<div class="step-card active">', unsafe_allow_html=True)
        st.markdown('<div class="step-header active">Step 4 — Download</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

        col1, col2 = st.columns(2)
        md_path = st.session_state.get("markdown_path")
        pdf_path = st.session_state.get("pdf_path")

        with col1:
            if md_path and Path(md_path).exists():
                st.download_button(
                    "⬇ Markdown",
                    data=Path(md_path).read_text(),
                    file_name=Path(md_path).name,
                    mime="text/markdown",
                    use_container_width=True,
                )
        with col2:
            if pdf_path and Path(pdf_path).exists():
                with open(pdf_path, "rb") as f:
                    st.download_button(
                        "⬇ PDF",
                        data=f.read(),
                        file_name=Path(pdf_path).name,
                        mime="application/pdf",
                        use_container_width=True,
                    )
            elif not pdf_path:
                st.caption("PDF unavailable — WeasyPrint system libs missing")

        if st.button("↩  Start New Session", use_container_width=True):
            for k in list(st.session_state.keys()):
                del st.session_state[k]
            st.rerun()

    # ── Directive injection (always available mid-session) ────────────────────
    if st.session_state.session_id and phase not in ("INTAKE", "COMPLETE"):
        with st.expander("Inject directive mid-session"):
            d = st.text_input("Directive", key="live_dir", label_visibility="collapsed",
                              placeholder="e.g. 'Emphasize the AI regulatory deadline'")
            if st.button("Send", key="send_dir"):
                res = api_post(f"/{st.session_state.session_id}/directive", {"directive": d})
                if res:
                    add_log(f"Directive sent: {d}")
                    st.success("Added.")

    # ── Activity log ─────────────────────────────────────────────────────────
    if st.session_state.messages:
        st.markdown("")
        st.markdown('<div class="pane-title">Activity log</div>', unsafe_allow_html=True)
        for msg in reversed(st.session_state.messages[-5:]):
            st.markdown(f'<div class="log-entry">· {msg}</div>', unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════════════════════
# RIGHT PANE — Live proposal artifact
# ══════════════════════════════════════════════════════════════════════════════

with right:
    st.markdown('<div class="pane-title">Live Proposal Draft</div>', unsafe_allow_html=True)

    profile = st.session_state.client_profile
    components = st.session_state.proposal_components

    if not st.session_state.session_id:
        st.markdown("""
        <div class="empty-state">
          <div class="icon">📄</div>
          <p>The proposal will build here in real time as each agent completes its section.<br><br>
          Start by pasting the client brief on the left.</p>
        </div>""", unsafe_allow_html=True)

    else:
        # Client chip
        if profile:
            company  = profile.get("company_name", "")
            industry = profile.get("industry", "")
            domain   = profile.get("problem_domain", "")
            parts    = " · ".join(p for p in [company, industry, domain] if p)
            if parts:
                st.markdown(f'<div class="client-chip">🏢 {parts}</div>', unsafe_allow_html=True)

        # ── Probing questions (shown at HITL #1 before drafting begins) ───────
        questions = st.session_state.probing_questions
        if questions and not components.get("intro"):
            st.markdown('<div class="proposal-card">', unsafe_allow_html=True)
            st.markdown('<div class="section-label">Generated Probing Questions</div>', unsafe_allow_html=True)
            for i, q in enumerate(questions, 1):
                st.markdown(
                    f'<div class="question-item"><strong>{i}.</strong> {q}</div>',
                    unsafe_allow_html=True,
                )
            st.markdown('</div>', unsafe_allow_html=True)

        # ── Proposal sections ─────────────────────────────────────────────────
        SECTIONS = [
            ("intro",          "Introduction"),
            ("understanding",  "Our Understanding of the Situation"),
            ("methodology",    "Methodology and Deliverables"),
            ("approach",       "Potential Approach, Timeline & Team"),
            ("fees",           "Estimated Efforts and Professional Fees"),
        ]

        any_section = False
        for key, title in SECTIONS:
            content = components.get(key, "")
            if content:
                any_section = True
                st.markdown(f"""
                <div class="proposal-card">
                  <div class="section-label">{title}</div>
                  <div class="section-text">{content}</div>
                </div>""", unsafe_allow_html=True)

        if not any_section and not questions:
            if phase in ("RESEARCH", "QUESTION_GEN"):
                st.info("Researching client and generating questions…")
            elif phase == "HITL_1":
                st.info("Questions ready on the left. Submit the meeting transcript to start drafting.")
            elif phase in ("DRAFTING", "CRITIQUING", "OUTPUT"):
                st.info("Agents are working — sections will appear here shortly…")

        # ── Frameworks used ───────────────────────────────────────────────────
        fws = st.session_state.selected_frameworks
        if fws:
            st.markdown(
                f'<div style="font-size:0.78rem;color:#94a3b8;margin-top:6px">'
                f'Frameworks: {" · ".join(fws)}</div>',
                unsafe_allow_html=True,
            )

# ══════════════════════════════════════════════════════════════════════════════
# AUTO-POLL — refresh the page while agents are running in the background
# ══════════════════════════════════════════════════════════════════════════════

if st.session_state.session_id and phase in ("DRAFTING", "CRITIQUING", "OUTPUT"):
    poll_until_phase({"HITL_2", "COMPLETE"})
