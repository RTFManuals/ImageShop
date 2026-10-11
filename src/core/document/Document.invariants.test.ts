import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from './Document';
import { RasterLayer } from './DocumentTypes';

describe('Document Invariants', () => {
  let doc: Document;

  beforeEach(() => {
    doc = Document.create(100, 100, 'Test');
  });

  describe('Dimension Validation', () => {
    it('should reject zero width', () => {
      expect(() => Document.create(0, 100)).toThrow('Document dimensions must be positive');
    });

    it('should reject zero height', () => {
      expect(() => Document.create(100, 0)).toThrow('Document dimensions must be positive');
    });

    it('should reject negative dimensions', () => {
      expect(() => Document.create(-10, 100)).toThrow('Document dimensions must be positive');
      expect(() => Document.create(100, -10)).toThrow('Document dimensions must be positive');
    });

    it('should reject non-integer dimensions', () => {
      expect(() => Document.create(100.5, 100)).toThrow('Document dimensions must be integers');
      expect(() => Document.create(100, 100.5)).toThrow('Document dimensions must be integers');
    });

    it('should reject extremely large dimensions', () => {
      expect(() => Document.create(100001, 100)).toThrow('Document dimensions too large');
      expect(() => Document.create(100, 100001)).toThrow('Document dimensions too large');
    });

    it('should accept valid dimensions', () => {
      expect(() => Document.create(1, 1)).not.toThrow();
      expect(() => Document.create(100000, 100000)).not.toThrow();
    });

    it('should validate resize dimensions', () => {
      expect(() => doc.resize(0, 100)).toThrow('Document dimensions must be positive');
      expect(() => doc.resize(100, 0)).toThrow('Document dimensions must be positive');
      expect(() => doc.resize(100.5, 100)).toThrow('Document dimensions must be integers');
      expect(() => doc.resize(100001, 100)).toThrow('Document dimensions too large');
    });
  });

  describe('Layer ID Uniqueness', () => {
    it('should reject duplicate layer IDs', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const layer2: RasterLayer = { ...layer1, name: 'Layer 2' };

      doc = doc.addLayer(layer1);
      expect(() => doc.addLayer(layer2)).toThrow('Layer with id "layer1" already exists');
    });

    it('should reject empty layer ID', () => {
      const layer: RasterLayer = {
        id: '',
        name: 'Layer',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      expect(() => doc.addLayer(layer)).toThrow('Layer ID cannot be empty');
    });

    it('should reject whitespace-only layer ID', () => {
      const layer: RasterLayer = {
        id: '   ',
        name: 'Layer',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      expect(() => doc.addLayer(layer)).toThrow('Layer ID cannot be empty');
    });
  });

  describe('Active Layer Handling', () => {
    it('should set first layer as active when added', () => {
      const layer: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      doc = doc.addLayer(layer);
      expect(doc.activeLayerId).toBe('layer1');
    });

    it('should select previous layer when active layer is removed', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const layer2: RasterLayer = { ...layer1, id: 'layer2', name: 'Layer 2' };
      const layer3: RasterLayer = { ...layer1, id: 'layer3', name: 'Layer 3' };

      doc = doc.addLayer(layer1).addLayer(layer2).addLayer(layer3);
      doc = doc.setActiveLayer('layer2');

      // Remove active layer
      doc = doc.removeLayer('layer2');

      // Should select previous layer
      expect(doc.activeLayerId).toBe('layer1');
    });

    it('should select first layer when first layer is removed', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const layer2: RasterLayer = { ...layer1, id: 'layer2', name: 'Layer 2' };

      doc = doc.addLayer(layer1).addLayer(layer2);
      doc = doc.setActiveLayer('layer1');

      // Remove first layer
      doc = doc.removeLayer('layer1');

      // Should select next layer
      expect(doc.activeLayerId).toBe('layer2');
    });

    it('should set active layer to null when last layer is removed', () => {
      const layer: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      doc = doc.addLayer(layer);
      doc = doc.removeLayer('layer1');

      expect(doc.activeLayerId).toBeNull();
    });

    it('should reject setting non-existent layer as active', () => {
      expect(() => doc.setActiveLayer('nonexistent')).toThrow('Layer with id "nonexistent" not found');
    });

    it('should allow setting active layer to null', () => {
      const layer: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      doc = doc.addLayer(layer);
      doc = doc.setActiveLayer(null);

      expect(doc.activeLayerId).toBeNull();
    });
  });

  describe('Reorder Validation', () => {
    it('should reject reorder with missing layer IDs', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const layer2: RasterLayer = { ...layer1, id: 'layer2', name: 'Layer 2' };

      doc = doc.addLayer(layer1).addLayer(layer2);

      expect(() => doc.reorderLayers(['layer1'])).toThrow('Reorder must include all layers');
    });

    it('should reject reorder with non-existent layer IDs', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      doc = doc.addLayer(layer1);

      expect(() => doc.reorderLayers(['layer1', 'nonexistent'])).toThrow('Layer with id "nonexistent" not found');
    });

    it('should reject reorder with duplicate layer IDs', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const layer2: RasterLayer = { ...layer1, id: 'layer2', name: 'Layer 2' };

      doc = doc.addLayer(layer1).addLayer(layer2);

      expect(() => doc.reorderLayers(['layer1', 'layer1'])).toThrow('Reorder contains duplicate layer IDs');
    });

    it('should accept valid reorder', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const layer2: RasterLayer = { ...layer1, id: 'layer2', name: 'Layer 2' };

      doc = doc.addLayer(layer1).addLayer(layer2);

      expect(() => doc.reorderLayers(['layer2', 'layer1'])).not.toThrow();
      
      const reordered = doc.reorderLayers(['layer2', 'layer1']);
      expect(reordered.layers[0].id).toBe('layer2');
      expect(reordered.layers[1].id).toBe('layer1');
    });
  });

  describe('Remove Layer Validation', () => {
    it('should reject removing non-existent layer', () => {
      expect(() => doc.removeLayer('nonexistent')).toThrow('Layer with id "nonexistent" not found');
    });

    it('should preserve all other layers when removing', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const layer2: RasterLayer = { ...layer1, id: 'layer2', name: 'Layer 2' };
      const layer3: RasterLayer = { ...layer1, id: 'layer3', name: 'Layer 3' };

      doc = doc.addLayer(layer1).addLayer(layer2).addLayer(layer3);
      doc = doc.removeLayer('layer2');

      expect(doc.layers.length).toBe(2);
      expect(doc.getLayer('layer1')).toBeDefined();
      expect(doc.getLayer('layer3')).toBeDefined();
      expect(doc.getLayer('layer2')).toBeUndefined();
    });
  });
});
