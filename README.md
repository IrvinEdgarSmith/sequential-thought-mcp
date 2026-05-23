# Sequential Thought MCP Server

This Model Context Protocol (MCP) server implements an advanced cognitive architecture designed to mitigate Large Language Model (LLM) hallucinations, prevent Chain-of-Thought (CoT) self-contamination, and enforce the **Uncertainty of Thoughts (UoT)** algorithm.

It acts as a **Stateful Auditor** and **Virtual Context Manager** for the LLM.

## Core Subsystems

### 1. Virtual Context Staging
Standard LLM roleplay prompts (e.g., "Act as an expert...") trigger the **Plausibility Trap**, causing the model to prioritize character consistency over factual accuracy.

This MCP solves this by offloading the "Persona" out of the active context window.
*   **`store_persona_profile`**: Allows the LLM to stage a highly rigorous "Domain Lens" (including specific Literature Anchors, Methodologies, and Hard Constraints) into the server's key-value store.
*   **`fetch_persona_profile`**: Injects this lens back into the context *only* when the LLM is ready to evaluate evidence, keeping the initial research phase completely unbiased.

### 2. The Stateful Auditor (Phase-Gated Execution)
To prevent the LLM from hallucinating answers based on assumptions, this server implements physical quality gates that block the final `SYNTHESIS` phase until strict grounding requirements are met.

*   **Evidence Locking:** The LLM must lock raw facts into the server using `submit_thought` with either the `GROUNDED_CLAIM` (for local files) or `WEB_RESEARCH_CAPTURE` (for external web content) thought types.
*   **Uncertainty of Thoughts (UoT):** If a Domain Lens is active, the LLM is mathematically blocked from synthesizing until it submits an `EDGE_CASE_EVAL` thought. This enforces the UoT algorithm, requiring the model to map dependencies, simulate edge-case trajectories, and explicitly generate "Uncertainty Queries" to maximize information gain.
*   **The SYNTHESIS Gate:** The server throws an error if the LLM attempts to synthesize without satisfying both the grounding and UoT evaluation requirements.

## Available Tools

*   `mcp_sequential_thought_mcp_store_persona_profile`: Stages a domain-specific expert lens.
*   `mcp_sequential_thought_mcp_fetch_persona_profile`: Retrieves the active domain lens for evaluation.
*   `mcp_sequential_thought_mcp_search_blocks`: Retrieves specific blocks from previously submitted thoughts.
*   `mcp_sequential_thought_mcp_submit_thought`: Submits a structured thought (`SEARCH_QUERY`, `GROUNDED_CLAIM`, `WEB_RESEARCH_CAPTURE`, `EDGE_CASE_EVAL`, `SYNTHESIS`) into the stateful auditor.

## Integration
This server is the architectural backend for the `synthesizing-domain-expertise` Claude skill. See the skill documentation for the exact 4-Phase orchestration pipeline.
