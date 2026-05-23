import { StateStore } from "./dist/state.js";
import { ThoughtType } from "./dist/types.js";

const db = new StateStore();
const sessionId = "abiotic-factor-linux-update-001";

function submit_thought(payload) {
    const { sessionId, thoughtType, content, dependsOn, metadata, extraMetadata } = payload;
    const session = db.getSession(sessionId);

    // 1a. SEARCH_EVAL
    if (thoughtType === ThoughtType.SEARCH_EVAL) {
      if (!metadata?.blockId) throw new Error("Validation Error: SEARCH_EVAL requires metadata.blockId");
      const block = db.getBlock(sessionId, metadata.blockId);
      if (!block) throw new Error(`Validation Error: Block '${metadata.blockId}' not found`);
    }

    // 1b. GROUNDED_CLAIM
    if (thoughtType === ThoughtType.GROUNDED_CLAIM) {
      const hasBlockRef = metadata?.blockId;
      const hasWebSource = metadata?.sourceUrl;
      if (!hasBlockRef && !hasWebSource) throw new Error("Validation Error: GROUNDED_CLAIM requires either metadata.blockId or metadata.sourceUrl.");
    }

    // 2. SYNTHESIS
    if (thoughtType === ThoughtType.SYNTHESIS) {
      const groundedClaims = db.getThoughtsByType(sessionId, ThoughtType.GROUNDED_CLAIM);
      const webResearchCaptures = db.getThoughtsByType(sessionId, ThoughtType.WEB_RESEARCH_CAPTURE);
      
      console.log(`[SYNTHESIS check] Grounded claims: ${groundedClaims.length}, Web captures: ${webResearchCaptures.length}`);
      
      if (groundedClaims.length === 0 && webResearchCaptures.length === 0) {
        throw new Error("Validation Error: SYNTHESIS blocked. You must retrieve and ground at least one claim");
      }
      
      // 3. SYNTHESIS DAG
      if (!dependsOn || dependsOn.length === 0) {
        throw new Error("Validation Error: SYNTHESIS requires a dependsOn array");
      }
    }

    // 4. Global DAG
    if (dependsOn && dependsOn.length > 0) {
      const validIds = new Set(session.thoughts.map(t => t.id));
      for (const id of dependsOn) {
        if (!validIds.has(id)) {
          throw new Error(`Validation Error: dependsOn contains invalid or non-existent thought ID: ${id}`);
        }
      }
    }

    return db.addThought(sessionId, thoughtType, content, dependsOn || [], metadata, extraMetadata);
}

try {
    const t1 = submit_thought({
        content: "...",
        metadata: { sourceUrl: "https://github.com" },
        sessionId: "abiotic-factor-linux-update-001",
        thoughtType: "WEB_RESEARCH_CAPTURE"
    });
    console.log("t1 successful", t1.id);

    const t2 = submit_thought({
        content: "...",
        metadata: { sourceUrl: "https://uplink.com" },
        sessionId: "abiotic-factor-linux-update-001",
        thoughtType: "WEB_RESEARCH_CAPTURE"
    });
    console.log("t2 successful", t2.id);

    // Note: Claude submitted SYNTHESIS without dependsOn first
    const t3 = submit_thought({
        content: "SYNTHESIS: ...",
        sessionId: "abiotic-factor-linux-update-001",
        thoughtType: "SYNTHESIS"
    });
    console.log("t3 successful");
} catch(e) {
    console.error("Error:", e.message);
}
