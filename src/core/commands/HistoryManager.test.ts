import { describe, it, expect, vi } from 'vitest';
import { HistoryManager } from './HistoryManager';
import { BaseCommand } from './Command';

class TestCommand extends BaseCommand {
  private executed = false;

  constructor() {
    super('Test Command');
  }

  execute(): void {
    this.executed = true;
  }

  undo(): void {
    this.executed = false;
  }

  isExecuted(): boolean {
    return this.executed;
  }
}

describe('HistoryManager', () => {
  it('should execute command', () => {
    const history = new HistoryManager();
    const command = new TestCommand();
    
    history.execute(command);
    
    expect(command.isExecuted()).toBe(true);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('should undo command', () => {
    const history = new HistoryManager();
    const command = new TestCommand();
    
    history.execute(command);
    history.undo();
    
    expect(command.isExecuted()).toBe(false);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it('should redo command', () => {
    const history = new HistoryManager();
    const command = new TestCommand();
    
    history.execute(command);
    history.undo();
    history.redo();
    
    expect(command.isExecuted()).toBe(true);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('should clear redo stack on new command', () => {
    const history = new HistoryManager();
    const cmd1 = new TestCommand();
    const cmd2 = new TestCommand();
    
    history.execute(cmd1);
    history.undo();
    expect(history.canRedo()).toBe(true);
    
    history.execute(cmd2);
    expect(history.canRedo()).toBe(false);
  });

  it('should limit history size', () => {
    const history = new HistoryManager(3);
    
    for (let i = 0; i < 5; i++) {
      history.execute(new TestCommand());
    }
    
    expect(history.getUndoCount()).toBe(3);
  });

  it('should return null when nothing to undo', () => {
    const history = new HistoryManager();
    const result = history.undo();
    
    expect(result).toBeNull();
  });

  it('should return null when nothing to redo', () => {
    const history = new HistoryManager();
    const result = history.redo();
    
    expect(result).toBeNull();
  });

  it('should clear history', () => {
    const history = new HistoryManager();
    
    history.execute(new TestCommand());
    history.execute(new TestCommand());
    history.clear();
    
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.getUndoCount()).toBe(0);
  });
});
