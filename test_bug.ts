import { StateStore } from "./src/state.js";
import { ThoughtType } from "./src/types.js";

const db = new StateStore();
const sessionId = "abiotic-factor-update-linux";

db.addThought(sessionId, ThoughtType.SEARCH_QUERY, "content", []);
db.addThought(sessionId, ThoughtType.SEARCH_EVAL, "content", []);
db.addThought(sessionId, "WEB_RESEARCH_CAPTURE", "content", [], { sourceUrl: "https://example.com" });

const groundedClaims = db.getThoughtsByType(sessionId, ThoughtType.GROUNDED_CLAIM);
const webResearchCaptures = db.getThoughtsByType(sessionId, ThoughtType.WEB_RESEARCH_CAPTURE);

console.log("Grounded Claims:", groundedClaims.length);
console.log("Web Research Captures:", webResearchCaptures.length);
