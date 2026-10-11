import { BaseTool, EditorPointerEvent, ToolContext } from '../../core/tools/Tool';

export class EyedropperTool extends BaseTool {
  readonly id = 'eyedropper';
  readonly name = 'Eyedropper Tool';
  readonly cursor = 'crosshair';

  private onColorPicked?: (color: string) => void;

  setColorPickedCallback(callback: (color: string) => void): void {
    this.onColorPicked = callback;
  }

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    this.pickColor(event.x, event.y, context);
  }

  onPointerMove(event: EditorPointerEvent, context: ToolContext): void {
    // Показываем превью цвета при движении
    // TODO: Добавить визуальное превью
  }

  private pickColor(x: number, y: number, context: ToolContext): void {
    const document = context.getDocument();
    const viewport = context.getViewport();

    // Преобразуем координаты экрана в координаты документа
    const docCoords = viewport.screenToDocument(x, y);

    // Получаем цвет из активного слоя
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.type !== 'raster') {
      return;
    }

    const layer = document.getLayer(activeLayer.id);
    if (!layer || layer.type !== 'raster') {
      return;
    }

    // Получаем пиксель из imageData
    const px = Math.floor(docCoords.x);
    const py = Math.floor(docCoords.y);

    if (px < 0 || px >= layer.width || py < 0 || py >= layer.height) {
      return;
    }

    const idx = (py * layer.width + px) * 4;
    const r = layer.imageData.data[idx];
    const g = layer.imageData.data[idx + 1];
    const b = layer.imageData.data[idx + 2];
    const a = layer.imageData.data[idx + 3];

    // Конвертируем в HEX
    const hex = this.rgbToHex(r, g, b);

    // Вызываем callback
    if (this.onColorPicked) {
      this.onColorPicked(hex);
    }
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
}
