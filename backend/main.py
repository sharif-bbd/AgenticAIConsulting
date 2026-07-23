"""
FastAPI application entry point.
Run with: uvicorn backend.main:app --reload --port 8000
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env before importing anything that uses env vars
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from backend.api.routes import router  # noqa: E402

app = FastAPI(
    title="Agentic Business Proposal API",
    description=(
        "Multi-agent system that transforms fuzzy client briefs into "
        "polished consulting proposals. Built for ETH Zurich / Marc Brandis Strategic Consulting."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8501", "http://127.0.0.1:8501",  # Streamlit
        "http://localhost:3000", "http://127.0.0.1:3000",  # Reflex
        "http://localhost:5173", "http://127.0.0.1:5173",  # Vite
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/")
async def root():
    return {
        "message": "Agentic Business Proposal API",
        "docs": "/docs",
        "health": "/health",
    }
