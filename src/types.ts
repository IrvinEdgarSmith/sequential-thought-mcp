import { z } from "zod";

// Enum mapping to Self-RAG reflection tokens and our new quality gate
export enum ThoughtType {
  SEARCH_QUERY = "SEARCH_QUERY",       // RETRIEVE
  SEARCH_EVAL = "SEARCH_EVAL",         // ISREL
  GROUNDED_CLAIM = "GROUNDED_CLAIM",   // ISSUP
  CONSTRAINT_EVAL = "CONSTRAINT_EVAL", // V2 Quality Assurance Gate (Replaces EDGE_CASE_EVAL)
  WEB_RESEARCH_CAPTURE = "WEB_RESEARCH_CAPTURE", // Web content copied or interpreted
  SYNTHESIS = "SYNTHESIS"              // ISUSE
}

export interface ContextBlock {
  blockId: string;
  content: string;
  isRelevant?: boolean;
}

export interface Thought {
  id: string;
  sessionId: string;
  thoughtType: string;
  content: string;
  dependsOn: string[];
  metadata?: {
    blockId?: string;
    quote?: string;
    sourceUrl?: string;
  };
  extraMetadata?: Record<string, any>;
  timestamp: number;
}

export interface ReasoningSession {
  sessionId: string;
  thoughts: Thought[];
  blocks: ContextBlock[];
  domainRulesetActive: boolean; // V2 Migration: Replaced personaActive
}

// Zod schemas for input validation
export const SearchBlocksInputSchema = z.object({
  sessionId: z.string().describe("The ID of the current reasoning session"),
  query: z.string().describe("The search query to retrieve context blocks")
}).strict();

export const SubmitThoughtInputSchema = z.object({
  sessionId: z.string().describe("Unique identifier for the current reasoning session"),
  thoughtType: z.string().describe("The strict category of the thought. Core types: SEARCH_QUERY, SEARCH_EVAL, GROUNDED_CLAIM, CONSTRAINT_EVAL, WEB_RESEARCH_CAPTURE, SYNTHESIS. If you need a different type, you MUST register it first using register_custom_thought_type."),
  content: z.string()
    .max(4000, "Content exceeds PTE budget limit of 4000 characters.")
    .refine(val => !/<\/?(system|tool_call|thinking|tool_response)>/i.test(val), {
      message: "Content rejected: Contains restricted structural XML tags."
    })
    .describe("The actual content or output of this reasoning step. MUST BE CONCISE and focused on the output, not the deliberation."),
  dependsOn: z.array(z.string()).optional().describe("Array of prior thought IDs this step directly builds upon (DAG edges)"),
  metadata: z.object({
    blockId: z.string().optional().describe("Required for SEARCH_EVAL and GROUNDED_CLAIM (internal blocks)"),
    quote: z.string().optional().describe("Required for GROUNDED_CLAIM to prove grounding"),
    sourceUrl: z.string().optional().describe("Source URL or citation for WEB_RESEARCH_CAPTURE or external GROUNDED_CLAIM")
  }).optional().describe("Additional structured data required for core thought types"),
  extraMetadata: z.record(z.any()).optional().describe("Dynamic structured data payload matching the schema of a registered custom thought type")
}).strict();

export const RegisterCustomThoughtTypeInputSchema = z.object({
  sessionId: z.string().describe("The ID of the current reasoning session"),
  typeName: z.string()
    .regex(/^[A-Z_]+$/, "Type name must be UPPERCASE_WITH_UNDERSCORES")
    .describe("The name of the new thought type (e.g., RED_TEAM_CRITIQUE)"),
  schemaDefinition: z.record(z.any()).describe("A valid JSON Schema object defining the required and optional fields for this thought type's extraMetadata payload"),
  justification: z.string().describe("Metacognitive criteria: You must explicitly justify why the core thought types are insufficient, and what distinct grounding constraints this new type enforces.")
}).strict();

export const StoreDomainConstraintsInputSchema = z.object({
  domainId: z.string().describe("Unique identifier for this domain ruleset"),
  rulesetPayload: z.string().describe("The payload containing Hard Admissibility Constraints (HAC) and Localized Examples (L-ICL)")
}).strict();

export const ActivateDomainConstraintsInputSchema = z.object({
  sessionId: z.string().describe("The ID of the current reasoning session fetching the ruleset"),
  domainId: z.string().describe("The domain ruleset ID to retrieve")
}).strict();

export const StoreDocumentInputSchema = z.object({
  sessionId: z.string().describe("The ID of the current reasoning session"),
  docId: z.string().describe("Unique identifier for this document"),
  content: z.string().describe("The massive text content of the document to store")
}).strict();

export const QueryDocumentInputSchema = z.object({
  sessionId: z.string().describe("The ID of the current reasoning session"),
  docId: z.string().describe("The document ID to query against"),
  query: z.string().describe("The semantic or keyword query to extract relevant chunks")
}).strict();

export type SearchBlocksInput = z.infer<typeof SearchBlocksInputSchema>;
export type SubmitThoughtInput = z.infer<typeof SubmitThoughtInputSchema>;
export type RegisterCustomThoughtTypeInput = z.infer<typeof RegisterCustomThoughtTypeInputSchema>;
export type StoreDomainConstraintsInput = z.infer<typeof StoreDomainConstraintsInputSchema>;
export type ActivateDomainConstraintsInput = z.infer<typeof ActivateDomainConstraintsInputSchema>;
export type StoreDocumentInput = z.infer<typeof StoreDocumentInputSchema>;
export type QueryDocumentInput = z.infer<typeof QueryDocumentInputSchema>;
