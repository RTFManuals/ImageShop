import { describe, it, expect } from 'vitest';
import { GaussianBlurFilter } from './GaussianBlurFilter';
import { SharpenFilter } from './SharpenFilter';
import { NoiseReductionFilter } from './NoiseReductionFilter';

describe('GaussianBlurFilter', () => {
  it('should apply blur with radius 0', () => {
    const imageData = new ImageData(10, 10);
    // Fill with white
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 255;
      imageData.data[i + 1] = 255;
      imageData.data[i + 2] = 255;
      imageData.data[i + 3] = 255;
    }

    const result = GaussianBlurFilter.apply(imageData, 0);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });

  it('should apply blur with radius 2', () => {
    const imageData = new ImageData(20, 20);
    // Create a simple pattern
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const idx = (y * 20 + x) * 4;
        imageData.data[idx] = (x + y) % 2 === 0 ? 255 : 0;
        imageData.data[idx + 1] = (x + y) % 2 === 0 ? 255 : 0;
        imageData.data[idx + 2] = (x + y) % 2 === 0 ? 255 : 0;
        imageData.data[idx + 3] = 255;
      }
    }

    const result = GaussianBlurFilter.apply(imageData, 2);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
    // Blurred image should have intermediate values
    expect(result.data[0]).toBeGreaterThanOrEqual(0);
    expect(result.data[0]).toBeLessThanOrEqual(255);
  });

  it('should preserve image dimensions', () => {
    const imageData = new ImageData(50, 30);
    const result = GaussianBlurFilter.apply(imageData, 3);
    expect(result.width).toBe(50);
    expect(result.height).toBe(30);
  });
});

describe('SharpenFilter', () => {
  it('should apply sharpen with default amount', () => {
    const imageData = new ImageData(10, 10);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 128;
      imageData.data[i + 1] = 128;
      imageData.data[i + 2] = 128;
      imageData.data[i + 3] = 255;
    }

    const result = SharpenFilter.apply(imageData);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });

  it('should apply sharpen with custom amount', () => {
    const imageData = new ImageData(20, 20);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 100;
      imageData.data[i + 1] = 150;
      imageData.data[i + 2] = 200;
      imageData.data[i + 3] = 255;
    }

    const result = SharpenFilter.apply(imageData, 2);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });

  it('should preserve image dimensions', () => {
    const imageData = new ImageData(40, 60);
    const result = SharpenFilter.apply(imageData, 1.5);
    expect(result.width).toBe(40);
    expect(result.height).toBe(60);
  });
});

describe('NoiseReductionFilter', () => {
  it('should apply noise reduction with default strength', () => {
    const imageData = new ImageData(10, 10);
    // Add some noise
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = Math.random() * 50;
      imageData.data[i] = 128 + noise;
      imageData.data[i + 1] = 128 + noise;
      imageData.data[i + 2] = 128 + noise;
      imageData.data[i + 3] = 255;
    }

    const result = NoiseReductionFilter.apply(imageData);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });

  it('should apply noise reduction with custom strength', () => {
    const imageData = new ImageData(20, 20);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = Math.random() * 255;
      imageData.data[i + 1] = Math.random() * 255;
      imageData.data[i + 2] = Math.random() * 255;
      imageData.data[i + 3] = 255;
    }

    const result = NoiseReductionFilter.apply(imageData, 2);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });

  it('should preserve image dimensions', () => {
    const imageData = new ImageData(35, 45);
    const result = NoiseReductionFilter.apply(imageData, 1.5);
    expect(result.width).toBe(35);
    expect(result.height).toBe(45);
  });

  it('should preserve alpha channel', () => {
    const imageData = new ImageData(10, 10);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 128;
      imageData.data[i + 1] = 128;
      imageData.data[i + 2] = 128;
      imageData.data[i + 3] = 200; // Custom alpha
    }

    const result = NoiseReductionFilter.apply(imageData, 1);
    // Alpha should be preserved
    expect(result.data[3]).toBe(200);
  });
});
