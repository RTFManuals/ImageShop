import { EditorTool, ToolContext, EditorPointerEvent, EditorKeyboardEvent } from './Tool';
import { ToolRegistry } from './ToolRegistry';

export type ToolContextProvider = () => ToolContext;

export class ToolManager {
  private registry: ToolRegistry;
  private activeTool: EditorTool | null = null;
  private contextProvider: ToolContextProvider;
  
  constructor(registry: ToolRegistry, contextProvider: ToolContextProvider) {
    this.registry = registry;
    this.contextProvider = contextProvider;
  }

  // Update context provider (called on every render to ensure fresh state)
  updateContextProvider(provider: ToolContextProvider): void {
    this.contextProvider = provider;
  }

  private getContext(): ToolContext {
    return this.contextProvider();
  }

  setActiveTool(toolId: string): boolean {
    const tool = this.registry.get(toolId);
    if (!tool) {
      console.warn(`Tool "${toolId}" not found`);
      return false;
    }

    const context = this.getContext();

    // Deactivate current tool
    if (this.activeTool) {
      this.activeTool.deactivate(context);
    }

    // Activate new tool
    this.activeTool = tool;
    this.activeTool.activate(context);

    return true;
  }

  getActiveTool(): EditorTool | null {
    return this.activeTool;
  }

  handlePointerDown(event: EditorPointerEvent): void {
    if (this.activeTool?.onPointerDown) {
      this.activeTool.onPointerDown(event, this.getContext());
    }
  }

  handlePointerMove(event: EditorPointerEvent): void {
    if (this.activeTool?.onPointerMove) {
      this.activeTool.onPointerMove(event, this.getContext());
    }
  }

  handlePointerUp(event: EditorPointerEvent): void {
    if (this.activeTool?.onPointerUp) {
      this.activeTool.onPointerUp(event, this.getContext());
    }
  }

  handleKeyDown(event: EditorKeyboardEvent): void {
    if (this.activeTool?.onKeyDown) {
      this.activeTool.onKeyDown(event, this.getContext());
    }
  }

  handleKeyUp(event: EditorKeyboardEvent): void {
    if (this.activeTool?.onKeyUp) {
      this.activeTool.onKeyUp(event, this.getContext());
    }
  }

  getCursor(): string {
    return this.activeTool?.cursor || 'default';
  }
}