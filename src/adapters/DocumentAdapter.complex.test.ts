import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentAdapter } from './DocumentAdapter';
import { Document } from '../core/document';
import { Layer as LegacyLayer } from '../types';

describe('DocumentAdapter - Complex Documents', () => {
  describe('Round-trip conversion', () => {
    it('should preserve all layer properties through round-trip', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);

      const originalLegacy: LegacyLayer = {
        id: 'layer1',
        name: 'Test Layer',
        visible: false,
        opacity: 75,
        canvas,
        blendMode: 'multiply',
        locked: true,
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
    });

    it('should preserve mask through round-trip', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = 100;
      maskCanvas.height = 100;
      const maskCtx = maskCanvas.getContext('2d')!;
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(0, 0, 100, 100);

      const originalLegacy: LegacyLayer = {
        id: 'layer1',
        name: 'Layer with Mask',
        visible: true,
        opacity: 100,
        canvas,
        blendMode: 'normal',
        locked: false,
        mask: maskCanvas,
      };

      // Convert to core
      const coreLayer = DocumentAdapter.legacyToCore(originalLegacy, 100, 100);
      expect(coreLayer.mask).toBeDefined();
      
      // Convert back to legacy
      const convertedLegacy = DocumentAdapter.coreToLegacy(coreLayer);
      expect(convertedLegacy.mask).toBeDefined();
      expect(convertedLegacy.mask?.width).toBe(100);
      expect(convertedLegacy.mask?.height).toBe(100);
    });

    it('should handle multiple layers with different properties', () => {
      const createLayer = (id: string, name: string, opacity: number, blendMode: string): LegacyLayer => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        return {
          id,
          name,
          visible: true,
          opacity,
          canvas,
          blendMode,
          locked: false,
        };
      };

      const legacyLayers: LegacyLayer[] = [
        createLayer('layer1', 'Background', 100, 'normal'),
        createLayer('layer2', 'Foreground', 80, 'multiply'),
        createLayer('layer3', 'Overlay', 50, 'screen'),
      ];

      // Convert to core
      const coreLayers = DocumentAdapter.legacyLayersToCore(legacyLayers, 100, 100);
      expect(coreLayers.length).toBe(3);
      
      // Convert back to legacy
      const convertedLayers = DocumentAdapter.coreLayersToLegacy(coreLayers);
      expect(convertedLayers.length).toBe(3);

      // Verify all layers preserved
      expect(convertedLayers[0].id).toBe('layer1');
      expect(convertedLayers[0].opacity).toBe(100);
      expect(convertedLayers[0].blendMode).toBe('normal');
      
      expect(convertedLayers[1].id).toBe('layer2');
      expect(convertedLayers[1].opacity).toBe(80);
      expect(convertedLayers[1].blendMode).toBe('multiply');
      
      expect(convertedLayers[2].id).toBe('layer3');
      expect(convertedLayers[2].opacity).toBe(50);
      expect(convertedLayers[2].blendMode).toBe('screen');
    });
  });

  describe('Unsupported features handling', () => {
    it('should warn about clippingMask field', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const legacyLayer: LegacyLayer = {
        id: 'layer1',
        name: 'Layer with Clipping Mask',
        visible: true,
        opacity: 100,
        canvas,
        blendMode: 'normal',
        locked: false,
        clippingMask: true,
      };

      // Should not throw, but should warn
      const consoleSpy = vi.spyOn(console, 'warn');
      const coreLayer = DocumentAdapter.legacyToCore(legacyLayer, 100, 100);
      
      expect(consoleSpy).toHaveBeenCalledWith('clippingMask field not yet supported in core Layer model');
      expect(coreLayer).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should warn about groupId field', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const legacyLayer: LegacyLayer = {
        id: 'layer1',
        name: 'Layer in Group',
        visible: true,
        opacity: 100,
        canvas,
        blendMode: 'normal',
        locked: false,
        groupId: 'group1',
      };

      // Should not throw, but should warn
      const consoleSpy = vi.spyOn(console, 'warn');
      const coreLayer = DocumentAdapter.legacyToCore(legacyLayer, 100, 100);
      
      expect(consoleSpy).toHaveBeenCalledWith('groupId field not yet supported in core Layer model');
      expect(coreLayer).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should handle layer with both unsupported fields', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const legacyLayer: LegacyLayer = {
        id: 'layer1',
        name: 'Complex Layer',
        visible: true,
        opacity: 100,
        canvas,
        blendMode: 'normal',
        locked: false,
        clippingMask: true,
        groupId: 'group1',
      };

      const consoleSpy = vi.spyOn(console, 'warn');
      const coreLayer = DocumentAdapter.legacyToCore(legacyLayer, 100, 100);
      
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(coreLayer).toBeDefined();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Document creation from legacy state', () => {
    it('should create document with correct active layer', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const legacyLayers: LegacyLayer[] = [
        {
          id: 'layer1',
          name: 'Layer 1',
          visible: true,
          opacity: 100,
          canvas,
          blendMode: 'normal',
          locked: false,
        },
        {
          id: 'layer2',
          name: 'Layer 2',
          visible: true,
          opacity: 100,
          canvas,
          blendMode: 'normal',
          locked: false,
        },
      ];

      const doc = DocumentAdapter.createDocumentFromLegacy(
        legacyLayers,
        'layer2',
        100,
        100,
        'Test Document'
      );

      expect(doc.activeLayerId).toBe('layer2');
      expect(doc.layers.length).toBe(2);
    });

    it('should handle null active layer ID', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const legacyLayers: LegacyLayer[] = [
        {
          id: 'layer1',
          name: 'Layer 1',
          visible: true,
          opacity: 100,
          canvas,
          blendMode: 'normal',
          locked: false,
        },
      ];

      const doc = DocumentAdapter.createDocumentFromLegacy(
        legacyLayers,
        null,
        100,
        100,
        'Test Document'
      );

      expect(doc.activeLayerId).toBeNull();
    });

    it('should preserve layer order', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const legacyLayers: LegacyLayer[] = [
        {
          id: 'layer1',
          name: 'First',
          visible: true,
          opacity: 100,
          canvas,
          blendMode: 'normal',
          locked: false,
        },
        {
          id: 'layer2',
          name: 'Second',
          visible: true,
          opacity: 100,
          canvas,
          blendMode: 'normal',
          locked: false,
        },
        {
          id: 'layer3',
          name: 'Third',
          visible: true,
          opacity: 100,
          canvas,
          blendMode: 'normal',
          locked: false,
        },
      ];

      const doc = DocumentAdapter.createDocumentFromLegacy(
        legacyLayers,
        'layer1',
        100,
        100,
        'Test Document'
      );

      expect(doc.layers[0].id).toBe('layer1');
      expect(doc.layers[1].id).toBe('layer2');
      expect(doc.layers[2].id).toBe('layer3');
    });
  });

  describe('State extraction', () => {
    it('should extract complete state from document', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const legacyLayers: LegacyLayer[] = [
        {
          id: 'layer1',
          name: 'Layer 1',
          visible: true,
          opacity: 80,
          canvas,
          blendMode: 'multiply',
          locked: true,
        },
      ];

      const doc = DocumentAdapter.createDocumentFromLegacy(
        legacyLayers,
        'layer1',
        100,
        100,
        'Test Document'
      );

      const extractedState = DocumentAdapter.extractLegacyState(doc);

      expect(extractedState.layers.length).toBe(1);
      expect(extractedState.layers[0].id).toBe('layer1');
      expect(extractedState.layers[0].name).toBe('Layer 1');
      expect(extractedState.layers[0].opacity).toBe(80);
      expect(extractedState.layers[0].blendMode).toBe('multiply');
      expect(extractedState.layers[0].locked).toBe(true);
      expect(extractedState.activeLayerId).toBe('layer1');
    });

    it('should handle document with no layers', () => {
      const doc = DocumentAdapter.createDocumentFromLegacy(
        [],
        null,
        100,
        100,
        'Empty Document'
      );

      const extractedState = DocumentAdapter.extractLegacyState(doc);

      expect(extractedState.layers.length).toBe(0);
      expect(extractedState.activeLayerId).toBeNull();
    });
  });
});
