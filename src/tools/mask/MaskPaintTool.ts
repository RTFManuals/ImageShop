import { BaseTool, EditorPointerEvent, ToolContext } from '../../core/tools/Tool';
import { Mask } from '../../core/layers/LayerMask';

export class MaskPaintTool extends BaseTool {
  readonly id = 'mask-paint';
  readonly name = 'Mask Paint Tool';
  readonly cursor = 'crosshair';

  private isDrawing = false;
  private size = 20;
  private hardness = 100;
  private opacity = 100;
  private mode: 'reveal' | 'conceal' = 'reveal';

  setSize(size: number): void {
    this.size = Math.max(1, size);
  }

  setHardness(hardness: number): void {
    this.hardness = Math.max(0, Math.min(100, hardness));
  }

  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(100, opacity));
  }

  setMode(mode: 'reveal' | 'conceal'): void {
    this.mode = mode;
  }

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster') {
      return;
    }

    // Создаём маску если её нет
    if (!activeLayer.mask) {
      const mask = new Mask(activeLayer.width, activeLayer.height);
      mask.fill(); // По умолчанию всё видно
      const document = context.getDocument();
      const updatedLayer = { ...activeLayer, mask };
      const updatedDocument = document.updateLayer(activeLayer.id, updatedLayer);
      context.setDocument(updatedDocument);
    }

    this.isDrawing = true;
    this.paint(event.x, event.y, context);
  }

  onPointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDrawing) {
      return;
    }

    this.paint(event.x, event.y, context);
  }

  onPointerUp(event: EditorPointerEvent, context: ToolContext): void {
    this.isDrawing = false;
  }

  private paint(x: number, y: number, context: ToolContext): void {
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster' || !activeLayer.mask) {
      return;
    }

    const mask = activeLayer.mask as Mask;
    const value = this.mode === 'reveal' ? 255 : 0;
    
    // Применяем opacity
    const effectiveRadius = this.size / 2;
    mask.paint(Math.floor(x), Math.floor(y), effectiveRadius, value);

    // Обновляем документ
    const document = context.getDocument();
    const updatedLayer = { ...activeLayer, mask };
    const updatedDocument = document.updateLayer(activeLayer.id, updatedLayer);
    context.setDocument(updatedDocument);
    context.requestRender();
  }

  deactivate(context: ToolContext): void {
    this.isDrawing = false;
  }
}
