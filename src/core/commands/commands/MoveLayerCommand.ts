import { BaseDocumentCommand } from '../DocumentCommand';
import { Document } from '../../document/Document';
import { LayerTransform } from '../../document/DocumentTypes';

/**
 * Command to move/transform a layer
 */
export class MoveLayerCommand extends BaseDocumentCommand {
  private layerId: string;
  private newTransform: Partial<LayerTransform>;
  private previousTransform: LayerTransform | null = null;

  constructor(layerId: string, newTransform: Partial<LayerTransform>) {
    super(`Move Layer: ${layerId}`);
    this.layerId = layerId;
    this.newTransform = newTransform;
  }

  execute(document: Document): Document {
    const layer = document.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`Layer with id "${this.layerId}" not found`);
    }
    
    // Store previous transform for undo
    this.previousTransform = layer.transform || {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
    };
    
    // Merge new transform with existing
    const mergedTransform = {
      ...this.previousTransform,
      ...this.newTransform,
    };
    
    return document.updateLayer(this.layerId, { transform: mergedTransform });
  }

  undo(document: Document): Document {
    if (!this.previousTransform) {
      throw new Error('Cannot undo: previous transform not stored');
    }
    
    return document.updateLayer(this.layerId, { transform: this.previousTransform });
  }
}
