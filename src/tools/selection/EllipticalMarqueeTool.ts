import { BaseTool, EditorPointerEvent, EditorKeyboardEvent, ToolContext } from '../../core/tools/Tool';
import { Selection } from '../../core/selection/Selection';

export class EllipticalMarqueeTool extends BaseTool {
  readonly id = 'elliptical-marquee';
  readonly name = 'Elliptical Marquee Tool';
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

    const document = context.getDocument();
    const x = Math.min(this.startX, this.currentX);
    const y = Math.min(this.startY, this.currentY);
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);

    const previewSelection = new Selection(document.width, document.height);
    previewSelection.selectEllipse({ x, y, width, height });
    
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

    const selection = new Selection(document.width, document.height);
    selection.selectEllipse({ x, y, width, height });
    
    context.setSelection(selection);
    context.requestRender();
  }

  onKeyDown(event: EditorKeyboardEvent, context: ToolContext): void {
    if (event.key === 'Escape') {
      context.setSelection(null);
      context.requestRender();
    }
  }
}
