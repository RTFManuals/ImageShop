import { Renderer, Viewport } from './Renderer';
import { EditorDocument, RasterLayer } from '../document/DocumentTypes';
import { Selection } from '../selection/Selection';

export class Canvas2DRenderer implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width: number = 0;
  private height: number = 0;

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
  }

  render(document: EditorDocument, viewport: Viewport, selection?: Selection): void {
    if (!this.ctx || !this.canvas) {
      return;
    }

    const ctx = this.ctx;

    // Очищаем canvas
    ctx.clearRect(0, 0, this.width, this.height);

    // Рисуем шахматный фон для прозрачности
    this.drawCheckerboard(ctx, viewport);

    // Применяем трансформацию viewport
    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Рисуем слои снизу вверх
    for (const layer of document.layers) {
      if (!layer.visible) {
        continue;
      }

      if (layer.type === 'raster') {
        this.renderRasterLayer(ctx, layer as RasterLayer);
      }
    }

    // Рисуем выделение (marching ants)
    if (selection && !selection.isEmpty()) {
      this.renderSelection(ctx, selection);
    }

    ctx.restore();
  }

  private drawCheckerboard(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    const size = 10;
    const colors = ['#ffffff', '#e0e0e0'];

    for (let y = 0; y < this.height; y += size) {
      for (let x = 0; x < this.width; x += size) {
        const colorIndex = (Math.floor(x / size) + Math.floor(y / size)) % 2;
        ctx.fillStyle = colors[colorIndex];
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  private renderRasterLayer(ctx: CanvasRenderingContext2D, layer: RasterLayer): void {
    // Создаём временный canvas для слоя
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = layer.width;
    tempCanvas.height = layer.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      return;
    }

    // Рисуем imageData на временный canvas
    tempCtx.putImageData(layer.imageData, 0, 0);

    // Применяем трансформацию слоя
    ctx.save();

    if (layer.transform) {
      const t = layer.transform;
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);
      ctx.scale(t.scaleX, t.scaleY);
      // TODO: Поддержка skew
    }

    // Применяем прозрачность
    ctx.globalAlpha = layer.opacity / 100;

    // Применяем режим наложения
    ctx.globalCompositeOperation = this.getCompositeOperation(layer.blendMode);

    // Рисуем слой
    ctx.drawImage(tempCanvas, 0, 0);

    ctx.restore();
  }

  private getCompositeOperation(blendMode: string): GlobalCompositeOperation {
    const operations: Record<string, GlobalCompositeOperation> = {
      'normal': 'source-over',
      'multiply': 'multiply',
      'screen': 'screen',
      'overlay': 'overlay',
      'darken': 'darken',
      'lighten': 'lighten',
      'color-dodge': 'color-dodge',
      'color-burn': 'color-burn',
      'hard-light': 'hard-light',
      'soft-light': 'soft-light',
      'difference': 'difference',
      'exclusion': 'exclusion',
      'hue': 'hue',
      'saturation': 'saturation',
      'color': 'color',
      'luminosity': 'luminosity',
    };

    return operations[blendMode] || 'source-over';
  }

  private renderSelection(ctx: CanvasRenderingContext2D, selection: Selection): void {
    const bounds = selection.bounds;
    if (bounds.width === 0 || bounds.height === 0) {
      return;
    }

    // Marching ants animation
    const time = Date.now() / 100;
    const dashOffset = time % 16;

    // Рисуем внешнюю чёрную линию
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = dashOffset;
    ctx.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.width, bounds.height);

    // Рисуем внутреннюю белую линию со смещением
    ctx.strokeStyle = '#ffffff';
    ctx.lineDashOffset = dashOffset + 8;
    ctx.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.width, bounds.height);
    ctx.restore();
  }

  resize(width: number, height: number): void {
    if (!this.canvas) {
      return;
    }

    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }
}
