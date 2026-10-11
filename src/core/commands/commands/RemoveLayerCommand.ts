import { BaseDocumentCommand } from '../DocumentCommand';
import { Document } from '../../document/Document';
import { Layer, RasterLayer } from '../../document/DocumentTypes';

/**
 * Command to remove a layer from the document
 * Stores the removed layer for proper undo
 */
export class RemoveLayerCommand extends BaseDocumentCommand {
  private layerId: string;
  private removedLayer: Layer | null = null;
  private removedLayerIndex: number = -1;
  private previousActiveLayerId: string | null = null;

  constructor(layerId: string) {
    super(`Remove Layer: ${layerId}`);
    this.layerId = layerId;
  }

  execute(document: Document): Document {
    // Store layer info for undo
    const layer = document.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`Layer with id "${this.layerId}" not found`);
    }
    
    this.removedLayer = layer;
    this.removedLayerIndex = document.getLayerIndex(this.layerId);
    this.previousActiveLayerId = document.activeLayerId;
    
    return document.removeLayer(this.layerId);
  }

  undo(document: Document): Document {
    if (!this.removedLayer) {
      throw new Error('Cannot undo: removed layer not stored');
    }

    // Add the layer back
    let newDocument = document.addLayer(this.removedLayer);
    
    // Restore active layer if it was the removed layer
    if (this.previousActiveLayerId === this.layerId) {
      newDocument = newDocument.setActiveLayer(this.layerId);
    }
    
    return newDocument;
  }
}
