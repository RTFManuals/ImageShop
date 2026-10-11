import { Document } from '../core/document';
import { Layer as CoreLayer, RasterLayer as CoreRasterLayer, BlendMode } from '../core/document/DocumentTypes';
import { Layer as LegacyLayer } from '../types';

/**
 * DocumentAdapter provides bidirectional conversion between legacy App.tsx Layer format
 * and new core Document Layer format.
 * 
 * This adapter enables gradual migration by allowing both systems to coexist.
 */
export class DocumentAdapter {
  /**
   * Convert legacy layer to core layer format
   */
  static legacyToCore(legacyLayer: LegacyLayer, canvasWidth: number, canvasHeight: number): CoreRasterLayer {
    const ctx = legacyLayer.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get context from legacy layer canvas');
    }

    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

    // Convert blendMode string to BlendMode type
    const blendMode = legacyLayer.blendMode as BlendMode;

    const coreLayer: CoreRasterLayer = {
      id: legacyLayer.id,
      name: legacyLayer.name,
      type: 'raster',
      visible: legacyLayer.visible,
      opacity: legacyLayer.opacity,
      blendMode,
      locked: legacyLayer.locked,
      width: canvasWidth,
      height: canvasHeight,
      imageData,
    };

    // Convert mask if exists
    if (legacyLayer.mask) {
      const maskCtx = legacyLayer.mask.getContext('2d');
      if (maskCtx) {
        const maskImageData = maskCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        coreLayer.mask = {
          enabled: true,
          linked: true,
          imageData: maskImageData,
        };
      }
    }

    // Preserve clippingMask and groupId
    if (legacyLayer.clippingMask !== undefined) {
      coreLayer.clippingMask = legacyLayer.clippingMask;
    }
    if (legacyLayer.groupId !== undefined) {
      coreLayer.groupId = legacyLayer.groupId;
    }

    return coreLayer;
  }

  /**
   * Convert core layer to legacy layer format
   */
  static coreToLegacy(coreLayer: CoreRasterLayer): LegacyLayer {
    const canvas = document.createElement('canvas');
    canvas.width = coreLayer.width;
    canvas.height = coreLayer.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Cannot create canvas context');
    }

    ctx.putImageData(coreLayer.imageData, 0, 0);

    const legacyLayer: LegacyLayer = {
      id: coreLayer.id,
      name: coreLayer.name,
      visible: coreLayer.visible,
      opacity: coreLayer.opacity,
      canvas,
      blendMode: coreLayer.blendMode,
      locked: coreLayer.locked,
    };

    // Convert mask if exists
    if (coreLayer.mask) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = coreLayer.width;
      maskCanvas.height = coreLayer.height;
      const maskCtx = maskCanvas.getContext('2d');
      
      if (maskCtx) {
        maskCtx.putImageData(coreLayer.mask.imageData, 0, 0);
        legacyLayer.mask = maskCanvas;
      }
    }

    // Preserve clippingMask and groupId
    if (coreLayer.clippingMask !== undefined) {
      legacyLayer.clippingMask = coreLayer.clippingMask;
    }
    if (coreLayer.groupId !== undefined) {
      legacyLayer.groupId = coreLayer.groupId;
    }

    return legacyLayer;
  }

  /**
   * Convert array of legacy layers to core layers
   */
  static legacyLayersToCore(
    legacyLayers: LegacyLayer[],
    canvasWidth: number,
    canvasHeight: number
  ): CoreRasterLayer[] {
    return legacyLayers.map(layer => 
      DocumentAdapter.legacyToCore(layer, canvasWidth, canvasHeight)
    );
  }

  /**
   * Convert array of core layers to legacy layers
   */
  static coreLayersToLegacy(coreLayers: CoreRasterLayer[]): LegacyLayer[] {
    return coreLayers.map(layer => DocumentAdapter.coreToLegacy(layer));
  }

  /**
   * Create a Document from legacy state
   */
  static createDocumentFromLegacy(
    legacyLayers: LegacyLayer[],
    activeLayerId: string | null,
    canvasWidth: number,
    canvasHeight: number,
    documentName: string = 'Untitled'
  ): Document {
    const coreLayers = DocumentAdapter.legacyLayersToCore(legacyLayers, canvasWidth, canvasHeight);
    
    let document = Document.create(canvasWidth, canvasHeight, documentName);
    
    // Add all layers
    for (const layer of coreLayers) {
      document = document.addLayer(layer);
    }
    
    // Set active layer
    if (activeLayerId) {
      document = document.setActiveLayer(activeLayerId);
    }
    
    return document;
  }

  /**
   * Extract legacy state from Document
   */
  static extractLegacyState(document: Document): {
    layers: LegacyLayer[];
    activeLayerId: string | null;
  } {
    const coreLayers = document.layers.filter(
      (l): l is CoreRasterLayer => l.type === 'raster'
    );
    const legacyLayers = DocumentAdapter.coreLayersToLegacy(coreLayers);
    
    return {
      layers: legacyLayers,
      activeLayerId: document.activeLayerId,
    };
  }

  /**
   * Sync a single layer update from legacy to core
   */
  static syncLayerUpdate(
    document: Document,
    layerId: string,
    updates: Partial<LegacyLayer>,
    canvasWidth: number,
    canvasHeight: number
  ): Document {
    const existingLayer = document.getLayer(layerId);
    if (!existingLayer || existingLayer.type !== 'raster') {
      return document;
    }

    // Convert updates to core format
    const coreUpdates: Partial<CoreRasterLayer> = {};
    
    if (updates.name !== undefined) coreUpdates.name = updates.name;
    if (updates.visible !== undefined) coreUpdates.visible = updates.visible;
    if (updates.opacity !== undefined) coreUpdates.opacity = updates.opacity;
    if (updates.blendMode !== undefined) coreUpdates.blendMode = updates.blendMode as BlendMode;
    if (updates.locked !== undefined) coreUpdates.locked = updates.locked;
    
    // Handle canvas update
    if (updates.canvas) {
      const ctx = updates.canvas.getContext('2d');
      if (ctx) {
        coreUpdates.imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      }
    }

    return document.updateLayer(layerId, coreUpdates);
  }
}
