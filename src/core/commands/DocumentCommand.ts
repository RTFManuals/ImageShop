import { Document } from '../document/Document';

/**
 * New command contract - pure state transitions
 * 
 * Commands are pure functions that take a document and return a new document.
 * They have no internal state and no side effects.
 * 
 * This ensures:
 * - Commands can be safely undone/redone
 * - Document state is always consistent
 * - No stale references or disconnected state
 */
export interface DocumentCommand {
  readonly id: string;
  readonly description: string;

  /**
   * Execute the command on the given document.
   * Returns a new document with the command applied.
   * Must be a pure function - no side effects.
   */
  execute(document: Document): Document;

  /**
   * Undo the command on the given document.
   * Returns a new document with the command reversed.
   * Must be a pure function - no side effects.
   * 
   * The document passed to undo() is the result of execute().
   */
  undo(document: Document): Document;
}

/**
 * Base class for document commands providing common functionality
 */
export abstract class BaseDocumentCommand implements DocumentCommand {
  readonly id: string;
  readonly description: string;

  constructor(description: string) {
    this.id = crypto.randomUUID();
    this.description = description;
  }

  abstract execute(document: Document): Document;
  abstract undo(document: Document): Document;
}
