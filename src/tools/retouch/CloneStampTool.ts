import { BaseTool, EditorPointerEvent, ToolContext } from '../../core/tools/Tool';

export class CloneStampTool extends BaseTool {
  readonly id = 'clone-stamp';
  readonly name = 'Clone Stamp Tool';
  readonly cursor = 'crosshair';

  private isDrawing = false;
  private size = 20;
  private hardness = 100;
  private opacity = 100;
  private sourceX: number | null = null;
  private sourceY: number | null = null;
  private offsetX = 0;
  private offsetY = 0;

  setSize(size: number): void {
    this.size = Math.max(1, size);
  }

  setHardness(hardness: number): void {
    this.hardness = Math.max(0, Math.min(100, hardness));
  }

  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(100, opacity));
  }

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster') {
      return;
    }

    // Alt+Click для установки источника
    if (event.altKey) {
      this.sourceX = Math.floor(event.x);
      this.sourceY = Math.floor(event.y);
      return;
    }

    if (this.sourceX === null || this.sourceY === null) {
      return;
    }

    this.isDrawing = true;
    this.offsetX = Math.floor(event.x) - this.sourceX;
    this.offsetY = Math.floor(event.y) - this.sourceY;
    this.clone(event.x, event.y, context);
  }

  onPointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDrawing) {
      return;
    }

    this.clone(event.x, event.y, context);
  }

  onPointerUp(event: EditorPointerEvent, context: ToolContext): void {
    this.isDrawing = false;
  }

  private clone(x: number, y: number, context: ToolContext): void {
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster' || this.sourceX === null || this.sourceY === null) {
      return;
    }

    const imageData = activeLayer.imageData;
    const radius = Math.floor(this.size / 2);
    const centerX = Math.floor(x);
    const centerY = Math.floor(y);
    const sourceCenterX = centerX - this.offsetX;
    const sourceCenterY = centerY - this.offsetY;

    // Создаём новую ImageData
    const newData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Копируем пиксели из источника
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= radius) {
          const destX = centerX + dx;
          const destY = centerY + dy;
          const srcX = sourceCenterX + dx;
          const srcY = sourceCenterY + dy;
          
          if (destX >= 0 && destX < imageData.width && 
              destY >= 0 && destY < imageData.height &&
              srcX >= 0 && srcX < imageData.width && 
              srcY >= 0 && srcY < imageData.height) {
            
            const destIdx = (destY * imageData.width + destX) * 4;
            const srcIdx = (srcY * imageData.width + srcX) * 4;
            
            // Применяем hardness (мягкие края)
            const edgeFactor = dist / radius;
            const hardnessFactor = this.hardness / 100;
            const blend = edgeFactor > hardnessFactor 
              ? 1 - (edgeFactor - hardnessFactor) / (1 - hardnessFactor)
              : 1;
            
            const opacityFactor = (this.opacity / 100) * blend;
            
            // Смешиваем с учётом прозрачности
            newData.data[destIdx] = Math.round(
              imageData.data[srcIdx] * opacityFactor + 
              imageData.data[destIdx] * (1 - opacityFactor)
            );
            newData.data[destIdx + 1] = Math.round(
              imageData.data[srcIdx + 1] * opacityFactor + 
              imageData.data[destIdx + 1] * (1 - opacityFactor)
            );
            newData.data[destIdx + 2] = Math.round(
              imageData.data[srcIdx + 2] * opacityFactor + 
              imageData.data[destIdx + 2] * (1 - opacityFactor)
            );
            newData.data[destIdx + 3] = Math.round(
              imageData.data[srcIdx + 3] * opacityFactor + 
              imageData.data[destIdx + 3] * (1 - opacityFactor)
            );
          }
        }
      }
    }

    // Обновляем слой
    const document = context.getDocument();
    const updatedLayer = { ...activeLayer, imageData: newData };
    const updatedDocument = document.updateLayer(activeLayer.id, updatedLayer);
    context.setDocument(updatedDocument);
    context.requestRender();
  }

  deactivate(context: ToolContext): void {
    this.isDrawing = false;
  }
}
