import { Command } from './Command';

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize: number;

  constructor(maxSize: number = 60) {
    this.maxSize = maxSize;
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new command

    // Limit history size
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo(): Command | null {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
    return command || null;
  }

  redo(): Command | null {
    const command = this.redoStack.pop();
    if (command) {
      command.redo();
      this.undoStack.push(command);
    }
    return command || null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  getUndoHistory(): readonly Command[] {
    return this.undoStack;
  }
}
