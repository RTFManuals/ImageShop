// Tool System - Core Interfaces

export interface Point {
  x: number;
  y: number;
}

export interface EditorPointerEvent {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
  pressure: number;
  button: number;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
}

export interface EditorKeyboardEvent {
  key: string;
  code: string;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface ToolContext {
  // Document access
  getDocument(): any;
  
  // Layer access
  getActiveLayer(): any;
  
  // Selection access
  getSelection(): any;
  
  // Viewport access
  getViewport(): any;
  
  // Command execution
  executeCommand(command: any): void;
  
  // Rendering
  requestRender(): void;
}

export interface EditorTool {
  readonly id: string;
  readonly name: string;
  readonly cursor: string;
  
  activate(context: ToolContext): void;
  deactivate(context: ToolContext): void;
  
  onPointerDown?(event: EditorPointerEvent, context: ToolContext): void;
  onPointerMove?(event: EditorPointerEvent, context: ToolContext): void;
  onPointerUp?(event: EditorPointerEvent, context: ToolContext): void;
  
  onKeyDown?(event: EditorKeyboardEvent, context: ToolContext): void;
  onKeyUp?(event: EditorKeyboardEvent, context: ToolContext): void;
}

export abstract class BaseTool implements EditorTool {
  abstract readonly id: string;
  abstract readonly name: string;
  readonly cursor: string = 'default';

  activate(context: ToolContext): void {
    // Override in subclasses
  }

  deactivate(context: ToolContext): void {
    // Override in subclasses
  }
}
