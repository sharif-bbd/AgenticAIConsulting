"""
Unit tests for individual agent nodes using mock state.
Run with: pytest tests/test_agents.py -v
"""

import pytest
from unittest.mock import patch, MagicMock

from backend.state import AgentState, Phase


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def base_state() -> dict:
    """Minimal valid AgentState for testing."""
    return {
        "raw_client_inputs": [
            "We need to improve our IT cost structure. "
            "The CFO mentioned a 15% cost reduction target for the next 18 months. "
            "We are a mid-sized pharmaceutical company with about 8,000 employees."
        ],
        "meeting_transcript": "",
        "client_profile": {},
        "briefing_dossier": "",
        "probing_questions": [],
        "proposal_components": {},
        "selected_frameworks": [],
        "critique_history": [],
        "quality_score": 0.0,
        "revision_count": 0,
        "human_directives": [],
        "current_phase": Phase.INTAKE,
        "messages": [],
    }


@pytest.fixture
def post_research_state(base_state) -> dict:
    """State after Agent 1 has run."""
    return {
        **base_state,
        "client_profile": {
            "company_name": "PharmaClient AG",
            "industry": "Pharmaceutical",
            "company_size": "~8,000 employees",
            "key_personnel": [{"name": "Unknown", "role": "CFO"}],
            "main_competitors": ["Novartis", "Roche"],
            "problem_domain": "IT cost efficiency",
            "engagement_title": "IT Run-the-Business Efficiency Program",
            "urgency_signals": ["15% cost reduction target", "18-month deadline"],
            "city": "Basel",
        },
        "briefing_dossier": (
            "PharmaClient AG is a mid-sized pharmaceutical company facing significant "
            "board pressure to reduce IT operational costs. The 18-month target of 15% "
            "reduction is non-negotiable and driven by broader margin compression in the sector."
        ),
        "current_phase": Phase.QUESTION_GEN,
    }


@pytest.fixture
def post_questions_state(post_research_state) -> dict:
    """State after Agent 2 has run."""
    return {
        **post_research_state,
        "probing_questions": [
            "[Problem Depth] What specific IT cost categories have grown fastest in the last 2 years?",
            "[Urgency] What happens to your IT budget if the 15% target is not met by month 18?",
            "[Organizational Dynamics] Who owns the mandate for this initiative — IT or Finance?",
            "[Success Definition] What does success look like 12 months from now for you personally?",
        ],
        "current_phase": Phase.HITL_1,
    }


@pytest.fixture
def post_transcript_state(post_questions_state) -> dict:
    """State after HITL #1 (transcript submitted)."""
    return {
        **post_questions_state,
        "meeting_transcript": (
            "The CFO opened by saying: 'Our run-the-bank costs have been growing at 12% annually "
            "for the past 3 years. The board wants us to reverse this trend. We have roughly "
            "6 months before the next board review where we need to show concrete progress. "
            "The CIO is supportive but has limited bandwidth. I need a concept that I can "
            "present to the board in Q2.' Key priorities: cost transparency first, then improvement measures. "
            "Political constraint: the IT team is protective of their processes — any changes need "
            "to feel collaborative, not imposed from Finance."
        ),
        "current_phase": Phase.DRAFTING,
    }


# ── Agent 2: Discovery ────────────────────────────────────────────────────────

class TestDiscoveryAgent:
    def test_generates_questions(self, post_research_state):
        """Discovery agent produces a list of questions."""
        mock_response = MagicMock()
        mock_response.content = """
- [Problem Depth] What specific IT cost categories have grown fastest in the last 2 years?
- [Urgency] What does the board expect to see in the Q2 review?
- [Organizational Dynamics] Who owns this initiative — IT or Finance?
- [Success Definition] What does a successful outcome look like for you personally in 12 months?
- [Scope] What is explicitly off-limits or politically sensitive in this engagement?
"""
        with patch("backend.agents.discovery_agent.ChatAnthropic") as MockChat:
            instance = MockChat.return_value
            instance.invoke.return_value = mock_response

            from backend.agents.discovery_agent import discovery_node
            result = discovery_node(post_research_state)

        assert "probing_questions" in result
        assert len(result["probing_questions"]) >= 3
        assert result["current_phase"] == Phase.HITL_1
        # All questions should contain "?"
        for q in result["probing_questions"]:
            assert "?" in q, f"Not a question: {q}"

    def test_handles_no_questions_gracefully(self, post_research_state):
        """Discovery agent falls back if response has no question marks."""
        mock_response = MagicMock()
        mock_response.content = "Here are some thoughts about the client situation."
        with patch("backend.agents.discovery_agent.ChatAnthropic") as MockChat:
            instance = MockChat.return_value
            instance.invoke.return_value = mock_response

            from backend.agents.discovery_agent import discovery_node
            result = discovery_node(post_research_state)

        assert "probing_questions" in result
        assert isinstance(result["probing_questions"], list)


