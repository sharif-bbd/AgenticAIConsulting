"""
Integration tests for the LangGraph graph structure.
Tests graph topology, routing logic, and HITL interrupt behavior.
Does NOT make real LLM API calls.
"""

import pytest
from unittest.mock import patch, MagicMock

from backend.state import Phase
from backend.graph import route_after_adversarial, QUALITY_THRESHOLD, MAX_REVISIONS


# ── Routing logic ─────────────────────────────────────────────────────────────

class TestRoutingLogic:
    def test_routes_to_revise_when_quality_low_and_under_max(self):
        """Should loop back to drafting when quality is low and revisions < max."""
        state = {
            "quality_score": 0.60,
            "revision_count": 1,
        }
        assert route_after_adversarial(state) == "revise"

    def test_routes_to_advance_when_quality_high(self):
        """Should advance to HITL #2 when quality meets threshold."""
        state = {
            "quality_score": 0.85,
            "revision_count": 1,
        }
        assert route_after_adversarial(state) == "advance"

    def test_routes_to_advance_when_max_revisions_reached(self):
        """Should advance to HITL #2 after max revisions, even with low quality."""
        state = {
            "quality_score": 0.50,
            "revision_count": MAX_REVISIONS,
        }
        assert route_after_adversarial(state) == "advance"

    def test_routes_to_advance_at_exact_threshold(self):
        """Should advance when quality is exactly at the threshold."""
        state = {
            "quality_score": QUALITY_THRESHOLD,
            "revision_count": 0,
        }
        assert route_after_adversarial(state) == "advance"

    def test_routes_to_revise_just_below_threshold(self):
        """Should revise when quality is just below threshold."""
        state = {
            "quality_score": QUALITY_THRESHOLD - 0.001,
            "revision_count": 0,
        }
        assert route_after_adversarial(state) == "revise"

    def test_routes_to_advance_at_max_minus_one(self):
        """Still revises at MAX_REVISIONS - 1 if quality is low."""
        state = {
            "quality_score": 0.50,
            "revision_count": MAX_REVISIONS - 1,
        }
        assert route_after_adversarial(state) == "revise"


# ── Graph construction ────────────────────────────────────────────────────────

class TestGraphConstruction:
    def test_graph_builds_without_error(self):
        """Graph should compile without raising exceptions."""
        from backend.graph import build_graph
        builder = build_graph()
        assert builder is not None

    def test_graph_has_all_nodes(self):
        """All 8 nodes (6 agents + 2 HITL) should be registered."""
        from backend.graph import build_graph
        builder = build_graph()
        expected_nodes = {
            "research_node",
            "discovery_node",
            "hitl_1_node",
            "drafting_node",
            "framework_node",
            "adversarial_node",
            "hitl_2_node",
            "output_node",
        }
        # Access the builder's node registry
        registered = set(builder.nodes.keys())
        for node in expected_nodes:
            assert node in registered, f"Node '{node}' not found in graph"


# ── HITL node logic ───────────────────────────────────────────────────────────

class TestHITLNodes:
    def test_hitl_1_merges_transcript(self):
        """HITL #1 node should merge transcript and directives into state."""
        from backend.graph import hitl_1_node

        state = {
            "current_phase": Phase.HITL_1,
            "probing_questions": ["Q1?", "Q2?"],
            "human_directives": [],
        }

        interrupt_result = {
            "meeting_transcript": "Client said cost transparency is urgent.",
            "human_directives": ["Focus on board optics."],
        }

        with patch("langgraph.types.interrupt", return_value=interrupt_result):
            result = hitl_1_node(state)

        assert result["meeting_transcript"] == "Client said cost transparency is urgent."
        assert "Focus on board optics." in result["human_directives"]
        assert result["current_phase"] == Phase.DRAFTING

    def test_hitl_2_merges_proposal_overrides(self):
        """HITL #2 node should merge consultant's section edits into state."""
        from backend.graph import hitl_2_node

        state = {
            "current_phase": Phase.HITL_2,
            "proposal_components": {
                "intro": "Original intro.",
                "understanding": "Original understanding.",
                "methodology": "Original methodology.",
                "approach": "Original approach.",
                "fees": "Original fees.",
            },
            "critique_history": [],
            "quality_score": 0.75,
            "revision_count": 2,
            "human_directives": [],
        }

        interrupt_result = {
            "proposal_components": {
                "fees": "CHF 4,500/day × 15 days Marc Brandis = CHF 67,500 max.",
            },
            "human_directives": ["Start date: March 31."],
        }

        with patch("langgraph.types.interrupt", return_value=interrupt_result):
            result = hitl_2_node(state)

        assert result["proposal_components"]["fees"] == "CHF 4,500/day × 15 days Marc Brandis = CHF 67,500 max."
        assert result["proposal_components"]["intro"] == "Original intro."  # unchanged
        assert "Start date: March 31." in result["human_directives"]
        assert result["current_phase"] == Phase.OUTPUT


# ── PDF/Markdown generation ───────────────────────────────────────────────────

class TestOutputTools:
    def test_generate_markdown(self, tmp_path):
        """Markdown generator produces a valid file."""
        import os
        from backend.tools import pdf_generator

        # Temporarily override output dir
        original_dir = pdf_generator.OUTPUTS_DIR
        pdf_generator.OUTPUTS_DIR = tmp_path

        components = {
            "intro": "Test intro.",
            "understanding": "Test understanding.",
            "methodology": "Test methodology.",
            "approach": "Test approach.",
            "fees": "CHF 1,000/day.",
        }
        profile = {
            "company_name": "TestCorp",
            "engagement_title": "Test Engagement",
        }

        md_path = pdf_generator.generate_markdown(components, profile, "test-session-123")

        assert md_path.exists()
        content = md_path.read_text()
        assert "Test Engagement" in content
        assert "TestCorp" in content
        assert "Test intro." in content
        assert "Test understanding." in content

        pdf_generator.OUTPUTS_DIR = original_dir


# ── Constants ─────────────────────────────────────────────────────────────────

class TestConstants:
    def test_quality_threshold_is_sensible(self):
        """Quality threshold should be between 0.7 and 0.95."""
        assert 0.70 <= QUALITY_THRESHOLD <= 0.95

    def test_max_revisions_is_sensible(self):
        """Max revisions should be between 1 and 5."""
        assert 1 <= MAX_REVISIONS <= 5
