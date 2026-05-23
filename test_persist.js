import { StateStore } from "./dist/state.js";

function testWrite() {
  console.log("--- Writer Process ---");
  const db = new StateStore();
  const thought = db.addThought("test-persist", "SEARCH_QUERY", "This is a persisted thought", []);
  console.log("Wrote thought:", thought.id);
}

function testRead() {
  console.log("--- Reader Process ---");
  const db = new StateStore();
  const thoughts = db.getThoughtsByType("test-persist", "SEARCH_QUERY");
  console.log("Found thoughts:", thoughts.length);
  if (thoughts.length > 0) {
    console.log("Thought content:", thoughts[0].content);
  } else {
    throw new Error("Persistence failed, thought not found!");
  }
}

if (process.argv[2] === "write") {
  testWrite();
} else if (process.argv[2] === "read") {
  testRead();
} else {
  console.log("Usage: node test_persist.js write|read");
}
