import { BaseTool, EditorPointerEvent, EditorKeyboardEvent, ToolContext } from '../../core/tools/Tool';
import { Selection } from '../../core/selection/Selection';

export class LassoTool extends BaseTool {
  readonly id = 'lasso';
  readonly name = 'Lasso Tool';
  readonly cursor = 'crosshair';
  
  private isDragging = false;
  private points: Array<{ x: number; y: number }> = [];

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    this.isDragging = true;
    this.points = [{ x: event.x, y: event.y }];
  }

  onPointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDragging) return;

    this.points.push({ x: event.x, y: event.y });

    // Create preview selection from points
    const document = context.getDocument();
    const previewSelection = new Selection(document.width, document.height);
    
    // Simple polygon fill using scanline
    this.fillPolygon(previewSelection, this.points);
    
    context.setSelection(previewSelection);
    context.requestRender();
  }

  onPointerUp(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDragging) return;

    this.isDragging = false;

    if (this.points.length < 3) {
      context.setSelection(null);
      context.requestRender();
      return;
    }

    const document = context.getDocument();
    const selection = new Selection(document.width, document.height);
    this.fillPolygon(selection, this.points);
    
    context.setSelection(selection);
    context.requestRender();
  }

  onKeyDown(event: EditorKeyboardEvent, context: ToolContext): void {
    if (event.key === 'Escape') {
      this.isDragging = false;
      this.points = [];
      context.setSelection(null);
      context.requestRender();
    }
  }

  private fillPolygon(selection: Selection, points: Array<{ x: number; y: number }>): void {
    if (points.length < 3) return;

    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    // Scanline fill
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const intersections: number[] = [];
      
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const x = p1.x + (y - p1.y) / (p2.y - p1.y) * (p2.x - p1.x);
          intersections.push(x);
        }
      }
      
      intersections.sort((a, b) => a - b);
      
      for (let i = 0; i < intersections.length; i += 2) {
        const startX = Math.floor(intersections[i]);
        const endX = Math.ceil(intersections[i + 1]);
        
        for (let x = startX; x <= endX; x++) {
          if (x >= 0 && x < selection.width && y >= 0 && y < selection.height) {
            selection.select(x, y);
          }
        }
      }
    }
  }
}
