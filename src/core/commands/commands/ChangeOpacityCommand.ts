import { BaseDocumentCommand } from '../DocumentCommand';
import { Document } from '../../document/Document';

/**
 * Command to change layer opacity
 */
export class ChangeOpacityCommand extends BaseDocumentCommand {
  private layerId: string;
  private newOpacity: number;
  private previousOpacity: number = -1;

  constructor(layerId: string, newOpacity: number) {
    super(`Change Opacity: ${layerId} to ${newOpacity}%`);
    this.layerId = layerId;
    this.newOpacity = Math.max(0, Math.min(100, newOpacity));
  }

  execute(document: Document): Document {
    const layer = document.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`Layer with id "${this.layerId}" not found`);
    }
    
    // Store previous opacity for undo
    this.previousOpacity = layer.opacity;
    
    return document.updateLayer(this.layerId, { opacity: this.newOpacity });
  }

  undo(document: Document): Document {
    if (this.previousOpacity === -1) {
      throw new Error('Cannot undo: previous opacity not stored');
    }
    
    return document.updateLayer(this.layerId, { opacity: this.previousOpacity });
  }
}