# ── Agent 3: Drafting ─────────────────────────────────────────────────────────

class TestDraftingAgent:
    def test_produces_intro_and_understanding(self, post_transcript_state):
        """Drafting agent produces both intro and understanding sections."""
        mock_response = MagicMock()
        mock_response.content = """
INTRODUCTION

Over the past several weeks, we have been in dialogue with your team regarding the significant
cost pressures facing PharmaClient AG's IT organization. Following our initial discussion
with your CFO, this document outlines our understanding of the situation and proposes
a structured approach to support you.

OUR UNDERSTANDING OF THE SITUATION

PharmaClient AG's IT run-the-bank costs have grown at 12% annually for three consecutive years,
creating a gap that the board can no longer absorb. You face a non-negotiable target: 15%
cost reduction within 18 months. The Q2 board review — just 6 months away — represents
the first critical checkpoint. Without a compelling concept in hand by then, the window
for a structured program narrows dramatically. The central question this engagement must answer:
How can PharmaClient AG achieve a 15% reduction in IT RtB costs while maintaining operational
continuity and securing organizational buy-in across both Finance and IT?
"""
        with patch("backend.agents.drafting_agent.ChatAnthropic") as MockChat:
            instance = MockChat.return_value
            instance.invoke.return_value = mock_response

            from backend.agents.drafting_agent import drafting_node
            result = drafting_node(post_transcript_state)

        assert "proposal_components" in result
        components = result["proposal_components"]
        assert components.get("intro"), "intro section should not be empty"
        assert components.get("understanding"), "understanding section should not be empty"
        assert result["current_phase"] == Phase.DRAFTING

    def test_increments_revision_on_critique(self, post_transcript_state):
        """Drafting agent increments revision_count when critique history exists."""
        state_with_critique = {
            **post_transcript_state,
            "critique_history": [{
                "round": 0,
                "scores": {"urgency": 12, "empathy": 14, "clarity": 16, "differentiation": 10, "total": 52},
                "per_section_feedback": {"understanding": "Lacks urgency."},
            }],
            "revision_count": 0,
        }
        mock_response = MagicMock()
        mock_response.content = "INTRODUCTION\nRevised intro.\n\nOUR UNDERSTANDING OF THE SITUATION\nRevised understanding."

        with patch("backend.agents.drafting_agent.ChatAnthropic") as MockChat:
            instance = MockChat.return_value
            instance.invoke.return_value = mock_response

            from backend.agents.drafting_agent import drafting_node
            result = drafting_node(state_with_critique)

        assert result.get("revision_count", 0) > 0


# ── Agent 5: Adversarial ──────────────────────────────────────────────────────

