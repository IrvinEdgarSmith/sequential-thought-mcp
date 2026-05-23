import { StateStore } from "./dist/state.js";
import { ThoughtType } from "./dist/types.js";
import { z } from "zod";

const db = new StateStore();
const sessionId = "test-session";

// Let's manually invoke the submit_thought logic to see if it throws correctly
// We will mock the validation logic we just added to index.ts

function validate(thoughtType, dependsOn, metadata) {
    const session = db.getSession(sessionId);

    if (thoughtType === ThoughtType.SEARCH_EVAL) {
      if (!metadata?.blockId) {
        throw new Error("Validation Error: SEARCH_EVAL requires metadata.blockId");
      }
      const block = db.getBlock(sessionId, metadata.blockId);
      if (!block) {
        throw new Error(`Validation Error: Block '${metadata.blockId}' not found in session context.`);
      }
    }

    if (dependsOn && dependsOn.length > 0) {
      const validIds = new Set(session.thoughts.map(t => t.id));
      for (const id of dependsOn) {
        if (!validIds.has(id)) {
          throw new Error(`Validation Error: dependsOn contains invalid or non-existent thought ID: ${id}`);
        }
      }
    }
    
    return "Valid!";
}

console.log("Test 1: SEARCH_EVAL missing blockId");
try {
    validate(ThoughtType.SEARCH_EVAL, [], {});
    console.log("FAILED to throw");
} catch(e) {
    console.log("Passed:", e.message);
}

console.log("\nTest 2: SEARCH_EVAL non-existent blockId");
try {
    validate(ThoughtType.SEARCH_EVAL, [], { blockId: "fake-block" });
    console.log("FAILED to throw");
} catch(e) {
    console.log("Passed:", e.message);
}

console.log("\nTest 3: Any thought with non-existent dependsOn");
try {
    validate(ThoughtType.GROUNDED_CLAIM, ["fake-thought"], {});
    console.log("FAILED to throw");
} catch(e) {
    console.log("Passed:", e.message);
}
