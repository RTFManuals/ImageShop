import { RasterLayer } from '../document/DocumentTypes';

export interface LayerEffect {
  type: string;
  enabled: boolean;
}

export interface DropShadowEffect extends LayerEffect {
  type: 'dropShadow';
  color: { r: number; g: number; b: number; a: number };
  opacity: number; // 0-100
  angle: number; // degrees
  distance: number; // pixels
  spread: number; // 0-100
  size: number; // blur radius
}

export interface StrokeEffect extends LayerEffect {
  type: 'stroke';
  color: { r: number; g: number; b: number; a: number };
  size: number; // pixels
  position: 'inside' | 'center' | 'outside';
  opacity: number; // 0-100
}

export interface OuterGlowEffect extends LayerEffect {
  type: 'outerGlow';
  color: { r: number; g: number; b: number; a: number };
  opacity: number; // 0-100
  spread: number; // 0-100
  size: number; // blur radius
}

export type AnyLayerEffect = DropShadowEffect | StrokeEffect | OuterGlowEffect;

export class LayerEffectsRenderer {
  static applyEffects(
    layer: RasterLayer,
    effects: AnyLayerEffect[]
  ): ImageData {
    let result = new ImageData(
      new Uint8ClampedArray(layer.imageData.data),
      layer.imageData.width,
      layer.imageData.height
    );

    // Создаём расширенный canvas для эффектов
    const maxExtension = this.calculateMaxExtension(effects);
    const extendedWidth = layer.width + maxExtension * 2;
    const extendedHeight = layer.height + maxExtension * 2;
    
    let extendedCanvas = new ImageData(extendedWidth, extendedHeight);
    
    // Копируем оригинальное изображение в центр
    for (let y = 0; y < layer.height; y++) {
      for (let x = 0; x < layer.width; x++) {
        const srcIdx = (y * layer.width + x) * 4;
        const dstIdx = ((y + maxExtension) * extendedWidth + (x + maxExtension)) * 4;
        
        extendedCanvas.data[dstIdx] = result.data[srcIdx];
        extendedCanvas.data[dstIdx + 1] = result.data[srcIdx + 1];
        extendedCanvas.data[dstIdx + 2] = result.data[srcIdx + 2];
        extendedCanvas.data[dstIdx + 3] = result.data[srcIdx + 3];
      }
    }

    // Применяем эффекты в порядке
    for (const effect of effects) {
      if (!effect.enabled) continue;

      switch (effect.type) {
        case 'dropShadow':
          extendedCanvas = this.applyDropShadow(extendedCanvas, effect as DropShadowEffect);
          break;
        case 'stroke':
          extendedCanvas = this.applyStroke(extendedCanvas, effect as StrokeEffect, maxExtension);
          break;
        case 'outerGlow':
          extendedCanvas = this.applyOuterGlow(extendedCanvas, effect as OuterGlowEffect);
          break;
      }
    }

    // Возвращаем результат нужного размера
    result = new ImageData(extendedWidth, extendedHeight);
    for (let i = 0; i < extendedCanvas.data.length; i++) {
      result.data[i] = extendedCanvas.data[i];
    }

    return result;
  }

  private static calculateMaxExtension(effects: AnyLayerEffect[]): number {
    let maxExt = 0;
    
    for (const effect of effects) {
      if (!effect.enabled) continue;

      switch (effect.type) {
        case 'dropShadow':
          const shadow = effect as DropShadowEffect;
          maxExt = Math.max(maxExt, shadow.distance + shadow.size);
          break;
        case 'stroke':
          const stroke = effect as StrokeEffect;
          maxExt = Math.max(maxExt, stroke.size);
          break;
        case 'outerGlow':
          const glow = effect as OuterGlowEffect;
          maxExt = Math.max(maxExt, glow.size);
          break;
      }
    }

    return maxExt;
  }

  private static applyDropShadow(
    imageData: ImageData,
    effect: DropShadowEffect
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Создаём маску тени из alpha канала
    const shadowMask = new ImageData(imageData.width, imageData.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];
      if (alpha > 0) {
        shadowMask.data[i] = effect.color.r;
        shadowMask.data[i + 1] = effect.color.g;
        shadowMask.data[i + 2] = effect.color.b;
        shadowMask.data[i + 3] = Math.round((effect.opacity / 100) * alpha);
      }
    }

    // Применяем размытие
    const blurredShadow = this.blurImageData(shadowMask, effect.size);

    // Смещаем тень
    const angleRad = (effect.angle * Math.PI) / 180;
    const offsetX = Math.cos(angleRad) * effect.distance;
    const offsetY = Math.sin(angleRad) * effect.distance;

    // Композитим тень под оригиналом
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const srcX = Math.round(x - offsetX);
        const srcY = Math.round(y - offsetY);