class TestAdversarialAgent:
    def test_produces_scores_and_critique(self, post_transcript_state):
        """Adversarial agent returns quality score and critique entry."""
        state_with_draft = {
            **post_transcript_state,
            "proposal_components": {
                "intro": "Introduction paragraph.",
                "understanding": "Understanding paragraph with urgency.",
                "methodology": "Methodology section with deliverables.",
                "approach": "Approach and timeline section.",
                "fees": "CHF X per day, total maximum CHF Y.",
            },
        }
        mock_response = MagicMock()
        mock_response.content = """{
            "scores": {
                "urgency": 18,
                "empathy": 20,
                "clarity": 16,
                "differentiation": 14,
                "total": 68
            },
            "per_section_feedback": {
                "understanding": "Good use of client language but lacks quantified cost of inaction.",
                "methodology": "Deliverables are reasonably specific.",
                "approach": "Timeline is clear.",
                "fees": "Fee structure acceptable."
            },
            "top_3_issues": [
                "Does not state what happens if the Q2 board review is missed.",
                "Methodology still feels somewhat generic for pharma IT.",
                "Team composition not specific enough."
            ],
            "what_would_make_me_sign": "Add a quantified cost of inaction and name specific IT cost categories.",
            "overall_verdict": "Promising but not yet compelling enough to sign without negotiation."
        }"""
        with patch("backend.agents.adversarial_agent.ChatAnthropic") as MockChat:
            instance = MockChat.return_value
            instance.invoke.return_value = mock_response

            from backend.agents.adversarial_agent import adversarial_node
            result = adversarial_node(state_with_draft)

        assert "quality_score" in result
        assert 0.0 <= result["quality_score"] <= 1.0
        assert "critique_history" in result
        assert len(result["critique_history"]) == 1
        critique = result["critique_history"][0]
        assert "scores" in critique
        assert "top_3_issues" in critique

    def test_routes_to_hitl2_when_quality_high(self, post_transcript_state):
        """When quality score >= 0.80, current_phase should be HITL_2."""
        state_with_draft = {
            **post_transcript_state,
            "proposal_components": {
                "intro": "Excellent intro.",
                "understanding": "Perfect understanding.",
                "methodology": "Crystal clear methodology.",
                "approach": "Detailed approach.",
                "fees": "Clear fees.",
            },
            "revision_count": 0,
        }
        mock_response = MagicMock()
        mock_response.content = """{
            "scores": {"urgency": 23, "empathy": 22, "clarity": 21, "differentiation": 20, "total": 86},
            "per_section_feedback": {"understanding": "Excellent.", "methodology": "Clear.", "approach": "Good.", "fees": "Fine."},
            "top_3_issues": ["Minor: could add more specificity on team roles."],
            "what_would_make_me_sign": "Already ready to sign.",
            "overall_verdict": "High quality proposal."
        }"""
        with patch("backend.agents.adversarial_agent.ChatAnthropic") as MockChat:
            instance = MockChat.return_value
            instance.invoke.return_value = mock_response

            from backend.agents.adversarial_agent import adversarial_node
            result = adversarial_node(state_with_draft)

        assert result["quality_score"] >= 0.80
        assert result["current_phase"] == Phase.HITL_2

    def test_routes_back_to_drafting_when_quality_low(self, post_transcript_state):
        """When quality score < 0.80 and revision_count < 3, route back to DRAFTING."""
        state_with_draft = {
            **post_transcript_state,
            "proposal_components": {
                "intro": "Weak intro.",
                "understanding": "Generic understanding.",
                "methodology": "Vague methodology.",
                "approach": "Unclear approach.",
                "fees": "No fees.",
            },
            "revision_count": 1,
        }
        mock_response = MagicMock()
        mock_response.content = """{
            "scores": {"urgency": 10, "empathy": 12, "clarity": 11, "differentiation": 9, "total": 42},
            "per_section_feedback": {"understanding": "Too generic.", "methodology": "Vague.", "approach": "Unclear.", "fees": "Missing."},
            "top_3_issues": ["No urgency.", "Generic methodology.", "No team composition."],
            "what_would_make_me_sign": "Complete rewrite needed.",
            "overall_verdict": "Not ready."
        }"""
        with patch("backend.agents.adversarial_agent.ChatAnthropic") as MockChat:
            instance = MockChat.return_value
            instance.invoke.return_value = mock_response

            from backend.agents.adversarial_agent import adversarial_node
            result = adversarial_node(state_with_draft)

        assert result["quality_score"] < 0.80
        assert result["current_phase"] == Phase.DRAFTING


# ── State schema ──────────────────────────────────────────────────────────────

class TestStateSchema:
    def test_phase_enum_values(self):
        """All expected phase values exist in the enum."""
        from backend.state import Phase
        expected = ["INTAKE", "RESEARCH", "QUESTION_GEN", "HITL_1",
                    "DRAFTING", "CRITIQUING", "HITL_2", "OUTPUT", "COMPLETE"]
        for phase in expected:
            assert Phase(phase) is not None

    def test_proposal_components_keys(self):
        """ProposalComponents TypedDict accepts all expected keys."""
        from backend.state import ProposalComponents
        pc: ProposalComponents = {
            "intro": "test",
            "understanding": "test",
            "methodology": "test",
            "approach": "test",
            "fees": "test",
        }
        assert pc["intro"] == "test"
