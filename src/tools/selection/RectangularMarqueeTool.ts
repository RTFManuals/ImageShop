import { BaseTool, EditorPointerEvent, EditorKeyboardEvent, ToolContext } from '../../core/tools/Tool';
import { Selection } from '../../core/selection/Selection';

export class RectangularMarqueeTool extends BaseTool {
  readonly id = 'rectangular-marquee';
  readonly name = 'Rectangular Marquee Tool';
  readonly cursor = 'crosshair';
  
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    this.isDragging = true;
    this.startX = event.x;
    this.startY = event.y;
    this.currentX = event.x;
    this.currentY = event.y;
  }

  onPointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDragging) return;

    this.currentX = event.x;
    this.currentY = event.y;

    // Update preview selection
    const document = context.getDocument();
    const x = Math.min(this.startX, this.currentX);
    const y = Math.min(this.startY, this.currentY);
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);

    const previewSelection = new Selection(document.width, document.height);
    previewSelection.selectRect({ x, y, width, height });
    
    context.setSelection(previewSelection);
    context.requestRender();
  }

  onPointerUp(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDragging) return;

    this.isDragging = false;

    const document = context.getDocument();
    const x = Math.min(this.startX, this.currentX);
    const y = Math.min(this.startY, this.currentY);
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);

    if (width === 0 || height === 0) {
      context.setSelection(null);
      context.requestRender();
      return;
    }

    const newSelection = new Selection(document.width, document.height);
    newSelection.selectRect({ x, y, width, height });
    
    // Apply selection modifiers
    const existingSelection = context.getSelection();
    let finalSelection: Selection;
    
    if (existingSelection && (event.shiftKey || event.altKey)) {
      if (event.shiftKey && event.altKey) {
        // Intersection
        finalSelection = existingSelection.intersect(newSelection);
      } else if (event.altKey) {
        // Subtract
        finalSelection = existingSelection.subtract(newSelection);
      } else {
        // Add (Union)
        finalSelection = existingSelection.union(newSelection);
      }
    } else {
      finalSelection = newSelection;
    }
    
    context.setSelection(finalSelection);
    context.requestRender();
  }

  onKeyDown(event: EditorKeyboardEvent, context: ToolContext): void {
    if (event.key === 'Escape') {
      context.setSelection(null);
      context.requestRender();
    }
  }
}