        if (srcX >= 0 && srcX < imageData.width && srcY >= 0 && srcY < imageData.height) {
          const srcIdx = (srcY * imageData.width + srcX) * 4;
          const dstIdx = (y * imageData.width + x) * 4;

          const shadowAlpha = blurredShadow.data[srcIdx + 3] / 255;
          const originalAlpha = result.data[dstIdx + 3] / 255;

          if (shadowAlpha > 0 && originalAlpha === 0) {
            result.data[dstIdx] = blurredShadow.data[srcIdx];
            result.data[dstIdx + 1] = blurredShadow.data[srcIdx + 1];
            result.data[dstIdx + 2] = blurredShadow.data[srcIdx + 2];
            result.data[dstIdx + 3] = blurredShadow.data[srcIdx + 3];
          }
        }
      }
    }

    return result;
  }

  private static applyStroke(
    imageData: ImageData,
    effect: StrokeEffect,
    layerOffset: number
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Находим границы alpha канала
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const idx = (y * imageData.width + x) * 4;
        const alpha = imageData.data[idx + 3];

        if (alpha > 0) {
          // Проверяем, является ли этот пиксель границей
          let isEdge = false;
          
          for (let dy = -effect.size; dy <= effect.size && !isEdge; dy++) {
            for (let dx = -effect.size; dx <= effect.size && !isEdge; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              
              if (nx < 0 || nx >= imageData.width || ny < 0 || ny >= imageData.height) {
                isEdge = true;
              } else {
                const nIdx = (ny * imageData.width + nx) * 4;
                if (imageData.data[nIdx + 3] === 0) {
                  isEdge = true;
                }
              }
            }
          }

          if (isEdge) {
            result.data[idx] = effect.color.r;
            result.data[idx + 1] = effect.color.g;
            result.data[idx + 2] = effect.color.b;
            result.data[idx + 3] = Math.round((effect.opacity / 100) * 255);
          }
        }
      }
    }

    return result;
  }

  private static applyOuterGlow(
    imageData: ImageData,
    effect: OuterGlowEffect
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Создаём маску свечения из alpha канала
    const glowMask = new ImageData(imageData.width, imageData.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];
      if (alpha > 0) {
        glowMask.data[i] = effect.color.r;
        glowMask.data[i + 1] = effect.color.g;
        glowMask.data[i + 2] = effect.color.b;
        glowMask.data[i + 3] = Math.round((effect.opacity / 100) * alpha);
      }
    }

    // Инвертируем маску (свечение снаружи)
    const invertedMask = new ImageData(imageData.width, imageData.height);
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const idx = (y * imageData.width + x) * 4;
        
        // Проверяем, есть ли непрозрачные пиксели рядом
        let hasOpaqueNeighbor = false;
        for (let dy = -effect.size; dy <= effect.size && !hasOpaqueNeighbor; dy++) {
          for (let dx = -effect.size; dx <= effect.size && !hasOpaqueNeighbor; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < imageData.width && ny >= 0 && ny < imageData.height) {
              const nIdx = (ny * imageData.width + nx) * 4;
              if (imageData.data[nIdx + 3] > 0) {
                hasOpaqueNeighbor = true;
              }
            }
          }
        }

        if (hasOpaqueNeighbor && imageData.data[idx + 3] === 0) {
          invertedMask.data[idx] = glowMask.data[idx];
          invertedMask.data[idx + 1] = glowMask.data[idx + 1];
          invertedMask.data[idx + 2] = glowMask.data[idx + 2];
          invertedMask.data[idx + 3] = glowMask.data[idx + 3];
        }
      }
    }

    // Применяем размытие
    const blurredGlow = this.blurImageData(invertedMask, effect.size);

    // Композитим свечение под оригиналом
    for (let i = 0; i < result.data.length; i += 4) {
      if (result.data[i + 3] === 0 && blurredGlow.data[i + 3] > 0) {
        result.data[i] = blurredGlow.data[i];
        result.data[i + 1] = blurredGlow.data[i + 1];
        result.data[i + 2] = blurredGlow.data[i + 2];
        result.data[i + 3] = blurredGlow.data[i + 3];
      }
    }

    return result;
  }

  private static blurImageData(imageData: ImageData, radius: number): ImageData {
    if (radius <= 0) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src.length);

    // Простое box blur для производительности
    const kernelSize = Math.ceil(radius) * 2 + 1;

    // Горизонтальное размытие
    const temp = new Uint8ClampedArray(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let k = -Math.floor(kernelSize / 2); k <= Math.floor(kernelSize / 2); k++) {
          const kx = Math.min(Math.max(x + k, 0), width - 1);
          const idx = (y * width + kx) * 4;
          
          r += src[idx];
          g += src[idx + 1];
          b += src[idx + 2];
          a += src[idx + 3];
          count++;
        }
        
        const idx = (y * width + x) * 4;
        temp[idx] = r / count;
        temp[idx + 1] = g / count;
        temp[idx + 2] = b / count;
        temp[idx + 3] = a / count;
      }
    }

    // Вертикальное размытие
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let k = -Math.floor(kernelSize / 2); k <= Math.floor(kernelSize / 2); k++) {
          const ky = Math.min(Math.max(y + k, 0), height - 1);
          const idx = (ky * width + x) * 4;
          
          r += temp[idx];
          g += temp[idx + 1];
          b += temp[idx + 2];
          a += temp[idx + 3];
          count++;
        }
        
        const idx = (y * width + x) * 4;
        dst[idx] = r / count;
        dst[idx + 1] = g / count;
        dst[idx + 2] = b / count;
        dst[idx + 3] = a / count;
      }
    }

    return new ImageData(dst, width, height);
  }
}
