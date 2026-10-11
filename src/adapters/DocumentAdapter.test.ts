import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentAdapter } from './DocumentAdapter';
import { Document as Doc } from '../core/document';
import { Layer as LegacyLayer } from '../types';

describe('DocumentAdapter', () => {
  describe('legacyToCore', () => {
    it('should convert legacy layer to core layer', () => {
      // Create legacy layer
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);

      const legacyLayer: LegacyLayer = {
        id: 'layer1',
        name: 'Test Layer',
        visible: true,
        opacity: 100,
        canvas,
        blendMode: 'normal',
        locked: false,
      };

      const coreLayer = DocumentAdapter.legacyToCore(legacyLayer, 100, 100);

      expect(coreLayer.id).toBe('layer1');
      expect(coreLayer.name).toBe('Test Layer');
      expect(coreLayer.type).toBe('raster');
      expect(coreLayer.visible).toBe(true);
      expect(coreLayer.opacity).toBe(100);
      expect(coreLayer.blendMode).toBe('normal');
      expect(coreLayer.locked).toBe(false);
      expect(coreLayer.width).toBe(100);
      expect(coreLayer.height).toBe(100);
      expect(coreLayer.imageData).toBeDefined();
      expect(coreLayer.imageData.width).toBe(100);
      expect(coreLayer.imageData.height).toBe(100);
    });

    it('should convert legacy layer with mask', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, 0, 100, 100);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = 100;
      maskCanvas.height = 100;
      const maskCtx = maskCanvas.getContext('2d')!;
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(0, 0, 100, 100);

      const legacyLayer: LegacyLayer = {
        id: 'layer1',
        name: 'Test Layer',
        visible: true,
        opacity: 100,
        canvas,
        blendMode: 'normal',
        locked: false,
        mask: maskCanvas,
      };

      const coreLayer = DocumentAdapter.legacyToCore(legacyLayer, 100, 100);

      expect(coreLayer.mask).toBeDefined();
      expect(coreLayer.mask?.enabled).toBe(true);
      expect(coreLayer.mask?.linked).toBe(true);
      expect(coreLayer.mask?.imageData).toBeDefined();
    });

    it('should convert different blend modes', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const blendModes = ['normal', 'multiply', 'screen', 'overlay'] as const;

      blendModes.forEach(blendMode => {
        const legacyLayer: LegacyLayer = {
          id: 'layer1',
          name: 'Test',
          visible: true,
          opacity: 100,
          canvas,
          blendMode,
          locked: false,
        };

        const coreLayer = DocumentAdapter.legacyToCore(legacyLayer, 100, 100);
        expect(coreLayer.blendMode).toBe(blendMode);
      });
    });
  });

  describe('coreToLegacy', () => {
    it('should convert core layer to legacy layer', () => {
      const imageData = new ImageData(100, 100);
      // Fill with green
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 0;     // R
        imageData.data[i + 1] = 255; // G
        imageData.data[i + 2] = 0;   // B
        imageData.data[i + 3] = 255; // A
      }

      const coreLayer = {
        id: 'layer1',
        name: 'Test Layer',
        type: 'raster' as const,
        visible: true,
        opacity: 80,
        blendMode: 'multiply' as const,
        locked: true,
        width: 100,
        height: 100,
        imageData,
      };

      const legacyLayer = DocumentAdapter.coreToLegacy(coreLayer);

      expect(legacyLayer.id).toBe('layer1');
      expect(legacyLayer.name).toBe('Test Layer');
      expect(legacyLayer.visible).toBe(true);
      expect(legacyLayer.opacity).toBe(80);
      expect(legacyLayer.blendMode).toBe('multiply');
      expect(legacyLayer.locked).toBe(true);
      expect(legacyLayer.canvas).toBeDefined();
      expect(legacyLayer.canvas.width).toBe(100);
      expect(legacyLayer.canvas.height).toBe(100);
    });

    it('should convert core layer with mask', () => {
      const imageData = new ImageData(100, 100);
      const maskImageData = new ImageData(100, 100);

      const coreLayer = {
        id: 'layer1',
        name: 'Test Layer',
        type: 'raster' as const,
        visible: true,
        opacity: 100,
        blendMode: 'normal' as const,
        locked: false,
        width: 100,
        height: 100,
        imageData,
        mask: {
          enabled: true,
          linked: true,
          imageData: maskImageData,
        },
      };

      const legacyLayer = DocumentAdapter.coreToLegacy(coreLayer);

      expect(legacyLayer.mask).toBeDefined();
      expect(legacyLayer.mask?.width).toBe(100);
      expect(legacyLayer.mask?.height).toBe(100);
    });
  });

  describe('bidirectional conversion', () => {
    it('should preserve data through legacy -> core -> legacy conversion', () => {
      // Create original legacy layer
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);

      const originalLegacy: LegacyLayer = {
        id: 'layer1',
        name: 'Test Layer',
        visible: true,
        opacity: 75,
        canvas,
        blendMode: 'screen',
        locked: false,
      };

      // Convert to core
      const coreLayer = DocumentAdapter.legacyToCore(originalLegacy, 100, 100);
      
      // Convert back to legacy
      const convertedLegacy = DocumentAdapter.coreToLegacy(coreLayer);

      // Verify all properties preserved
      expect(convertedLegacy.id).toBe(originalLegacy.id);
      expect(convertedLegacy.name).toBe(originalLegacy.name);
      expect(convertedLegacy.visible).toBe(originalLegacy.visible);
      expect(convertedLegacy.opacity).toBe(originalLegacy.opacity);
      expect(convertedLegacy.blendMode).toBe(originalLegacy.blendMode);
      expect(convertedLegacy.locked).toBe(originalLegacy.locked);
      expect(convertedLegacy.canvas.width).toBe(originalLegacy.canvas.width);
      expect(convertedLegacy.canvas.height).toBe(originalLegacy.canvas.height);
    });
  });

  describe('createDocumentFromLegacy', () => {
    it('should create Document from legacy layers', () => {
      const canvas1 = window.document.createElement('canvas');
      canvas1.width = 200;
      canvas1.height = 200;

      const canvas2 = window.document.createElement('canvas');
      canvas2.width = 200;
      canvas2.height = 200;

      const legacyLayers: LegacyLayer[] = [
        {
          id: 'layer1',
          name: 'Background',
          visible: true,
          opacity: 100,
          canvas: canvas1,
          blendMode: 'normal',
          locked: false,
        },
        {
          id: 'layer2',
          name: 'Foreground',
          visible: true,
          opacity: 80,
          canvas: canvas2,
          blendMode: 'multiply',
          locked: false,
        },
      ];

      const doc = DocumentAdapter.createDocumentFromLegacy(
        legacyLayers,
        'layer2',
        200,
        200,
        'Test Document'
      );

      expect(doc).toBeDefined();
      expect(doc.name).toBe('Test Document');
      expect(doc.width).toBe(200);
      expect(doc.height).toBe(200);
      expect(doc.layers.length).toBe(2);
      expect(doc.activeLayerId).toBe('layer2');
    });

    it('should handle empty layers array', () => {
      const doc = DocumentAdapter.createDocumentFromLegacy(
        [],
        null,
        100,
        100,
        'Empty Document'
      );

      expect(doc).toBeDefined();
      expect(doc.layers.length).toBe(0);
      expect(doc.activeLayerId).toBeNull();
    });
  });

  describe('extractLegacyState', () => {
    it('should extract legacy state from Document', () => {
      const imageData = new ImageData(100, 100);
      
      let doc = Doc.create(100, 100, 'Test');
      
      // Create a raster layer with proper type
      const rasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster' as const,
        visible: true,
        opacity: 100,
        blendMode: 'normal' as const,
        locked: false,
        width: 100,
        height: 100,
        imageData,
      };
      
      doc = doc.addLayer(rasterLayer);
      doc = doc.setActiveLayer('layer1');

      const legacyState = DocumentAdapter.extractLegacyState(doc);

      expect(legacyState.layers).toBeDefined();
      expect(legacyState.layers.length).toBe(1);
      expect(legacyState.layers[0].id).toBe('layer1');
      expect(legacyState.layers[0].name).toBe('Layer 1');
      expect(legacyState.activeLayerId).toBe('layer1');
    });
  });

  describe('syncLayerUpdate', () => {
    it('should sync layer update from legacy to core', () => {
      const canvas = window.document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);
      
      let doc = Doc.create(100, 100, 'Test');
      
      // First add a layer to the document
      const imageData = new ImageData(100, 100);
      const rasterLayer = {
        id: 'layer1',
        name: 'Original Name',
        type: 'raster' as const,
        visible: true,
        opacity: 100,
        blendMode: 'normal' as const,
        locked: false,
        width: 100,
        height: 100,
        imageData,
      };
      
      doc = doc.addLayer(rasterLayer);

      const updates: Partial<LegacyLayer> = {
        name: 'Updated Name',
        opacity: 50,
        visible: false,
        canvas,
      };

      const updatedDocument = DocumentAdapter.syncLayerUpdate(
        doc,
        'layer1',
        updates,
        100,
        100
      );

      const updatedLayer = updatedDocument.getLayer('layer1');
      expect(updatedLayer?.name).toBe('Updated Name');
      expect(updatedLayer?.opacity).toBe(50);
      expect(updatedLayer?.visible).toBe(false);
    });

    it('should handle non-existent layer', () => {
      const doc = Doc.create(100, 100, 'Test');
      
      const updates: Partial<LegacyLayer> = {
        name: 'New Name',
      };
      
      const updatedDocument = DocumentAdapter.syncLayerUpdate(
        doc,
        'nonexistent',
        updates,
        100,
        100
      );

      expect(updatedDocument.layers.length).toBe(0);
    });
  });
});
