import { BaseTool, EditorPointerEvent, ToolContext } from '../../core/tools/Tool';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export class EraserTool extends BaseTool {
  readonly id = 'eraser';
  readonly name = 'Eraser Tool';
  readonly cursor = 'crosshair';

  private isDrawing = false;
  private strokePoints: StrokePoint[] = [];
  private size = 10;
  private opacity = 100;
  private hardness = 100;

  setSize(size: number): void {
    this.size = Math.max(1, size);
  }

  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(100, opacity));
  }

  setHardness(hardness: number): void {
    this.hardness = Math.max(0, Math.min(100, hardness));
  }

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster' || activeLayer.locked) {
      return;
    }

    this.isDrawing = true;
    this.strokePoints = [
      {
        x: event.x,
        y: event.y,
        pressure: event.pressure || 1,
      },
    ];

    context.requestRender();
  }

  onPointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDrawing) {
      return;
    }

    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster') {
      return;
    }

    // Add point with interpolation
    const lastPoint = this.strokePoints[this.strokePoints.length - 1];
    const distance = Math.sqrt(
      Math.pow(event.x - lastPoint.x, 2) + Math.pow(event.y - lastPoint.y, 2)
    );

    if (distance > 2) {
      const steps = Math.ceil(distance / 2);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        this.strokePoints.push({
          x: lastPoint.x + (event.x - lastPoint.x) * t,
          y: lastPoint.y + (event.y - lastPoint.y) * t,
          pressure: event.pressure || 1,
        });
      }
    } else {
      this.strokePoints.push({
        x: event.x,
        y: event.y,
        pressure: event.pressure || 1,
      });
    }

    context.requestRender();
  }

  onPointerUp(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDrawing) {
      return;
    }

    this.isDrawing = false;

    if (this.strokePoints.length === 0) {
      return;
    }

    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster') {
      return;
    }

    // TODO: Create EraseStrokeCommand and execute through unified pipeline
    // For now, directly modify the layer (temporary solution)
    
    this.strokePoints = [];
    context.requestRender();
  }

  deactivate(context: ToolContext): void {
    this.isDrawing = false;
    this.strokePoints = [];
  }
}
