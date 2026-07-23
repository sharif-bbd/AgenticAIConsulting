"""
LangGraph graph definition for the Agentic Business Proposal system.

Workflow:
  START
    → research_node          (Agent 1: Research Engine)
    → discovery_node         (Agent 2: Discovery Prep)
    → [HITL #1 interrupt]    (human reviews questions, uploads transcript)
    → drafting_node          (Agent 3: Empathy Drafter)
    → framework_node         (Agent 4: Framework Customizer)
    → adversarial_node       (Agent 5: Adversarial Reviewer)
    → [route: revise or advance]
        revise → drafting_node  (loop back with critique)
        advance → [HITL #2 interrupt]  (human reviews final draft)
    → output_node            (Agent 6: Output Engine)
    → END
"""

import os
import sqlite3
from pathlib import Path

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver

from backend.state import AgentState, Phase
from backend.agents.research_agent import research_node
from backend.agents.discovery_agent import discovery_node
from backend.agents.drafting_agent import drafting_node
from backend.agents.framework_agent import framework_node
from backend.agents.adversarial_agent import adversarial_node
from backend.agents.output_agent import output_node

# ── Constants ────────────────────────────────────────────────────────────────
QUALITY_THRESHOLD = 0.80
MAX_REVISIONS = 3

# Persist checkpoints to local SQLite file (in project root)
DB_PATH = Path(__file__).parent.parent / "proposal_sessions.db"


# ── Routing function ─────────────────────────────────────────────────────────

def route_after_adversarial(state: AgentState) -> str:
    """
    After the adversarial reviewer runs, decide whether to:
    - Loop back for another revision round (drafting_node)
    - Advance to HITL #2 for human review (hitl_2_node)
    """
    if state["quality_score"] < QUALITY_THRESHOLD and state["revision_count"] < MAX_REVISIONS:
        return "revise"
    return "advance"


# ── HITL placeholder nodes ────────────────────────────────────────────────────

def hitl_1_node(state: AgentState) -> dict:
    """
    HITL Checkpoint #1: Waits for the consultant to review probing questions,
    conduct the client meeting, and upload the meeting transcript.

    LangGraph's interrupt() pauses execution here. The graph resumes
    when the API receives a /submit-transcript call or a /refine-questions call.
    """
    from langgraph.types import interrupt
    result = interrupt({
        "phase": Phase.HITL_1,
        "message": "Review the probing questions below. Conduct your client meeting, then return to submit the meeting transcript.",
        "probing_questions": state["probing_questions"],
    })
    
    # result contains: {"meeting_transcript": "...", "human_directives": [...]} OR {"refinement_directive": "..."}
    updates: dict = {}
    
    if "refinement_directive" in result:
        # We are looping back to discovery
        updates["current_phase"] = Phase.QUESTION_GEN
        existing = state.get("human_directives", [])
        updates["human_directives"] = existing + [result["refinement_directive"]]
        return updates

    # Otherwise we are advancing
    updates["current_phase"] = Phase.DRAFTING
    if "meeting_transcript" in result:
        updates["meeting_transcript"] = result["meeting_transcript"]
    if "human_directives" in result:
        existing = state.get("human_directives", [])
        updates["human_directives"] = existing + result["human_directives"]
    return updates


def hitl_2_node(state: AgentState) -> dict:
    """
    HITL Checkpoint #2: Presents the stress-tested proposal draft to the consultant.
    The consultant can edit sections, inject directives, and then approve.

    LangGraph's interrupt() pauses execution here. The graph resumes
    when the API receives an /approve-draft call.
    """
    from langgraph.types import interrupt
    result = interrupt({
        "phase": Phase.HITL_2,
        "message": "Review the proposal draft and adversarial critique summary. Edit as needed, then approve.",
        "proposal_components": state["proposal_components"],
        "critique_history": state["critique_history"],
        "quality_score": state["quality_score"],
        "revision_count": state["revision_count"],
    })
    # result contains: {"proposal_components": {...overrides...}, "human_directives": [...]}
    updates: dict = {"current_phase": Phase.OUTPUT}
    if "proposal_components" in result:
        merged = dict(state.get("proposal_components", {}))
        merged.update(result["proposal_components"])
        updates["proposal_components"] = merged
    if "human_directives" in result:
        existing = state.get("human_directives", [])
        updates["human_directives"] = existing + result["human_directives"]
    return updates


# ── Graph construction ────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    builder = StateGraph(AgentState)

    # Register nodes
    builder.add_node("research_node", research_node)
    builder.add_node("discovery_node", discovery_node)
    builder.add_node("hitl_1_node", hitl_1_node)
    builder.add_node("drafting_node", drafting_node)
    builder.add_node("framework_node", framework_node)
    builder.add_node("adversarial_node", adversarial_node)
    builder.add_node("hitl_2_node", hitl_2_node)
    builder.add_node("output_node", output_node)

    # Linear edges
    builder.add_edge(START, "research_node")
    builder.add_edge("research_node", "discovery_node")
    builder.add_edge("discovery_node", "hitl_1_node")
    def route_after_hitl_1(state: AgentState) -> str:
        if state.get("current_phase") == Phase.QUESTION_GEN:
            return "refine"
        return "advance"

    # Edge after hitl_1
    builder.add_conditional_edges(
        "hitl_1_node",
        route_after_hitl_1,
        {
            "refine": "discovery_node",
            "advance": "drafting_node",
        },
    )

    builder.add_edge("drafting_node", "framework_node")
    builder.add_edge("framework_node", "adversarial_node")

    # Conditional edge after adversarial review
    builder.add_conditional_edges(
        "adversarial_node",
        route_after_adversarial,
        {
            "revise": "drafting_node",   # loop back with critique injected
            "advance": "hitl_2_node",    # proceed to human review
        },
    )

    builder.add_edge("hitl_2_node", "output_node")
    builder.add_edge("output_node", END)

    return builder


def compile_graph(checkpointer=None):
    """Compile the graph with an optional checkpointer for persistence."""
    builder = build_graph()
    if checkpointer is None:
        # Use a raw sqlite3 connection — SqliteSaver.from_conn_string() returns a
        # context manager in newer versions and cannot be passed directly to compile().
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        checkpointer = SqliteSaver(conn)
    return builder.compile(checkpointer=checkpointer)


# ── Convenience: get a ready-to-use compiled graph ───────────────────────────

_graph = None


def get_graph():
    """Return a singleton compiled graph instance."""
    global _graph
    if _graph is None:
        _graph = compile_graph()
    return _graph
