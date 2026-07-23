"""
FastAPI routes for the Agentic Business Proposal system.

Session lifecycle:
  POST /session/start          → kicks off Agent 1 & 2, returns when HITL #1 interrupt fires
  GET  /session/{id}/state     → poll current state
  POST /session/{id}/submit-transcript  → resume after HITL #1
  POST /session/{id}/approve-draft      → resume after HITL #2
  POST /session/{id}/directive          → inject human directive
  GET  /session/{id}/download-pdf       → retrieve final PDF
"""

from __future__ import annotations

import asyncio
import logging
import threading
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from langgraph.types import Command

from backend.graph import get_graph
from backend.state import Phase
from backend.tools.document_extractor import extract_text_from_upload

logger = logging.getLogger(__name__)
from backend.api.schemas import (
    StartSessionRequest,
    StartSessionResponse,
    SessionStateResponse,
    SubmitTranscriptRequest,
    ApproveDraftRequest,
    InjectDirectiveRequest,
    InjectDirectiveResponse,
    UploadBriefResponse,
    RefineQuestionsRequest,
    RefineQuestionsResponse,
    JumpPhaseRequest,
    JumpPhaseResponse,
)
from backend.logger import current_session_id, get_logs

router = APIRouter(prefix="/session", tags=["sessions"])


def _build_config(session_id: str) -> dict:
    """Build LangGraph thread config for a session."""
    return {"configurable": {"thread_id": session_id}}


def _mark_session_failed(session_id: str, stage: str, exc: BaseException) -> None:
    """Surface a graph crash to the user.
    Pushes a visible log line and writes Phase.FAILED + last_error to state
    so the frontend stops polling and can display the error."""
    from backend.logger import push_log
    err_msg = f"{type(exc).__name__}: {exc}"
    logger.exception("Graph execution failed during %s for session %s", stage, session_id)
    try:
        push_log(f"❌ Workflow halted during {stage}: {err_msg}")
    except Exception:
        pass
    try:
        graph = get_graph()
        graph.update_state(
            _build_config(session_id),
            {"current_phase": Phase.FAILED, "last_error": err_msg},
        )
    except Exception:
        logger.exception("Failed to record FAILED state for session %s", session_id)


@router.post("/{session_id}/stop")
async def stop_session(session_id: str):
    """
    Signal the agents to stop execution for this session.
    Sets the is_cancelled flag in the graph state.
    """
    graph = get_graph()
    config = _build_config(session_id)
    
    graph.update_state(config, {
        "is_cancelled": True,
    })
    
    return {"session_id": session_id, "message": "Cancellation signal sent to agents."}


# ── POST /session/{id}/jump ─────────────────────────────────────────────────

