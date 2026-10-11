import { BaseTool, EditorPointerEvent, ToolContext } from '../../core/tools/Tool';
import { PaintStrokeCommand } from '../../core/commands/commands/PaintStrokeCommand';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export class BrushTool extends BaseTool {
  readonly id = 'brush';
  readonly name = 'Brush Tool';
  readonly cursor = 'crosshair';

  private isDrawing = false;
  private strokePoints: StrokePoint[] = [];
  private color = '#000000';
  private size = 10;
  private opacity = 100;
  private hardness = 100;

  setColor(color: string): void {
    this.color = color;
  }

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

    // TODO: Preview rendering
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

    // Create PaintStrokeCommand and execute through unified pipeline
    const command = new PaintStrokeCommand(activeLayer.id, {
      points: this.strokePoints,
      color: this.color,
      size: this.size,
      opacity: this.opacity,
      hardness: this.hardness,
      mode: 'brush',
    });

    context.executeCommand(command);
    
    this.strokePoints = [];
    context.requestRender();
  }

  deactivate(context: ToolContext): void {
    this.isDrawing = false;
    this.strokePoints = [];
  }
}
