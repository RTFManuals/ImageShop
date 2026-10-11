import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../core/document';
import { DocumentHistoryManager, PaintStrokeCommand, StrokeData } from '../core/commands';
import { RasterLayer } from '../core/document/DocumentTypes';

describe('Brush and Eraser Functionality', () => {
  let document: Document;
  let historyManager: DocumentHistoryManager;
  let layerId: string;

  const createTestLayer = (): RasterLayer => {
    const imageData = new ImageData(100, 100);
    // Fill with white
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 255;     // R
      imageData.data[i + 1] = 255; // G
      imageData.data[i + 2] = 255; // B
      imageData.data[i + 3] = 255; // A
    }
    
    return {
      id: 'test-layer',
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
  };

  beforeEach(() => {
    document = Document.create(100, 100, 'Test Document');
    historyManager = new DocumentHistoryManager(60);
    
    const layer = createTestLayer();
    layerId = layer.id;
    document = document.addLayer(layer);
  });

  describe('Brush Pixel Modifications', () => {
    it('should modify pixels when brush stroke is executed', () => {
      const strokeData: StrokeData = {
        points: [
          { x: 50, y: 50, pressure: 1 },
          { x: 55, y: 55, pressure: 1 },
        ],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const command = new PaintStrokeCommand(layerId, strokeData);
      const docAfterStroke = historyManager.execute(command, document);
      
      const layer = docAfterStroke.getLayer(layerId) as RasterLayer;
      
      // Check that pixels were modified (should have red color now)
      const pixelIndex = (50 * 100 + 50) * 4;
      expect(layer.imageData.data[pixelIndex]).toBeGreaterThan(200); // R should be high
      expect(layer.imageData.data[pixelIndex + 1]).toBeLessThan(50); // G should be low
      expect(layer.imageData.data[pixelIndex + 2]).toBeLessThan(50); // B should be low
    });

    it('should respect brush opacity', () => {
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 50, // 50% opacity
        hardness: 100,
        mode: 'brush',
      };

      const command = new PaintStrokeCommand(layerId, strokeData);
      const docAfterStroke = historyManager.execute(command, document);
      
      const layer = docAfterStroke.getLayer(layerId) as RasterLayer;
      const pixelIndex = (50 * 100 + 50) * 4;
      
      // With 50% opacity on white background, red should be blended
      const r = layer.imageData.data[pixelIndex];
      const g = layer.imageData.data[pixelIndex + 1];
      const b = layer.imageData.data[pixelIndex + 2];
      
      // Should be a blend of red and white
      expect(r).toBeGreaterThan(200);
      expect(g).toBeGreaterThan(100);
      expect(b).toBeGreaterThan(100);
    });

    it('should respect brush size', () => {
      const smallBrush: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 5,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const largeBrush: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 20,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const docSmall = historyManager.execute(new PaintStrokeCommand(layerId, smallBrush), document);
      const docLarge = historyManager.execute(new PaintStrokeCommand(layerId, largeBrush), document);
      
      const layerSmall = docSmall.getLayer(layerId) as RasterLayer;
      const layerLarge = docLarge.getLayer(layerId) as RasterLayer;
      
      // Count modified pixels (pixels that are not white)
      let modifiedSmall = 0;
      let modifiedLarge = 0;
      
      for (let i = 0; i < layerSmall.imageData.data.length; i += 4) {
        if (layerSmall.imageData.data[i] < 250) modifiedSmall++;
        if (layerLarge.imageData.data[i] < 250) modifiedLarge++;
      }
      
      // Large brush should modify more pixels
      expect(modifiedLarge).toBeGreaterThan(modifiedSmall);
    });

    it('should handle multiple consecutive strokes', () => {
      const stroke1: StrokeData = {
        points: [{ x: 20, y: 20, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const stroke2: StrokeData = {
        points: [{ x: 80, y: 80, pressure: 1 }],
        color: '#00ff00',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const doc1 = historyManager.execute(new PaintStrokeCommand(layerId, stroke1), document);
      const doc2 = historyManager.execute(new PaintStrokeCommand(layerId, stroke2), doc1);
      
      const layer = doc2.getLayer(layerId) as RasterLayer;
      
      // Check first stroke (red at 20,20)
      const pixel1 = (20 * 100 + 20) * 4;
      expect(layer.imageData.data[pixel1]).toBeGreaterThan(200); // R
      expect(layer.imageData.data[pixel1 + 1]).toBeLessThan(50); // G
      
      // Check second stroke (green at 80,80)
      const pixel2 = (80 * 100 + 80) * 4;
      expect(layer.imageData.data[pixel2]).toBeLessThan(50); // R
      expect(layer.imageData.data[pixel2 + 1]).toBeGreaterThan(200); // G
    });
  });

  describe('Brush Undo/Redo', () => {
    it('should undo brush stroke', () => {
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const docAfterStroke = historyManager.execute(new PaintStrokeCommand(layerId, strokeData), document);
      
      // Verify stroke was applied
      let layer = docAfterStroke.getLayer(layerId) as RasterLayer;
      const pixelIndex = (50 * 100 + 50) * 4;
      expect(layer.imageData.data[pixelIndex]).toBeGreaterThan(200);
      
      // Undo
      const docAfterUndo = historyManager.undo(docAfterStroke);
      
      // Verify stroke was removed
      layer = docAfterUndo!.getLayer(layerId) as RasterLayer;
      expect(layer.imageData.data[pixelIndex]).toBe(255); // Back to white
    });

    it('should redo brush stroke', () => {
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const docAfterStroke = historyManager.execute(new PaintStrokeCommand(layerId, strokeData), document);
      const docAfterUndo = historyManager.undo(docAfterStroke);
      
      // Redo
      const docAfterRedo = historyManager.redo(docAfterUndo!);
      
      // Verify stroke was reapplied
      const layer = docAfterRedo!.getLayer(layerId) as RasterLayer;
      const pixelIndex = (50 * 100 + 50) * 4;
      expect(layer.imageData.data[pixelIndex]).toBeGreaterThan(200);
    });

    it('should handle multiple brush strokes with undo/redo', () => {
      const stroke1: StrokeData = {
        points: [{ x: 20, y: 20, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const stroke2: StrokeData = {
        points: [{ x: 80, y: 80, pressure: 1 }],
        color: '#00ff00',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const doc1 = historyManager.execute(new PaintStrokeCommand(layerId, stroke1), document);
      const doc2 = historyManager.execute(new PaintStrokeCommand(layerId, stroke2), doc1);
      
      // Undo second stroke
      const docAfterUndo1 = historyManager.undo(doc2);
      let layer = docAfterUndo1!.getLayer(layerId) as RasterLayer;
      
      // First stroke should still be there
      let pixel = (20 * 100 + 20) * 4;
      expect(layer.imageData.data[pixel]).toBeGreaterThan(200); // Red
      
      // Second stroke should be gone
      pixel = (80 * 100 + 80) * 4;
      expect(layer.imageData.data[pixel]).toBe(255); // White
      
      // Undo first stroke
      const docAfterUndo2 = historyManager.undo(docAfterUndo1!);
      layer = docAfterUndo2!.getLayer(layerId) as RasterLayer;
      
      // Both strokes should be gone
      pixel = (20 * 100 + 20) * 4;
      expect(layer.imageData.data[pixel]).toBe(255); // White
      
      // Redo first stroke
      const docAfterRedo1 = historyManager.redo(docAfterUndo2!);
      layer = docAfterRedo1!.getLayer(layerId) as RasterLayer;
      
      pixel = (20 * 100 + 20) * 4;
      expect(layer.imageData.data[pixel]).toBeGreaterThan(200); // Red
      
      // Redo second stroke
      const docAfterRedo2 = historyManager.redo(docAfterRedo1!);
      layer = docAfterRedo2!.getLayer(layerId) as RasterLayer;
      
      pixel = (80 * 100 + 80) * 4;
      expect(layer.imageData.data[pixel]).toBeGreaterThan(200); // Green
    });
  });

  describe('Eraser Pixel Modifications', () => {
    it('should clear pixels when eraser stroke is executed', () => {
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#000000', // Color doesn't matter for eraser
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'eraser',
      };

      const command = new PaintStrokeCommand(layerId, strokeData);
      const docAfterErase = historyManager.execute(command, document);
      
      const layer = docAfterErase.getLayer(layerId) as RasterLayer;
      const pixelIndex = (50 * 100 + 50) * 4;
      
      // Alpha should be 0 (transparent)
      expect(layer.imageData.data[pixelIndex + 3]).toBe(0);
    });

    it('should respect eraser opacity', () => {
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#000000',
        size: 10,
        opacity: 50, // 50% opacity
        hardness: 100,
        mode: 'eraser',
      };

      const command = new PaintStrokeCommand(layerId, strokeData);
      const docAfterErase = historyManager.execute(command, document);
      
      const layer = docAfterErase.getLayer(layerId) as RasterLayer;
      const pixelIndex = (50 * 100 + 50) * 4;
      
      // Alpha should be partially transparent
      const alpha = layer.imageData.data[pixelIndex + 3];
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(255);
    });
  });

  describe('Eraser Undo/Redo', () => {
    it('should undo eraser stroke', () => {
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#000000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'eraser',
      };

      const docAfterErase = historyManager.execute(new PaintStrokeCommand(layerId, strokeData), document);
      
      // Verify eraser was applied
      let layer = docAfterErase.getLayer(layerId) as RasterLayer;
      const pixelIndex = (50 * 100 + 50) * 4;
      expect(layer.imageData.data[pixelIndex + 3]).toBe(0);
      
      // Undo
      const docAfterUndo = historyManager.undo(docAfterErase);
      
      // Verify eraser was removed
      layer = docAfterUndo!.getLayer(layerId) as RasterLayer;
      expect(layer.imageData.data[pixelIndex + 3]).toBe(255); // Back to opaque
    });

    it('should redo eraser stroke', () => {
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#000000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'eraser',
      };

      const docAfterErase = historyManager.execute(new PaintStrokeCommand(layerId, strokeData), document);
      const docAfterUndo = historyManager.undo(docAfterErase);
      
      // Redo
      const docAfterRedo = historyManager.redo(docAfterUndo!);
      
      // Verify eraser was reapplied
      const layer = docAfterRedo!.getLayer(layerId) as RasterLayer;
      const pixelIndex = (50 * 100 + 50) * 4;
      expect(layer.imageData.data[pixelIndex + 3]).toBe(0);
    });
  });

  describe('Pixel Buffer Immutability', () => {
    it('should not mutate original image data', () => {
      const layer = document.getLayer(layerId) as RasterLayer;
      const originalImageData = layer.imageData;
      const originalData = new Uint8ClampedArray(originalImageData.data);
      
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      historyManager.execute(new PaintStrokeCommand(layerId, strokeData), document);
      
      // Original image data should be unchanged
      for (let i = 0; i < originalData.length; i++) {
        expect(originalImageData.data[i]).toBe(originalData[i]);
      }
    });

    it('should create new image data for each stroke', () => {
      const layer1 = document.getLayer(layerId) as RasterLayer;
      const imageData1 = layer1.imageData;
      
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const doc2 = historyManager.execute(new PaintStrokeCommand(layerId, strokeData), document);
      const layer2 = doc2.getLayer(layerId) as RasterLayer;
      const imageData2 = layer2.imageData;
      
      // Should be different objects
      expect(imageData1).not.toBe(imageData2);
      expect(imageData1.data).not.toBe(imageData2.data);
    });
  });

  describe('Active Layer and Selection Respect', () => {
    it('should throw error if layer does not exist', () => {
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const command = new PaintStrokeCommand('nonexistent-layer', strokeData);
      
      expect(() => {
        historyManager.execute(command, document);
      }).toThrow('Layer nonexistent-layer not found or not a raster layer');
    });

    it('should throw error if layer is not raster', () => {
      // Create a group layer
      const groupLayer = {
        id: 'group-layer',
        name: 'Group Layer',
        type: 'group' as const,
        visible: true,
        opacity: 100,
        blendMode: 'normal' as const,
        locked: false,
        children: [],
        expanded: true,
      };
      
      const docWithGroup = document.addLayer(groupLayer);
      
      const strokeData: StrokeData = {
        points: [{ x: 50, y: 50, pressure: 1 }],
        color: '#ff0000',
        size: 10,
        opacity: 100,
        hardness: 100,
        mode: 'brush',
      };

      const command = new PaintStrokeCommand('group-layer', strokeData);
      
      expect(() => {
        historyManager.execute(command, docWithGroup);
      }).toThrow('Layer group-layer not found or not a raster layer');
    });
  });
});
