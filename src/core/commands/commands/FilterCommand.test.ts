import { describe, it, expect, beforeEach } from 'vitest';
import { FilterCommand } from './FilterCommand';
import { Document } from '../../document/Document';
import { RasterLayer } from '../../document/DocumentTypes';

describe('FilterCommand', () => {
  let document: Document;
  let layer: RasterLayer;

  beforeEach(() => {
    document = Document.create(100, 100);
    
    // Создаём тестовый слой с изображением
    const imageData = new ImageData(100, 100);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 128;     // R
      imageData.data[i + 1] = 128; // G
      imageData.data[i + 2] = 128; // B
      imageData.data[i + 3] = 255; // A
    }

    layer = {
      id: 'layer1',
      name: 'Test Layer',
      type: 'raster',
      visible: true,
      opacity: 100,
      blendMode: 'normal',
      locked: false,
      width: 100,
      height: 100,
      imageData,
    };

    document = document.addLayer(layer);
  });

  it('should apply filter and create undo state', () => {
    const invertFilter = (imageData: ImageData): ImageData => {
      const result = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      
      for (let i = 0; i < result.data.length; i += 4) {
        result.data[i] = 255 - result.data[i];
        result.data[i + 1] = 255 - result.data[i + 1];
        result.data[i + 2] = 255 - result.data[i + 2];
      }
      
      return result;
    };

    const command = new FilterCommand(document, 'layer1', invertFilter, 'Invert');
    command.execute();

    const result = command.getResult();
    expect(result).not.toBeNull();
    
    const resultLayer = result!.getLayer('layer1') as RasterLayer;
    expect(resultLayer.imageData.data[0]).toBe(127); // 255 - 128
    expect(resultLayer.imageData.data[1]).toBe(127);
    expect(resultLayer.imageData.data[2]).toBe(127);
  });

  it('should undo filter and restore original state', () => {
    const invertFilter = (imageData: ImageData): ImageData => {
      const result = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      
      for (let i = 0; i < result.data.length; i += 4) {
        result.data[i] = 255 - result.data[i];
        result.data[i + 1] = 255 - result.data[i + 1];
        result.data[i + 2] = 255 - result.data[i + 2];
      }
      
      return result;
    };

    const command = new FilterCommand(document, 'layer1', invertFilter, 'Invert');
    command.execute();
    
    const resultAfterExecute = command.getResult();
    const layerAfterExecute = resultAfterExecute!.getLayer('layer1') as RasterLayer;
    expect(layerAfterExecute.imageData.data[0]).toBe(127);

    // Undo
    command.undo();
    
    const resultAfterUndo = command.getResult();
    const layerAfterUndo = resultAfterUndo!.getLayer('layer1') as RasterLayer;
    expect(layerAfterUndo.imageData.data[0]).toBe(128); // Original value
  });

  it('should store before and after image data', () => {
    const brightnessFilter = (imageData: ImageData): ImageData => {
      const result = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      
      for (let i = 0; i < result.data.length; i += 4) {
        result.data[i] = Math.min(255, result.data[i] + 50);
        result.data[i + 1] = Math.min(255, result.data[i + 1] + 50);
        result.data[i + 2] = Math.min(255, result.data[i + 2] + 50);
      }
      
      return result;
    };

    const command = new FilterCommand(document, 'layer1', brightnessFilter, 'Brightness');
    command.execute();

    const beforeData = command.getBeforeImageData();
    const afterData = command.getAfterImageData();

    expect(beforeData).not.toBeNull();
    expect(afterData).not.toBeNull();
    expect(beforeData!.data[0]).toBe(128);
    expect(afterData!.data[0]).toBe(178); // 128 + 50
  });

  it('should return filter name', () => {
    const noopFilter = (imageData: ImageData): ImageData => imageData;
    const command = new FilterCommand(document, 'layer1', noopFilter, 'Test Filter');
    
    expect(command.getFilterName()).toBe('Test Filter');
  });

  it('should not modify non-raster layers', () => {
    const groupLayer = {
      id: 'group1',
      name: 'Group',
      type: 'group' as const,
      visible: true,
      opacity: 100,
      blendMode: 'normal' as const,
      locked: false,
      children: [],
      expanded: true,
    };

    document = document.addLayer(groupLayer);

    const noopFilter = (imageData: ImageData): ImageData => imageData;
    const command = new FilterCommand(document, 'group1', noopFilter, 'Test');
    command.execute();

    const result = command.getResult();
    expect(result).toBeNull();
  });
});
