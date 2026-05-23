#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Ajv from "ajv";
import { 
  SearchBlocksInputSchema, 
  SubmitThoughtInputSchema, 
  RegisterCustomThoughtTypeInputSchema,
  StoreDomainConstraintsInputSchema,
  ActivateDomainConstraintsInputSchema,
  StoreDocumentInputSchema,
  QueryDocumentInputSchema,
  ThoughtType 
} from "./types.js";
import { db } from "./state.js";
import { storeDocument, queryDocument } from "./rag.js";

const AjvClass = Ajv as any;
const ajv = new AjvClass();

// Initialize MCP Server
const server = new McpServer({
  name: "sequential-thought-mcp",
  version: "2.0.0" // V2 Migration (Empirical Anchor Compliance)
});

// ==========================================
// Subsystem 0: Guide & Progressive Disclosure
// ==========================================

const GUIDE_CONTENT = `
# Sequential Thought Architecture Guide & Workflow

## The Bigger Picture
This server forces you to use a Directed Acyclic Graph (DAG) for reasoning to prevent hallucinations and "context stuffing". You cannot simply jump to a conclusion (SYNTHESIS). You must build a chain of evidence.

## Core Rules & Execution Lineage
1. **Gather Evidence**: Use \`SEARCH_QUERY\` or \`WEB_RESEARCH_CAPTURE\` to fetch data.
2. **Evaluate Context**: Use \`SEARCH_EVAL\` to filter noise.
3. **Ground Claims**: Extract hard facts using \`GROUNDED_CLAIM\`. This step requires explicit metadata pointing to the source (e.g. \`blockId\` or \`sourceUrl\`).
4. **Enforce Constraints**: If a domain ruleset is active, you MUST prove your claims satisfy the rules using \`CONSTRAINT_EVAL\`.
5. **Synthesize**: Conclude using \`SYNTHESIS\`. Every \`SYNTHESIS\` thought MUST use the \`dependsOn\` array to point to the IDs of the \`GROUNDED_CLAIM\`s or \`CONSTRAINT_EVAL\`s that support it.

## The dependsOn Array
This array establishes the DAG. If Thought B relies on Thought A, Thought B's \`dependsOn\` array must include Thought A's \`id\`.
`;

server.resource(
  "guide",
  "mcp://sequential-thought/guide",
  { description: "The comprehensive architectural guide and workflow rules for using the Sequential Thought DAG." },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: GUIDE_CONTENT
    }]
  })
);

server.registerTool(
  "get_sequential_thought_guide",
  {
    title: "Get Sequential Thought Guide",
    description: "Returns the comprehensive architectural guide, mental models, and workflow rules for using the Sequential Thought DAG. Call this immediately if you are unsure how to chain thoughts, what the core types mean, or how to pass validation gates.",
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async () => {
    return {
      content: [{ 
        type: "text", 
        text: GUIDE_CONTENT 
      }]
    };
  }
);

// ==========================================
// Subsystem 1: Context Staging (Key-Value Store)
// ==========================================

server.registerTool(
  "store_domain_constraints",
  {
    title: "Store Domain Constraints (HAC)",
    description: "Store Domain Constraints (HAC) for the current session. Use this to inject Hard Admissibility Constraints and Localized ICL payloads into the reasoning environment.",
    inputSchema: StoreDomainConstraintsInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ domainId, rulesetPayload }) => {
    db.storeDomainRuleset(domainId, rulesetPayload);
    return {
      content: [{ 
        type: "text", 
        text: `Domain ruleset '${domainId}' stored successfully.` 
      }]
    };
  }
);

server.registerTool(
  "activate_domain_constraints",
  {
    title: "Activate Domain Constraints",
    description: "Activate Domain Constraints for the reasoning session. Use this to retrieve a stored ruleset. Calling this automatically activates mandatory constraint quality gates (CONSTRAINT_EVAL) before synthesis is permitted.",
    inputSchema: ActivateDomainConstraintsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ sessionId, domainId }) => {
    const text = db.getDomainRuleset(domainId);
    if (!text) {
      throw new Error(`Domain Ruleset '${domainId}' not found in server memory.`);
    }
    
    // Mark the session as having an active domain ruleset, activating strict synthesis gates
    db.setDomainRulesetActive(sessionId, true);
    
    return {
      content: [{ 
        type: "text", 
        text: `[DOMAIN RULESET LOADED: ${domainId}]\n\n${text}\n\nWARNING: You have fetched a domain ruleset. You must now submit a CONSTRAINT_EVAL thought proving your plan obeys these constraints before you are allowed to SYNTHESIZE.` 
      }]
    };
  }
);


