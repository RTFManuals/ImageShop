import { describe, it, expect } from 'vitest';
import { LayerEffectsRenderer, DropShadowEffect, StrokeEffect, OuterGlowEffect } from './LayerEffects';
import { RasterLayer } from '../document/DocumentTypes';

describe('LayerEffectsRenderer', () => {
  const createTestLayer = (): RasterLayer => {
    const imageData = new ImageData(50, 50);
    
    // Создаём простой квадрат в центре
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        const idx = (y * 50 + x) * 4;
        imageData.data[idx] = 255;     // R
        imageData.data[idx + 1] = 0;   // G
        imageData.data[idx + 2] = 0;   // B
        imageData.data[idx + 3] = 255; // A
      }
    }

    return {
      id: 'layer1',
      name: 'Test Layer',
      type: 'raster',
      visible: true,
      opacity: 100,
      blendMode: 'normal',
      locked: false,
      width: 50,
      height: 50,
      imageData,
    };
  };

  it('should apply drop shadow effect', () => {
    const layer = createTestLayer();
    const effect: DropShadowEffect = {
      type: 'dropShadow',
      enabled: true,
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 75,
      angle: 45,
      distance: 5,
      spread: 0,
      size: 3,
    };

    const result = LayerEffectsRenderer.applyEffects(layer, [effect]);
    
    expect(result.width).toBeGreaterThan(layer.width);
    expect(result.height).toBeGreaterThan(layer.height);
  });

  it('should apply stroke effect', () => {
    const layer = createTestLayer();
    const effect: StrokeEffect = {
      type: 'stroke',
      enabled: true,
      color: { r: 0, g: 255, b: 0, a: 1 },
      size: 2,
      position: 'outside',
      opacity: 100,
    };

    const result = LayerEffectsRenderer.applyEffects(layer, [effect]);
    
    expect(result.width).toBeGreaterThan(layer.width);
    expect(result.height).toBeGreaterThan(layer.height);
  });

  it('should apply outer glow effect', () => {
    const layer = createTestLayer();
    const effect: OuterGlowEffect = {
      type: 'outerGlow',
      enabled: true,
      color: { r: 255, g: 255, b: 0, a: 1 },
      opacity: 50,
      spread: 0,
      size: 4,
    };

    const result = LayerEffectsRenderer.applyEffects(layer, [effect]);
    
    expect(result.width).toBeGreaterThan(layer.width);
    expect(result.height).toBeGreaterThan(layer.height);
  });

  it('should apply multiple effects', () => {
    const layer = createTestLayer();
    const effects: Array<DropShadowEffect | StrokeEffect | OuterGlowEffect> = [
      {
        type: 'dropShadow',
        enabled: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 75,
        angle: 45,
        distance: 5,
        spread: 0,
        size: 3,
      },
      {
        type: 'stroke',
        enabled: true,
        color: { r: 0, g: 255, b: 0, a: 1 },
        size: 2,
        position: 'outside',
        opacity: 100,
      },
    ];

    const result = LayerEffectsRenderer.applyEffects(layer, effects);
    
    expect(result.width).toBeGreaterThan(layer.width);
    expect(result.height).toBeGreaterThan(layer.height);
  });

  it('should skip disabled effects', () => {
    const layer = createTestLayer();
    const effect: DropShadowEffect = {
      type: 'dropShadow',
      enabled: false,
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 75,
      angle: 45,
      distance: 5,
      spread: 0,
      size: 3,
    };

    const result = LayerEffectsRenderer.applyEffects(layer, [effect]);
    
    // Если эффект отключён, размер не должен измениться
    expect(result.width).toBe(layer.width);
    expect(result.height).toBe(layer.height);
  });

  it('should handle empty effects array', () => {
    const layer = createTestLayer();
    const result = LayerEffectsRenderer.applyEffects(layer, []);
    
    expect(result.width).toBe(layer.width);
    expect(result.height).toBe(layer.height);
  });
});
