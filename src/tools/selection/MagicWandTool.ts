import { BaseTool, EditorPointerEvent, EditorKeyboardEvent, ToolContext } from '../../core/tools/Tool';
import { Selection } from '../../core/selection/Selection';

export class MagicWandTool extends BaseTool {
  readonly id = 'magic-wand';
  readonly name = 'Magic Wand Tool';
  readonly cursor = 'crosshair';
  
  private tolerance = 32; // 0-255

  setTolerance(value: number): void {
    this.tolerance = Math.max(0, Math.min(255, value));
  }

  getTolerance(): number {
    return this.tolerance;
  }

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    const document = context.getDocument();
    const activeLayer = context.getActiveLayer();
    
    if (!activeLayer || activeLayer.type !== 'raster') {
      return;
    }

    const x = Math.floor(event.x);
    const y = Math.floor(event.y);

    if (x < 0 || x >= activeLayer.width || y < 0 || y >= activeLayer.height) {
      return;
    }

    // Get target color
    const idx = (y * activeLayer.width + x) * 4;
    const targetR = activeLayer.imageData.data[idx];
    const targetG = activeLayer.imageData.data[idx + 1];
    const targetB = activeLayer.imageData.data[idx + 2];
    const targetA = activeLayer.imageData.data[idx + 3];

    // Flood fill selection
    const newSelection = new Selection(document.width, document.height);
    this.floodFill(newSelection, activeLayer.imageData, x, y, targetR, targetG, targetB, targetA);

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

  private floodFill(
    selection: Selection,
    imageData: ImageData,
    startX: number,
    startY: number,
    targetR: number,
    targetG: number,
    targetB: number,
    targetA: number
  ): void {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const visited = new Uint8Array(width * height);
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = y * width + x;
      if (visited[idx]) continue;
      
      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      const a = data[pixelIdx + 3];

      // Check if color is within tolerance
      const dr = Math.abs(r - targetR);
      const dg = Math.abs(g - targetG);
      const db = Math.abs(b - targetB);
      const da = Math.abs(a - targetA);

      if (dr <= this.tolerance && dg <= this.tolerance && db <= this.tolerance && da <= this.tolerance) {
        visited[idx] = 1;
        selection.select(x, y);

        // Add neighbors
        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
      }
    }
  }
}
