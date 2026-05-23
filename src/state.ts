import { ReasoningSession, Thought, ContextBlock, ThoughtType } from "./types.js";
import { randomUUID, createHash } from "crypto";
import fs from "fs";
import path from "path";

const STATE_FILE = path.join(process.cwd(), ".sequential_thought_state.json");

export class StateStore {
  private sessions: Map<string, ReasoningSession> = new Map();
  private domainRulesets: Map<string, string> = new Map();
  private ragChunks: Map<string, string[]> = new Map();
  private customTypes: Map<string, { schema: any; fingerprint: string }> = new Map();

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    if (fs.existsSync(STATE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
        if (data.sessions) {
          for (const [k, v] of Object.entries(data.sessions)) {
            this.sessions.set(k, v as ReasoningSession);
          }
        }
        if (data.domainRulesets) {
          for (const [k, v] of Object.entries(data.domainRulesets)) {
            this.domainRulesets.set(k, v as string);
          }
        }
        if (data.ragChunks) {
          for (const [k, v] of Object.entries(data.ragChunks)) {
            this.ragChunks.set(k, v as string[]);
          }
        }
        if (data.customTypes) {
          for (const [k, v] of Object.entries(data.customTypes)) {
            this.customTypes.set(k, v as { schema: any; fingerprint: string });
          }
        }
      } catch (err) {
        console.error("Failed to load sequential thought state:", err);
      }
    }
  }

  private saveState(): void {
    try {
      const data = {
        sessions: Object.fromEntries(this.sessions),
        domainRulesets: Object.fromEntries(this.domainRulesets),
        ragChunks: Object.fromEntries(this.ragChunks),
        customTypes: Object.fromEntries(this.customTypes)
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save sequential thought state:", err);
    }
  }

  public registerCustomType(typeName: string, schema: any): string {
    if (this.customTypes.has(typeName)) {
      throw new Error(`Custom thought type '${typeName}' is already registered and locked.`);
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
    this.customTypes.set(typeName, { schema, fingerprint });
    this.saveState();
    return fingerprint;
  }

  public getCustomType(typeName: string): { schema: any; fingerprint: string } | undefined {
    return this.customTypes.get(typeName);
  }

  public getSession(sessionId: string): ReasoningSession {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        thoughts: [],
        blocks: [],
        domainRulesetActive: false
      });
      this.saveState();
    }
    return this.sessions.get(sessionId)!;
  }

  public storeDomainRuleset(domainId: string, payload: string): void {
    this.domainRulesets.set(domainId, payload);
    this.saveState();
  }

  public getDomainRuleset(domainId: string): string | undefined {
    return this.domainRulesets.get(domainId);
  }

  public setDomainRulesetActive(sessionId: string, active: boolean): void {
    const session = this.getSession(sessionId);
    session.domainRulesetActive = active;
    this.saveState();
  }

  public storeRagChunks(sessionId: string, docId: string, chunks: string[]): void {
    const key = `${sessionId}::${docId}`;
    this.ragChunks.set(key, chunks);
    this.saveState();
  }

  public getRagChunks(sessionId: string, docId: string): string[] | undefined {
    const key = `${sessionId}::${docId}`;
    return this.ragChunks.get(key);
  }

  public getBlock(sessionId: string, blockId: string): ContextBlock | undefined {
    const session = this.getSession(sessionId);
    return session.blocks.find(b => b.blockId === blockId);
  }

  public addBlock(sessionId: string, content: string): ContextBlock {
    const session = this.getSession(sessionId);
    const block: ContextBlock = {
      blockId: `block-${randomUUID().substring(0, 8)}`,
      content
    };
    session.blocks.push(block);
    this.saveState();
    return block;
  }

  public addThought(
    sessionId: string, 
    thoughtType: string, 
    content: string, 
    dependsOn: string[],
    metadata?: { blockId?: string; quote?: string; sourceUrl?: string; },
    extraMetadata?: Record<string, any>
  ): Thought {
    const session = this.getSession(sessionId);
    const thought: Thought = {
      id: `thought-${randomUUID()}`,
      sessionId,
      thoughtType,
      content,
      dependsOn,
      metadata,
      extraMetadata,
      timestamp: Date.now()
    };
    session.thoughts.push(thought);
    this.saveState();
    return thought;
  }

  public getThoughtsByType(sessionId: string, thoughtType: string): Thought[] {
    const session = this.getSession(sessionId);
    return session.thoughts.filter(t => t.thoughtType === thoughtType);
  }
}

// Global instance for the server
export const db = new StateStore();
