import { EditorTool, ToolContext, EditorPointerEvent, EditorKeyboardEvent } from './Tool';
import { ToolRegistry } from './ToolRegistry';

export class ToolManager {
  private registry: ToolRegistry;
  private activeTool: EditorTool | null = null;
  private context: ToolContext;

  constructor(registry: ToolRegistry, context: ToolContext) {
    this.registry = registry;
    this.context = context;
  }

  setActiveTool(toolId: string): boolean {
    const tool = this.registry.get(toolId);
    if (!tool) {
      console.warn(`Tool "${toolId}" not found`);
      return false;
    }

    // Deactivate current tool
    if (this.activeTool) {
      this.activeTool.deactivate(this.context);
    }

    // Activate new tool
    this.activeTool = tool;
    this.activeTool.activate(this.context);

    return true;
  }

  getActiveTool(): EditorTool | null {
    return this.activeTool;
  }

  handlePointerDown(event: EditorPointerEvent): void {
    if (this.activeTool?.onPointerDown) {
      this.activeTool.onPointerDown(event, this.context);
    }
  }

  handlePointerMove(event: EditorPointerEvent): void {
    if (this.activeTool?.onPointerMove) {
      this.activeTool.onPointerMove(event, this.context);
    }
  }

  handlePointerUp(event: EditorPointerEvent): void {
    if (this.activeTool?.onPointerUp) {
      this.activeTool.onPointerUp(event, this.context);
    }
  }

  handleKeyDown(event: EditorKeyboardEvent): void {
    if (this.activeTool?.onKeyDown) {
      this.activeTool.onKeyDown(event, this.context);
    }
  }

  handleKeyUp(event: EditorKeyboardEvent): void {
    if (this.activeTool?.onKeyUp) {
      this.activeTool.onKeyUp(event, this.context);
    }
  }

  getCursor(): string {
    return this.activeTool?.cursor || 'default';
  }
}