@router.post("/{session_id}/jump", response_model=JumpPhaseResponse)
async def jump_phase(session_id: str, request: JumpPhaseRequest):
    """
    Force the workflow to jump to a specific target phase.
    This rewinds the graph state and re-triggers execution to hit the appropriate interrupt.
    """
    graph = get_graph()
    config = _build_config(session_id)
    target = request.target_phase
    print(f"[DEBUG] jump_phase: session_id={session_id}, target={target}")

    # Determine which node to 'rewind' to in order to hit the desired interrupt
    rewind_node = None
    if target == Phase.HITL_1:
        rewind_node = "discovery_node"
    elif target == Phase.HITL_2:
        rewind_node = "adversarial_node"
    
    print(f"[DEBUG] jump_phase: identified rewind_node={rewind_node}")

    if rewind_node:
        from backend.logger import push_log
        try:
            # 1. Update state as if we just finished the preceding node
            print(f"[DEBUG] jump_phase: updating state as_node={rewind_node}")
            push_log(f"System: Rewinding workflow to {target}...")
            graph.update_state(config, {"current_phase": target}, as_node=rewind_node)
            
            # 2. Re-invoke the graph in a background thread to reach the interrupt
            def _run_graph():
                print(f"[DEBUG] jump_phase: bg thread starting graph.invoke for {session_id}")
                current_session_id.set(session_id)
                try:
                    # This will run until the next interrupt (the hitl node we want)
                    push_log("System: Re-initializing agents...")
                    graph.invoke(None, config)
                    print(f"[DEBUG] jump_phase: bg thread graph.invoke finished for {session_id}")
                    push_log(f"System: Workflow now ready at {target}.")
                except Exception as exc:
                    print(f"[DEBUG] jump_phase: bg thread graph.invoke FAILED: {exc}")
                    _mark_session_failed(session_id, f"phase jump to {target}", exc)

            threading.Thread(target=_run_graph, daemon=True).start()
            message = f"Jumped to phase {target} and re-synchronized workflow engine."
        except Exception as exc:
            print(f"[DEBUG] jump_phase: update_state FAILED: {exc}")
            push_log(f"System Error: State update failed: {exc}")
            message = f"Failed to rewind graph: {exc}"
    else:
        # Simple state update for non-interrupt phases
        print(f"[DEBUG] jump_phase: simple state update to {target}")
        graph.update_state(config, {"current_phase": target})
        message = f"Jumped to phase {target} (status updated)."

    return JumpPhaseResponse(
        session_id=session_id,
        current_phase=target,
        message=message,
    )


def _get_current_state(session_id: str) -> dict:
    """Retrieve the current state snapshot for a session."""
    graph = get_graph()
    config = _build_config(session_id)
    snapshot = graph.get_state(config)
    if snapshot is None or snapshot.values is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return snapshot.values


def _get_hitl_interrupt_data(session_id: str) -> dict | None:
    """Retrieve interrupt data if the graph is currently paused at an interrupt."""
    graph = get_graph()
    config = _build_config(session_id)
    snapshot = graph.get_state(config)
    if snapshot and snapshot.tasks:
        for task in snapshot.tasks:
            if hasattr(task, "interrupts") and task.interrupts:
                return task.interrupts[0].value if task.interrupts else None
    return None


# ── POST /session/upload-brief ──────────────────────────────────────────────

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

