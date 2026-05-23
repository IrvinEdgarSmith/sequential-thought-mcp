import { ReasoningSession, Thought, ContextBlock, ThoughtType } from "./types.js";
import { randomUUID, createHash } from "crypto";

export class StateStore {
  private sessions: Map<string, ReasoningSession> = new Map();
  private domainRulesets: Map<string, string> = new Map();
  private ragChunks: Map<string, string[]> = new Map();
  private customTypes: Map<string, { schema: any; fingerprint: string }> = new Map();

  public registerCustomType(typeName: string, schema: any): string {
    if (this.customTypes.has(typeName)) {
      throw new Error(`Custom thought type '${typeName}' is already registered and locked.`);
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
    this.customTypes.set(typeName, { schema, fingerprint });
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
    }
    return this.sessions.get(sessionId)!;
  }

  public storeDomainRuleset(domainId: string, payload: string): void {
    this.domainRulesets.set(domainId, payload);
  }

  public getDomainRuleset(domainId: string): string | undefined {
    return this.domainRulesets.get(domainId);
  }

  public setDomainRulesetActive(sessionId: string, active: boolean): void {
    const session = this.getSession(sessionId);
    session.domainRulesetActive = active;
  }

  public storeRagChunks(sessionId: string, docId: string, chunks: string[]): void {
    const key = `${sessionId}::${docId}`;
    this.ragChunks.set(key, chunks);
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
    return thought;
  }

  public getThoughtsByType(sessionId: string, thoughtType: string): Thought[] {
    const session = this.getSession(sessionId);
    return session.thoughts.filter(t => t.thoughtType === thoughtType);
  }
}

// Global instance for the server
export const db = new StateStore();