// ==========================================
// Subsystem 2: Sequential Thought Auditor
// ==========================================

server.registerTool(
  "search_blocks",
  {
    title: "Search RAG Context Blocks",
    description: "Simulates searching for RAG context blocks. Returns blocks with a blockId that must be referenced in GROUNDED_CLAIMs.",
    inputSchema: SearchBlocksInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ sessionId, query }) => {
    const mockContent = `This is a simulated context block matching query: '${query}'. Real facts would be here.`;
    const block = db.addBlock(sessionId, mockContent);
    
    return {
      content: [{ 
        type: "text", 
        text: `Retrieved block ${block.blockId}. You must submit a SEARCH_EVAL thought before using this block.` 
      }],
      structuredContent: {
        blockId: block.blockId,
        content: block.content,
        isRelevant: null
      }
    };
  }
);

// ==========================================
// Subsystem 3: Virtual Sub-Agent (Information Subtraction)
// ==========================================

server.registerTool(
  "store_large_document",
  {
    title: "Store Large Document for Pruning",
    description: "Store a massive document (e.g., PDF text) in the MCP's memory. Does not return the text to protect KV-cache.",
    inputSchema: StoreDocumentInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ sessionId, docId, content }) => {
    storeDocument(sessionId, docId, content);
    return {
      content: [{ 
        type: "text", 
        text: `Document '${docId}' successfully chunked and stored in memory. Use query_document to extract information.` 
      }]
    };
  }
);

server.registerTool(
  "query_document",
  {
    title: "Query Document (Information Subtraction)",
    description: "Queries a stored document using Information Subtraction. Returns only the most relevant chunks, pruning out the noise.",
    inputSchema: QueryDocumentInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ sessionId, docId, query }) => {
    const result = queryDocument(sessionId, docId, query);
    return {
      content: [{ 
        type: "text", 
        text: result 
      }]
    };
  }
);