@router.post("/upload-brief", response_model=UploadBriefResponse)
async def upload_brief(file: UploadFile = File(...)):
    """
    Extract text from an uploaded PDF or DOCX brief.

    This is an extract-only step — it does NOT start a session.
    The frontend displays the extracted text for the consultant to review and
    edit before submitting to POST /session/start as client_inputs[0].

    Accepts: .pdf, .docx (max 10 MB)
    """
    # ── Validate file size ────────────────────────────────────────────────────
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data) // 1024 // 1024} MB). Maximum allowed size is 10 MB.",
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ── Extract text ──────────────────────────────────────────────────────────
    filename = file.filename or "uploaded_brief"
    try:
        extracted_text, page_count = extract_text_from_upload(data, filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ImportError as exc:
        raise HTTPException(
            status_code=501,
            detail=f"Server missing extraction dependency: {exc}",
        )

    # ── Warn if text is suspiciously short (possible scanned PDF) ─────────────
    warning: str | None = None
    if len(extracted_text) < 200 and page_count and page_count > 1:
        warning = (
            "Very little text was extracted — this may be a scanned PDF. "
            "OCR is not supported; consider pasting the text manually."
        )

    return UploadBriefResponse(
        filename=filename,
        extracted_text=extracted_text,
        char_count=len(extracted_text),
        page_count=page_count,
        warning=warning,
    )


# ── POST /session/start ─────────────────────────────────────────────────────

@router.post("/start", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest, background_tasks: BackgroundTasks):
    """
    Start a new proposal generation session.
    Runs Agent 1 (Research) and Agent 2 (Discovery) synchronously,
    then pauses at HITL #1 interrupt.
    """
    session_id = str(uuid.uuid4())
    graph = get_graph()
    config = _build_config(session_id)

    initial_state = {
        "raw_client_inputs": request.client_inputs,
        "meeting_transcript": "",
        "client_profile": {},
        "briefing_dossier": "",
        "probing_questions": [],
        "question_answers": {},
        "proposal_components": {},
        "selected_frameworks": [],
        "critique_history": [],
        "quality_score": 0.0,
        "revision_count": 0,
        "human_directives": [],
        "current_phase": Phase.RESEARCH,
        "messages": [],
        "_refinement_count": 0,
        "is_cancelled": False,
        "total_tokens": 0,
        "total_cost": 0.0,
    }

    # Run graph until the first HITL interrupt (in thread to yield HTTP response immediately)
    def _run_graph():
        current_session_id.set(session_id)
        try:
            graph.invoke(initial_state, config)
        except Exception as exc:
            _mark_session_failed(session_id, "research/discovery", exc)

    threading.Thread(target=_run_graph, daemon=True).start()

    return StartSessionResponse(
        session_id=session_id,
        message="Agents dispatched. Monitoring progress...",
        current_phase="RESEARCH_RUNNING",
    )


# ── GET /session/{id}/logs ──────────────────────────────────────────────────

@router.get("/{session_id}/logs")
async def fetch_logs(session_id: str, cursor: int = 0):
    """Fetch live streaming logs emitted by the agents."""
    logs = get_logs(session_id, cursor)
    return {"logs": logs, "next_cursor": cursor + len(logs)}


# ── GET /session/{id}/state ─────────────────────────────────────────────────

@router.get("/{session_id}/state", response_model=SessionStateResponse)
async def get_state(session_id: str):
    """Poll the current state of a session."""
    state = _get_current_state(session_id)
    hitl_data = _get_hitl_interrupt_data(session_id)

    client_profile = state.get("client_profile", {})
    output_info = client_profile.get("_output", {})

    return SessionStateResponse(
        session_id=session_id,
        current_phase=state.get("current_phase", Phase.INTAKE),
        client_profile={k: v for k, v in client_profile.items() if not k.startswith("_")},
        probing_questions=state.get("probing_questions"),
        question_answers=state.get("question_answers"),
        proposal_components=state.get("proposal_components"),
        quality_score=state.get("quality_score"),
        revision_count=state.get("revision_count"),
        critique_history=state.get("critique_history"),
        selected_frameworks=state.get("selected_frameworks"),
        hitl_interrupt_data=hitl_data,
        output_ready=state.get("current_phase") == Phase.COMPLETE,
        pdf_path=output_info.get("pdf_path"),
        markdown_path=output_info.get("markdown_path"),
        total_tokens=state.get("total_tokens", 0),
        total_cost=state.get("total_cost", 0.0),
        last_error=state.get("last_error"),
    )


# ── POST /session/{id}/submit-transcript ───────────────────────────────────

@router.post("/{session_id}/submit-transcript", response_model=SessionStateResponse)
async def submit_transcript(session_id: str, request: SubmitTranscriptRequest):
    """
    Resume after HITL #1: provide meeting transcript to trigger Agents 3–5.
    Graph runs until HITL #2 interrupt.
    """
    graph = get_graph()
    config = _build_config(session_id)

    # Verify session is at HITL #1
    state = _get_current_state(session_id)
    current_phase = state.get("current_phase")
    if current_phase not in (Phase.HITL_1, Phase.QUESTION_GEN):
        raise HTTPException(
            status_code=400,
            detail=f"Session is at phase '{current_phase}', not awaiting transcript submission.",
        )

    resume_value = {
        "meeting_transcript": request.meeting_transcript,
        "human_directives": request.human_directives,
    }

    # Update probing questions and estimates if consultant revised them
    updates: dict = {}
    if request.updated_questions:
        updates["probing_questions"] = request.updated_questions
    if hasattr(request, "timeline_estimate") and request.timeline_estimate is not None:
        updates["timeline_estimate"] = request.timeline_estimate
    if hasattr(request, "fee_estimate") and request.fee_estimate is not None:
        updates["fee_estimate"] = request.fee_estimate
        
    if updates:
        graph.update_state(config, updates)

    # Resume execution in a background thread so the HTTP request returns immediately.
    # The frontend polls GET /state until the phase advances to HITL_2.
    def _run_graph():
        current_session_id.set(session_id)
        try:
            graph.invoke(Command(resume=resume_value), config=config)
        except Exception as exc:
            _mark_session_failed(session_id, "drafting/critique loop", exc)

    threading.Thread(target=_run_graph, daemon=True).start()

    # Return current state immediately — phase will be DRAFTING
    state = _get_current_state(session_id)
    client_profile = state.get("client_profile", {})
    output_info = client_profile.get("_output", {})
    return SessionStateResponse(
        session_id=session_id,
        current_phase=Phase.DRAFTING,
        client_profile={k: v for k, v in client_profile.items() if not k.startswith("_")},
        probing_questions=state.get("probing_questions"),
        question_answers=state.get("question_answers"),
        proposal_components=state.get("proposal_components"),
        quality_score=state.get("quality_score"),
        revision_count=state.get("revision_count"),
        critique_history=state.get("critique_history"),
        selected_frameworks=state.get("selected_frameworks"),
        hitl_interrupt_data=None,
        output_ready=False,
        pdf_path=output_info.get("pdf_path"),
        markdown_path=output_info.get("markdown_path"),
        total_tokens=state.get("total_tokens", 0),
        total_cost=state.get("total_cost", 0.0),
        last_error=state.get("last_error"),
    )


# ── POST /session/{id}/approve-draft ───────────────────────────────────────

@router.post("/{session_id}/approve-draft", response_model=SessionStateResponse)
async def approve_draft(session_id: str, request: ApproveDraftRequest):
    """
    Resume after HITL #2: approve the draft (with optional edits) to trigger Agent 6.
    Graph runs to completion and generates the final PDF.
    """
    graph = get_graph()
    config = _build_config(session_id)

    # Verify session is at HITL #2
    state = _get_current_state(session_id)
    current_phase = state.get("current_phase")
    if current_phase not in (Phase.HITL_2, Phase.CRITIQUING):
        raise HTTPException(
            status_code=400,
            detail=f"Session is at phase '{current_phase}', not awaiting draft approval.",
        )

    # Build resume value
    resume_value: dict = {
        "human_directives": request.human_directives,
    }
    if request.proposal_overrides:
        resume_value["proposal_components"] = request.proposal_overrides

    # Resume execution in a background thread so the HTTP request returns immediately.
    # The frontend polls GET /state until the phase advances to COMPLETE.
    def _run_graph():
        current_session_id.set(session_id)
        try:
            graph.invoke(Command(resume=resume_value), config=config)
        except Exception as exc:
            _mark_session_failed(session_id, "final output rendering", exc)

    threading.Thread(target=_run_graph, daemon=True).start()

    # Return current state immediately — phase will be OUTPUT
    state = _get_current_state(session_id)
    client_profile = state.get("client_profile", {})
    output_info = client_profile.get("_output", {})
    return SessionStateResponse(
        session_id=session_id,
        current_phase=Phase.OUTPUT,
        client_profile={k: v for k, v in client_profile.items() if not k.startswith("_")},
        probing_questions=state.get("probing_questions"),
        question_answers=state.get("question_answers"),
        proposal_components=state.get("proposal_components"),
        quality_score=state.get("quality_score"),
        revision_count=state.get("revision_count"),
        critique_history=state.get("critique_history"),
        selected_frameworks=state.get("selected_frameworks"),
        hitl_interrupt_data=None,
        output_ready=False,
        pdf_path=output_info.get("pdf_path"),
        markdown_path=output_info.get("markdown_path"),
        total_tokens=state.get("total_tokens", 0),
        total_cost=state.get("total_cost", 0.0),
        last_error=state.get("last_error"),
    )


# ── POST /session/{id}/refine-questions ─────────────────────────────────────

@router.post("/{session_id}/refine-questions", response_model=RefineQuestionsResponse)
async def refine_questions(session_id: str, request: RefineQuestionsRequest):
    """
    Regenerate probing questions with a consultant refinement directive.
    Resumes graph at HITL #1, loops back to discovery_node, and pauses at HITL #1 again.
    """
    from langgraph.types import Command

    graph = get_graph()
    config = _build_config(session_id)

    # Verify session is at HITL #1
    state = _get_current_state(session_id)
    current_phase = state.get("current_phase")
    if current_phase not in (Phase.HITL_1, Phase.QUESTION_GEN):
        raise HTTPException(
            status_code=400,
            detail=f"Session is at phase '{current_phase}', not awaiting question refinement.",
        )

    # Increment refinement count
    refinement_count = state.get("_refinement_count", 0) + 1
    graph.update_state(config, {"_refinement_count": refinement_count})

    # Resume graph parsing the refinement directive to cause a loop in hitl_1_node
    resume_value = {"refinement_directive": request.refinement_directive}

    try:
        # Invoke synchronously. It will run discovery_node and then pause at hitl_1_node again.
        await asyncio.to_thread(graph.invoke, Command(resume=resume_value), config)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Question refinement failed: {exc}")

    # Fetch new state after pausing
    new_state = _get_current_state(session_id)
    new_questions = new_state.get("probing_questions", [])
    new_answers = new_state.get("question_answers", {})

    return RefineQuestionsResponse(
        session_id=session_id,
        probing_questions=new_questions,
        question_answers=new_answers,
        refinement_count=refinement_count,
        message=f"Questions regenerated (refinement round {refinement_count}).",
    )


# ── POST /session/{id}/directive ────────────────────────────────────────────

@router.post("/{session_id}/directive", response_model=InjectDirectiveResponse)
async def inject_directive(session_id: str, request: InjectDirectiveRequest):
    """
    Inject a human directive into the session state (can be done at any paused point).
    Directives are consumed by subsequent agent runs.
    """
    graph = get_graph()
    config = _build_config(session_id)
    state = _get_current_state(session_id)

    existing_directives = state.get("human_directives", [])
    new_directives = existing_directives + [request.directive]

    graph.update_state(config, {"human_directives": new_directives})

    return InjectDirectiveResponse(
        session_id=session_id,
        message=f"Directive added: '{request.directive}'",
        directives_count=len(new_directives),
    )


# ── GET /session/{id}/download-pdf ─────────────────────────────────────────

@router.get("/{session_id}/download-pdf")
async def download_pdf(session_id: str):
    """Download the final generated PDF for a completed session."""
    state = _get_current_state(session_id)

    if state.get("current_phase") != Phase.COMPLETE:
        raise HTTPException(
            status_code=400,
            detail="Proposal is not yet complete. Please complete the approval workflow first.",
        )

    client_profile = state.get("client_profile", {})
    output_info = client_profile.get("_output", {})
    pdf_path = output_info.get("pdf_path")

    if not pdf_path or not Path(pdf_path).exists():
        # Fallback to markdown
        md_path = output_info.get("markdown_path")
        if md_path and Path(md_path).exists():
            return FileResponse(
                path=md_path,
                media_type="text/markdown",
                filename=Path(md_path).name,
            )
        raise HTTPException(status_code=404, detail="Output file not found.")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=Path(pdf_path).name,
    )


# ── GET /session/{id}/download-markdown ────────────────────────────────────

@router.get("/{session_id}/download-markdown")
async def download_markdown(session_id: str):
    """Download the Markdown version of the proposal."""
    state = _get_current_state(session_id)
    client_profile = state.get("client_profile", {})
    output_info = client_profile.get("_output", {})
    md_path = output_info.get("markdown_path")

    if not md_path or not Path(md_path).exists():
        raise HTTPException(status_code=404, detail="Markdown file not found.")

    return FileResponse(
        path=md_path,
        media_type="text/markdown",
        filename=Path(md_path).name,
    )
