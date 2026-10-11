// Command Pattern - Core Interface

export interface Command {
  readonly id: string;
  readonly name: string;
  readonly timestamp: number;

  execute(): void;
  undo(): void;
  redo(): void;
}

export interface CommandContext {
  // Context provides access to document and services
  // Commands use this to perform their operations
}

export abstract class BaseCommand implements Command {
  readonly id: string;
  readonly name: string;
  readonly timestamp: number;

  constructor(name: string) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.timestamp = Date.now();
  }

  abstract execute(): void;
  abstract undo(): void;

  redo(): void {
    this.execute();
  }
}

// Composite command - groups multiple commands into one
export class CompositeCommand extends BaseCommand {
  private commands: Command[];

  constructor(name: string, commands: Command[]) {
    super(name);
    this.commands = commands;
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}
