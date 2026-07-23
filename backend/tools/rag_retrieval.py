"""
ChromaDB RAG retrieval tool for the Framework Customizer agent.
Queries the consulting knowledge base for relevant frameworks and examples.
"""

from __future__ import annotations

from backend.knowledge_base.init_vectorstore import get_collection


def retrieve_frameworks(
    problem_description: str,
    n_results: int = 5,
    doc_type: str | None = None,
) -> list[dict]:
    """
    Retrieve the most relevant consulting frameworks for a given problem description.

    Args:
        problem_description: Natural language description of the client's problem.
        n_results: Number of chunks to retrieve.
        doc_type: Filter by "framework" or "proposal_example" (None = both).

    Returns:
        List of {content, metadata, distance} dicts, sorted by relevance.
    """
    collection = get_collection()

    where_filter = None
    if doc_type:
        where_filter = {"type": {"$eq": doc_type}}

    results = collection.query(
        query_texts=[problem_description],
        n_results=min(n_results, collection.count()),
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    if results and results.get("documents"):
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]
        for doc, meta, dist in zip(docs, metas, distances):
            chunks.append({
                "content": doc,
                "metadata": meta,
                "relevance_score": round(1 - dist, 3),  # cosine similarity
            })

    return chunks


def retrieve_proposal_examples(problem_description: str, n_results: int = 3) -> list[dict]:
    """Retrieve relevant proposal examples for structural reference."""
    return retrieve_frameworks(problem_description, n_results=n_results, doc_type="proposal_example")


def format_retrieved_chunks_for_prompt(chunks: list[dict]) -> str:
    """Format retrieved chunks into a clean string for LLM prompts."""
    if not chunks:
        return "No relevant knowledge base entries found."

    lines = ["=== RELEVANT CONSULTING KNOWLEDGE BASE ENTRIES ===\n"]
    for i, chunk in enumerate(chunks, 1):
        meta = chunk["metadata"]
        lines.append(f"--- Entry {i}: {meta.get('name', 'Unknown')} "
                     f"(type: {meta.get('type', 'unknown')}, "
                     f"relevance: {chunk['relevance_score']}) ---")
        lines.append(chunk["content"])
        lines.append("")

    return "\n".join(lines)
