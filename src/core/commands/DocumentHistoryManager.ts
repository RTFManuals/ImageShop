import { Document } from '../document/Document';
import { DocumentCommand } from './DocumentCommand';

/**
 * Unified HistoryManager for document commands
 * 
 * This manager:
 * - Executes commands against the current document
 * - Returns the resulting document
 * - Restores correct states during undo/redo
 * - Invalidates redo after new commands
 * - Handles command failure without corrupting history
 */
export class DocumentHistoryManager {
  private undoStack: Array<{ command: DocumentCommand; documentBefore: Document; documentAfter: Document }> = [];
  private redoStack: Array<{ command: DocumentCommand; documentBefore: Document; documentAfter: Document }> = [];
  private maxSize: number;

  constructor(maxSize: number = 60) {
    this.maxSize = maxSize;
  }

  /**
   * Execute a command on the current document.
   * Returns the new document after command execution.
   * 
   * @param command - The command to execute
   * @param currentDocument - The current document state
   * @returns The new document after command execution
   * @throws Error if command execution fails
   */
  execute(command: DocumentCommand, currentDocument: Document): Document {
    try {
      // Execute the command
      const newDocument = command.execute(currentDocument);

      // Store in undo stack
      this.undoStack.push({
        command,
        documentBefore: currentDocument,
        documentAfter: newDocument,
      });

      // Clear redo stack (new action invalidates redo)
      this.redoStack = [];

      // Limit history size
      if (this.undoStack.length > this.maxSize) {
        this.undoStack.shift();
      }

      return newDocument;
    } catch (error) {
      // Command failed - don't modify history
      console.error('Command execution failed:', error);
      throw error;
    }
  }

  /**
   * Undo the last command.
   * Returns the document state before the last command.
   * 
   * @param currentDocument - The current document state (should be the result of last execute)
   * @returns The document state before the last command, or null if nothing to undo
   */
  undo(currentDocument: Document): Document | null {
    const entry = this.undoStack.pop();
    if (!entry) {
      return null;
    }

    // Verify current document matches expected state
    // This is a safety check - in production, we trust the state
    // but this helps catch bugs during development
    if (entry.documentAfter !== currentDocument) {
      console.warn('Document state mismatch during undo - using stored state');
    }

    // Store in redo stack
    this.redoStack.push(entry);

    // Return the document before the command
    return entry.documentBefore;
  }

  /**
   * Redo the last undone command.
   * Returns the document state after the command.
   * 
   * @param currentDocument - The current document state
   * @returns The document state after the command, or null if nothing to redo
   */
  redo(currentDocument: Document): Document | null {
    const entry = this.redoStack.pop();
    if (!entry) {
      return null;
    }

    // Verify current document matches expected state
    if (entry.documentBefore !== currentDocument) {
      console.warn('Document state mismatch during redo - using stored state');
    }

    // Store back in undo stack
    this.undoStack.push(entry);

    // Return the document after the command
    return entry.documentAfter;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the number of commands in undo stack
   */
  getUndoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Get the number of commands in redo stack
   */
  getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get command descriptions for UI display
   */
  getUndoHistory(): string[] {
    return this.undoStack.map(entry => entry.command.description);
  }

  /**
   * Get redo history for UI display
   */
  getRedoHistory(): string[] {
    return this.redoStack.map(entry => entry.command.description);
  }
}
