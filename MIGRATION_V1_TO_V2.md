# Architecture Migration: V1 to V2

**Date:** 2026-05-22
**Status:** V1 Deprecated | V2 Active
**Reason for Migration:** Eradication of "Productivity Theater" and roleplay hallucination vectors in the MCP server.

## What was moved away from (V1)
The V1 architecture of this server utilized a "Persona Profile" staging system (`store_persona_profile` / `fetch_persona_profile`) and relied on an `EDGE_CASE_EVAL` quality gate. 
- **Why it failed:** Prompting an LLM to "act as a persona" conflates instruction-following with actual computational rigor, inducing overconfidence and hallucination (The Plausibility Trap). It is an optical anti-pattern.

## What it was replaced with (V2)
The V2 architecture implements **Hard Rule Admissibility Checks (HAC)** and **Localized In-Context Learning (L-ICL)** based on empirical findings (Wu et al., 2025; Kumar & Cohen, 2026).
- **Tool Renames:** 
  - `store_persona_profile` → `store_domain_ruleset`
  - `fetch_persona_profile` → `fetch_domain_ruleset`
- **Quality Gate Evolution:** The `EDGE_CASE_EVAL` gate was destroyed. It has been replaced with the `CONSTRAINT_EVAL` gate.
- **The Core Mechanic:** When `fetch_domain_ruleset` is called, the session locks `domainRulesetActive = true`. The MCP then mathematically blocks the `SYNTHESIS` thought type until the LLM successfully submits a `CONSTRAINT_EVAL` thought proving that its planned answer strictly satisfies the injected domain constraints. This transforms expertise from a "costume" into a test suite.

*This file serves as the permanent physical record of this architectural decision to prevent context drift.*
