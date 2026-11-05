# Agentic Business Proposal Generator



A multi-agent AI system that transforms a fuzzy client brief into a polished, client-winning consulting proposal — a process that normally takes senior consultants 3 full days.

---

## Architecture

```
Fuzzy Brief → [Agent 1: Research] → [Agent 2: Questions] → [HITL #1: Meet Client] →
[Agent 3: Draft Understanding] → [Agent 4: Methodology] → [Agent 5: Adversarial Review] →
(loop up to 3×) → [HITL #2: Human Approves] → [Agent 6: Final PDF]
```

**6 Agents:**
| Agent | Role | Model |
|---|---|---|
| Research Engine | Web-searches the client (company, industry, competitors) | Sonnet 4.6 |
| Discovery Prep | Generates 10–12 probing questions for the first meeting | Sonnet 4.6 |
| Empathy Drafter | Writes "Our Understanding of the Situation" | Sonnet 4.6 |
| Framework Customizer | Selects/mutates consulting frameworks, defines deliverables + fees | Sonnet 4.6 |
| Adversarial Reviewer | Critiques as a skeptical CFO/CEO (scores urgency/empathy/clarity/differentiation) | Opus 4.6 |
| Output Engine | Polishes and renders final PDF + Markdown | Sonnet 4.6 |

**2 Human-in-the-Loop Checkpoints:**
- **HITL #1:** After questions are generated — consultant reviews questions, conducts client meeting, submits transcript
- **HITL #2:** After adversarial loop — consultant reviews stress-tested draft, edits if needed, approves

---

## Setup — Step-by-Step (Ubuntu 24)

This section walks you through the full setup from a fresh Ubuntu machine. You will need two terminal windows open at the end — one for the backend, one for the frontend.

---

### Step 1 — Get the code

Open a terminal and clone the repository:

```bash
git clone https://github.com/sharif-bbd/AgenticAIConsulting.git
cd AgenticAIConsulting
```

---

### Step 2 — Set up a Python environment

The project requires Python 3.11 or 3.12. Create and activate a virtual environment so packages don't pollute your system Python:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Your terminal prompt should now show `(.venv)` at the start. Install all Python dependencies:

```bash
pip install -r requirements.txt
```

This takes 2–3 minutes. WeasyPrint (the PDF renderer) also needs one system library — install it with:

```bash
sudo apt install libpango-1.0-0 libpangoft2-1.0-0
```

---

### Step 3 — Get your two API keys

You need two keys. Both have free tiers that are more than enough for testing.

**Anthropic (Claude) API key** — this powers all 6 agents.
1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account
2. Go to **API Keys** in the left sidebar → click **Create Key**
3. Copy the key (it starts with `sk-ant-...`)

**Tavily API key** — this powers the web search in Agent 1 (company/industry research).
1. Go to [app.tavily.com](https://app.tavily.com) and create an account
2. Your API key is shown on the dashboard home page immediately after signup
3. Copy the key (it starts with `tvly-...`)

---

### Step 4 — Create the `.env` file

Copy the example config and fill in your two keys:

```bash
cp .env.example .env
```

Open `.env` in any text editor and replace the placeholders:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
TAVILY_API_KEY=tvly-your-key-here
```

Save and close the file.

---

### Step 5 — Initialize the knowledge base (run once)

This builds the local vector database of consulting frameworks (Porter's Five Forces, SWOT, Issue Trees, MECE, etc.) that Agent 4 draws on when designing methodologies. You only need to run this once:

```bash
python -m backend.knowledge_base.init_vectorstore
```

You should see it embedding and storing several documents. Takes about 30 seconds.

---

### Step 6 — Run the tests (optional but recommended)

Verify everything is wired up correctly before starting the servers:

```bash
pytest tests/ -v
```

All tests should pass. If something fails here, it's almost always a missing package or a wrong Python version — double-check you have the `.venv` activated.

---

### Step 7 — Install frontend dependencies (run once)

```bash
cd vite_frontend
npm install
cd ..
```

This downloads the Node.js packages for the React frontend. Takes about 1 minute.

---

### Step 8 — Start the system (two terminals)

You need **two terminal windows open at the same time**. In both, make sure you are in the project root folder and have the virtual environment active (`source .venv/bin/activate`).

**Terminal 1 — Backend:**

```bash
uvicorn backend.main:app --reload --port 8000
```

Wait until you see `Application startup complete.` before opening Terminal 2.

**Terminal 2 — Frontend:**

```bash
cd vite_frontend
npm run dev
```

---

### Step 9 — Open the app

Open your browser and go to:

```
http://localhost:5173
```

You should see the proposal generator UI. Start by pasting a client brief into the input field.

If you want to inspect the raw API: `http://localhost:8000/docs`

---

## Running Tests

```bash
pytest tests/ -v
```

---

## Workflow

1. Paste the fuzzy client brief into the Streamlit UI
2. Agent 1 researches the client; Agent 2 generates probing questions
3. **[You]** Review questions → conduct client meeting → paste transcript
4. Agents 3 & 4 draft Understanding + Methodology; Agent 5 critiques as skeptical executive (loops ≤3×)
5. **[You]** Review stress-tested draft + critique summary → approve
6. Agent 6 polishes and generates final PDF

---

## Project Structure

```
backend/
  state.py               — AgentState TypedDict + Phase enum
  graph.py               — LangGraph graph (nodes, edges, HITL interrupts)
  agents/                — 6 agent implementations
  prompts/               — System + user prompt templates per agent
  tools/                 — Tavily search, ChromaDB RAG, WeasyPrint PDF
  knowledge_base/        — Consulting frameworks (markdown) + ChromaDB vectorstore
  api/                   — FastAPI routes + Pydantic schemas
  main.py                — FastAPI app entry point
frontend/
  app.py                 — Streamlit dual-pane UI
tests/
  test_agents.py         — Unit tests per agent (mocked LLM calls)
  test_graph.py          — Graph topology + routing logic tests
outputs/                 — Generated proposals (PDF + Markdown)
```
