import { describe, it, expect } from 'vitest';
import { Mask } from './LayerMask';
import { BrightnessContrastAdjustment, HueSaturationAdjustment, LevelsAdjustment } from './Adjustment';

describe('Mask', () => {
  it('should create empty mask', () => {
    const mask = new Mask(100, 100);
    expect(mask.width).toBe(100);
    expect(mask.height).toBe(100);
  });

  it('should paint on mask', () => {
    const mask = new Mask(100, 100);
    mask.paint(50, 50, 10, 255);
    
    const selection = mask.getSelection();
    expect(selection.contains(50, 50)).toBe(true);
    expect(selection.contains(0, 0)).toBe(false);
  });

  it('should apply mask to image data', () => {
    const mask = new Mask(10, 10);
    mask.paint(5, 5, 2, 255);
    
    const imageData = new ImageData(10, 10);
    // Fill with white
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 255;
      imageData.data[i + 1] = 255;
      imageData.data[i + 2] = 255;
      imageData.data[i + 3] = 255;
    }
    
    const result = mask.applyToImageData(imageData);
    
    // Pixels outside mask should be transparent
    expect(result.data[0 + 3]).toBe(0); // Top-left corner
    // Pixels inside mask should be visible
    const centerIdx = (5 * 10 + 5) * 4 + 3;
    expect(result.data[centerIdx]).toBe(255);
  });

  it('should clone mask', () => {
    const mask = new Mask(100, 100);
    mask.paint(50, 50, 10, 255);
    
    const cloned = mask.clone();
    expect(cloned.width).toBe(100);
    expect(cloned.height).toBe(100);
    
    const selection = cloned.getSelection();
    expect(selection.contains(50, 50)).toBe(true);
  });

  it('should invert mask', () => {
    const mask = new Mask(10, 10);
    mask.paint(5, 5, 2, 255);
    
    mask.invert();
    
    const selection = mask.getSelection();
    expect(selection.contains(5, 5)).toBe(false);
    expect(selection.contains(0, 0)).toBe(true);
  });
});

describe('BrightnessContrastAdjustment', () => {
  it('should create with default values', () => {
    const adj = new BrightnessContrastAdjustment();
    expect(adj.settings.brightness).toBe(0);
    expect(adj.settings.contrast).toBe(0);
  });

  it('should apply brightness', () => {
    const adj = new BrightnessContrastAdjustment(50, 0);
    
    const imageData = new ImageData(2, 2);
    // Set all pixels to gray (128)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 128;
      imageData.data[i + 1] = 128;
      imageData.data[i + 2] = 128;
      imageData.data[i + 3] = 255;
    }
    
    const result = adj.apply(imageData);
    
    // Should be brighter
    expect(result.data[0]).toBe(178); // 128 + 50
  });

  it('should clone adjustment', () => {
    const adj = new BrightnessContrastAdjustment(50, 30);
    const cloned = adj.clone();
    
    expect(cloned.settings.brightness).toBe(50);
    expect(cloned.settings.contrast).toBe(30);
  });
});

describe('HueSaturationAdjustment', () => {
  it('should create with default values', () => {
    const adj = new HueSaturationAdjustment();
    expect(adj.settings.hue).toBe(0);
    expect(adj.settings.saturation).toBe(0);
    expect(adj.settings.lightness).toBe(0);
  });

  it('should apply hue shift', () => {
    const adj = new HueSaturationAdjustment(180, 0, 0);
    
    const imageData = new ImageData(1, 1);
    imageData.data[0] = 255; // R
    imageData.data[1] = 0;   // G
    imageData.data[2] = 0;   // B
    imageData.data[3] = 255; // A
    
    const result = adj.apply(imageData);
    
    // Red should shift to cyan (opposite on color wheel)
    expect(result.data[0]).toBeLessThan(100);
    expect(result.data[2]).toBeGreaterThan(150);
  });

  it('should clone adjustment', () => {
    const adj = new HueSaturationAdjustment(90, 50, 20);
    const cloned = adj.clone();
    
    expect(cloned.settings.hue).toBe(90);
    expect(cloned.settings.saturation).toBe(50);
    expect(cloned.settings.lightness).toBe(20);
  });
});

describe('LevelsAdjustment', () => {
  it('should create with default values', () => {
    const adj = new LevelsAdjustment();
    expect(adj.settings.inputBlack).toBe(0);
    expect(adj.settings.inputWhite).toBe(255);
    expect(adj.settings.gamma).toBe(1);
  });

  it('should apply input levels', () => {
    const adj = new LevelsAdjustment(50, 200, 1, 0, 255);
    
    const imageData = new ImageData(1, 1);
    imageData.data[0] = 100;
    imageData.data[1] = 100;
    imageData.data[2] = 100;
    imageData.data[3] = 255;
    
    const result = adj.apply(imageData);
    
    // Value should be remapped
    expect(result.data[0]).not.toBe(100);
  });

  it('should apply gamma correction', () => {
    const adj = new LevelsAdjustment(0, 255, 2, 0, 255);
    
    const imageData = new ImageData(1, 1);
    imageData.data[0] = 128;
    imageData.data[1] = 128;
    imageData.data[2] = 128;
    imageData.data[3] = 255;
    
    const result = adj.apply(imageData);
    
    // Gamma 2 should darken midtones
    expect(result.data[0]).toBeLessThan(128);
  });

  it('should clone adjustment', () => {
    const adj = new LevelsAdjustment(10, 240, 1.5, 5, 250);
    const cloned = adj.clone();
    
    expect(cloned.settings.inputBlack).toBe(10);
    expect(cloned.settings.inputWhite).toBe(240);
    expect(cloned.settings.gamma).toBe(1.5);
  });
});
