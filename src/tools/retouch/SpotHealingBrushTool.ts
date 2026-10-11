import { BaseTool, EditorPointerEvent, ToolContext } from '../../core/tools/Tool';

export class SpotHealingBrushTool extends BaseTool {
  readonly id = 'spot-healing-brush';
  readonly name = 'Spot Healing Brush Tool';
  readonly cursor = 'crosshair';

  private isDrawing = false;
  private size = 20;
  private lastX = 0;
  private lastY = 0;

  setSize(size: number): void {
    this.size = Math.max(1, size);
  }

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster') {
      return;
    }

    this.isDrawing = true;
    this.lastX = event.x;
    this.lastY = event.y;
    this.heal(event.x, event.y, context);
  }

  onPointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDrawing) {
      return;
    }

    this.heal(event.x, event.y, context);
    this.lastX = event.x;
    this.lastY = event.y;
  }

  onPointerUp(event: EditorPointerEvent, context: ToolContext): void {
    this.isDrawing = false;
  }

  private heal(x: number, y: number, context: ToolContext): void {
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster') {
      return;
    }

    const imageData = activeLayer.imageData;
    const radius = Math.floor(this.size / 2);
    const centerX = Math.floor(x);
    const centerY = Math.floor(y);

    // Собираем статистику окружающих пикселей
    const sampleRadius = radius * 2;
    let totalR = 0, totalG = 0, totalB = 0;
    let count = 0;

    // Сэмплируем пиксели вокруг области
    for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
      for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Только пиксели в кольце вокруг области
        if (dist > radius && dist <= sampleRadius) {
          const px = centerX + dx;
          const py = centerY + dy;
          
          if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
            const idx = (py * imageData.width + px) * 4;
            totalR += imageData.data[idx];
            totalG += imageData.data[idx + 1];
            totalB += imageData.data[idx + 2];
            count++;
          }
        }
      }
    }

    if (count === 0) return;

    const avgR = totalR / count;
    const avgG = totalG / count;
    const avgB = totalB / count;

    // Создаём новую ImageData с заживлённой областью
    const newData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Заполняем область средним цветом с градиентом
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= radius) {
          const px = centerX + dx;
          const py = centerY + dy;
          
          if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
            const idx = (py * imageData.width + px) * 4;
            
            // Плавный переход на краях
            const blend = dist / radius;
            const factor = 1 - blend * 0.5; // 0.5 to 1.0
            
            newData.data[idx] = Math.round(avgR * factor + imageData.data[idx] * (1 - factor));
            newData.data[idx + 1] = Math.round(avgG * factor + imageData.data[idx + 1] * (1 - factor));
            newData.data[idx + 2] = Math.round(avgB * factor + imageData.data[idx + 2] * (1 - factor));
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
