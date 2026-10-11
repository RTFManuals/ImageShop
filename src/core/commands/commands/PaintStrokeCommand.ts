import { BaseCommand } from '../Command';
import { Document } from '../../document/Document';
import { RasterLayer } from '../../document/DocumentTypes';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface StrokeData {
  points: StrokePoint[];
  color: string;
  size: number;
  opacity: number;
  hardness: number;
}

export class PaintStrokeCommand extends BaseCommand {
  private document: Document;
  private layerId: string;
  private strokeData: StrokeData;
  private beforeImageData: ImageData | null = null;
  private afterImageData: ImageData | null = null;
  private resultDocument: Document | null = null;

  constructor(document: Document, layerId: string, strokeData: StrokeData) {
    super('Paint Stroke');
    this.document = document;
    this.layerId = layerId;
    this.strokeData = strokeData;
  }

  execute(): void {
    const layer = this.document.getLayer(this.layerId);
    if (!layer || layer.type !== 'raster') {
      return;
    }

    const rasterLayer = layer as RasterLayer;
    
    // Сохраняем состояние до
    this.beforeImageData = new ImageData(
      new Uint8ClampedArray(rasterLayer.imageData.data),
      rasterLayer.imageData.width,
      rasterLayer.imageData.height
    );

    // Применяем штрих
    const afterImageData = this.applyStroke(rasterLayer.imageData, this.strokeData);
    this.afterImageData = afterImageData;

    // Обновляем слой
    const updatedLayer: RasterLayer = {
      ...rasterLayer,
      imageData: afterImageData,
    };

    this.resultDocument = this.document.updateLayer(this.layerId, updatedLayer);
  }

  undo(): void {
    if (!this.beforeImageData || !this.resultDocument) {
      return;
    }

    const layer = this.resultDocument.getLayer(this.layerId);
    if (!layer || layer.type !== 'raster') {
      return;
    }

    const rasterLayer = layer as RasterLayer;
    const restoredLayer: RasterLayer = {
      ...rasterLayer,
      imageData: this.beforeImageData,
    };

    this.resultDocument = this.resultDocument.updateLayer(this.layerId, restoredLayer);
  }

  private applyStroke(imageData: ImageData, stroke: StrokeData): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const color = this.hexToRgb(stroke.color);
    const radius = stroke.size / 2;

    for (const point of stroke.points) {
      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      const pressure = point.pressure;

      // Рисуем круг с градиентом жёсткости
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = x + dx;
          const py = y + dy;

          if (px < 0 || px >= result.width || py < 0 || py >= result.height) {
            continue;
          }

          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > radius) {
            continue;
          }

          // Градиент жёсткости
          const hardnessFactor = stroke.hardness / 100;
          let alpha = 1 - distance / radius;
          alpha = Math.pow(alpha, 1 + (1 - hardnessFactor) * 3);

          // Применяем давление и прозрачность
          const finalAlpha = alpha * pressure * (stroke.opacity / 100);

          const idx = (py * result.width + px) * 4;
          
          // Alpha blending
          const srcR = color.r;
          const srcG = color.g;
          const srcB = color.b;
          const srcA = finalAlpha;

          const dstR = result.data[idx];
          const dstG = result.data[idx + 1];
          const dstB = result.data[idx + 2];
          const dstA = result.data[idx + 3] / 255;

          // Формула alpha blending
          const outA = srcA + dstA * (1 - srcA);
          if (outA > 0) {
            result.data[idx] = (srcR * srcA + dstR * dstA * (1 - srcA)) / outA;
            result.data[idx + 1] = (srcG * srcA + dstG * dstA * (1 - srcA)) / outA;
            result.data[idx + 2] = (srcB * srcA + dstB * dstA * (1 - srcA)) / outA;
            result.data[idx + 3] = outA * 255;
          }
        }
      }
    }

    return result;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  getResult(): Document | null {
    return this.resultDocument;
  }

  getBeforeImageData(): ImageData | null {
    return this.beforeImageData;
  }

  getAfterImageData(): ImageData | null {
    return this.afterImageData;
  }
}
