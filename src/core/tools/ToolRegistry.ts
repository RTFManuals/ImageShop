import { EditorTool } from './Tool';

export class ToolRegistry {
  private tools: Map<string, EditorTool> = new Map();

  register(tool: EditorTool): void {
    if (this.tools.has(tool.id)) {
      console.warn(`Tool with id "${tool.id}" already registered`);
      return;
    }
    this.tools.set(tool.id, tool);
  }

  unregister(toolId: string): void {
    this.tools.delete(toolId);
  }

  get(toolId: string): EditorTool | undefined {
    return this.tools.get(toolId);
  }

  getAll(): EditorTool[] {
    return Array.from(this.tools.values());
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  clear(): void {
    this.tools.clear();
  }
}
