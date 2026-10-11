import { BaseCommand } from '../Command';
import { Document } from '../../document/Document';
import { Layer } from '../../document/DocumentTypes';

export class RemoveLayerCommand extends BaseCommand {
  private document: Document;
  private layerId: string;
  private removedLayer: Layer | null = null;
  private resultDocument: Document | null = null;

  constructor(document: Document, layerId: string) {
    super('Remove Layer');
    this.document = document;
    this.layerId = layerId;
  }

  execute(): void {
    this.removedLayer = this.document.getLayer(this.layerId) || null;
    this.resultDocument = this.document.removeLayer(this.layerId);
  }

  undo(): void {
    if (this.removedLayer && this.resultDocument) {
      this.resultDocument = this.resultDocument.addLayer(this.removedLayer);
    }
  }

  getResult(): Document | null {
    return this.resultDocument;
  }

  getRemovedLayer(): Layer | null {
    return this.removedLayer;
  }
}