server.registerTool(
  "register_custom_thought_type",
  {
    title: "Register Custom Thought Type",
    description: "Registers a dynamic custom thought type with a JSON Schema blueprint. Once registered, it is locked and immutable.",
    inputSchema: RegisterCustomThoughtTypeInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async ({ sessionId, typeName, schemaDefinition, justification }) => {
    if (justification.length < 20) {
      throw new Error("Validation Error: Justification is too short. You must explicitly justify why the core types are insufficient.");
    }
    
    try {
      ajv.compile(schemaDefinition);
    } catch (e: any) {
      throw new Error(`Validation Error: Invalid JSON Schema definition. ${e.message}`);
    }

    try {
      const fingerprint = db.registerCustomType(typeName, schemaDefinition);
      return {
        content: [{ 
          type: "text", 
          text: `Custom thought type '${typeName}' successfully registered and locked with fingerprint [${fingerprint}]. You may now use it in submit_thought.` 
        }]
      };
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
);

server.registerTool(
  "submit_thought",
  {
    title: "Submit Sequential Thought",
    description: "Submit a verifiably grounded reasoning step to the Sequential Thought DAG. Call get_sequential_thought_guide immediately if you are unfamiliar with this workflow or the required execution lineage (dependsOn).",
    inputSchema: SubmitThoughtInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async ({ sessionId, thoughtType, content, dependsOn, metadata, extraMetadata }) => {
    const session = db.getSession(sessionId);

    // 0. Dynamic Custom Type Validation
    if (!(Object.values(ThoughtType) as string[]).includes(thoughtType)) {
      const customType = db.getCustomType(thoughtType);
      if (!customType) {
        throw new Error(`Validation Error: Thought type '${thoughtType}' is not a core type and has not been registered. Valid core types are: SEARCH_QUERY, SEARCH_EVAL, GROUNDED_CLAIM, CONSTRAINT_EVAL, WEB_RESEARCH_CAPTURE, SYNTHESIS. If you need a custom type, use the register_custom_thought_type tool first. If you are confused by this validation error, call the get_sequential_thought_guide tool for a complete explanation of the required workflow.`);
      }
      if (!extraMetadata) {
        throw new Error(`Validation Error: Custom thought type '${thoughtType}' requires an extraMetadata payload matching its registered schema.`);
      }
      
      const validate = ajv.compile(customType.schema);
      const valid = validate(extraMetadata);
      if (!valid) {
        throw new Error(`Validation Error: extraMetadata does not match the registered JSON Schema for '${thoughtType}'. Errors: ${ajv.errorsText(validate.errors)}`);
      }
    }

    // 1. Validation Gate: GROUNDED_CLAIM
    if (thoughtType === ThoughtType.GROUNDED_CLAIM) {
      // Two valid grounding paths: internal block reference OR external web source
      const hasBlockRef = metadata?.blockId;
      const hasWebSource = metadata?.sourceUrl;
      
      if (!hasBlockRef && !hasWebSource) {
        throw new Error("Validation Error: GROUNDED_CLAIM requires either metadata.blockId (internal) or metadata.sourceUrl (web source). If you are confused by this validation error, call the get_sequential_thought_guide tool for a complete explanation of the required workflow.");
      }
      
      // If grounding against an internal block, verify it exists and quote matches
      if (hasBlockRef) {
        const block = db.getBlock(sessionId, metadata!.blockId!);
        if (!block) {
          throw new Error(`Validation Error: Block '${metadata!.blockId}' not found in session context. If you are confused by this validation error, call the get_sequential_thought_guide tool for a complete explanation of the required workflow.`);
        }
        if (!metadata?.quote) {
          throw new Error("Validation Error: GROUNDED_CLAIM with blockId requires a verbatim metadata.quote string. If you are confused by this validation error, call the get_sequential_thought_guide tool for a complete explanation of the required workflow.");
        }
        if (!block.content.includes(metadata.quote.trim())) {
          throw new Error("Validation Error: Quote not found in referenced block. Ungrounded claim rejected. If you are confused by this validation error, call the get_sequential_thought_guide tool for a complete explanation of the required workflow.");
        }
      }
      // Web-sourced claims just need the URL — the quote is optional but encouraged
    }
    
    // 2. Validation Gate: SYNTHESIS
    if (thoughtType === ThoughtType.SYNTHESIS) {
      const groundedClaims = db.getThoughtsByType(sessionId, ThoughtType.GROUNDED_CLAIM);
      const webResearchCaptures = db.getThoughtsByType(sessionId, ThoughtType.WEB_RESEARCH_CAPTURE);
      
      if (groundedClaims.length === 0 && webResearchCaptures.length === 0) {
        throw new Error(
          "Validation Error: SYNTHESIS blocked. You must retrieve and ground at least one claim " +
          "(using GROUNDED_CLAIM or WEB_RESEARCH_CAPTURE) before synthesizing an answer. If you are confused by this validation error, call the get_sequential_thought_guide tool for a complete explanation of the required workflow."
        );
      }

      // If a Domain Ruleset is active, enforce the CONSTRAINT_EVAL quality gate
      if (session.domainRulesetActive) {
        const constraintEvals = db.getThoughtsByType(sessionId, ThoughtType.CONSTRAINT_EVAL);
        if (constraintEvals.length === 0) {
          throw new Error(
            "Validation Error: SYNTHESIS blocked. You have loaded a Domain Ruleset, which triggers mandatory " +
            "empirical quality gates. You must submit a CONSTRAINT_EVAL thought proving your claims " +
            "obey the HAC (Hard Admissibility Constraints) before you are allowed to synthesize. If you are confused by this validation error, call the get_sequential_thought_guide tool for a complete explanation of the required workflow."
          );
        }
      }

      // 3. Execution Lineage (DAG) Gate
      if (!dependsOn || dependsOn.length === 0) {
        throw new Error("Validation Error: SYNTHESIS requires a dependsOn array referencing previous thought IDs to establish execution lineage (DAG). If you are confused by this validation error, call the get_sequential_thought_guide tool for a complete explanation of the required workflow.");
      }
      
      const validIds = new Set(session.thoughts.map(t => t.id));
      for (const id of dependsOn) {
        if (!validIds.has(id)) {
          throw new Error(`Validation Error: dependsOn contains invalid or non-existent thought ID: ${id}`);
        }
      }
    }

    // Pass validation: Store thought
    const thought = db.addThought(sessionId, thoughtType, content, dependsOn || [], metadata, extraMetadata);
    
    return {
      content: [{ 
        type: "text", 
        text: `Thought ${thought.id} of type ${thoughtType} successfully accepted and stored.` 
      }],
      structuredContent: {
        thought
      }
    };
  }
);

// Main transport initialization
async function runStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sequential Thought MCP server running via stdio");
}

runStdio().catch(error => {
  console.error("Server error:", error);
  process.exit(1);
});
