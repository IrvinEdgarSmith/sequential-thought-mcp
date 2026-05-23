import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "crash-test",
  version: "1.0.0"
});

server.registerTool("throw_error", {}, async () => {
    throw new Error("This is a test error");
});

console.log("Server created, simulating tool call...");

async function test() {
    try {
        const result = await server._tools["throw_error"].handler({});
        console.log("Result:", result);
    } catch(e) {
        console.error("Caught error:", e.message);
    }
}
test();
