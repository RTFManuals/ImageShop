import { BaseDocumentCommand } from '../DocumentCommand';
import { Document } from '../../document/Document';
import { Layer } from '../../document/DocumentTypes';

/**
 * Command to add a layer to the document
 */
export class AddLayerCommand extends BaseDocumentCommand {
  private layer: Layer;

  constructor(layer: Layer) {
    super(`Add Layer: ${layer.name}`);
    this.layer = layer;
  }

  execute(document: Document): Document {
    return document.addLayer(this.layer);
  }

  undo(document: Document): Document {
    return document.removeLayer(this.layer.id);
  }
}
