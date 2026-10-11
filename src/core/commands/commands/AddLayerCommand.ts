import { BaseCommand } from '../Command';
import { Document } from '../../document/Document';
import { Layer } from '../../document/DocumentTypes';

export class AddLayerCommand extends BaseCommand {
  private document: Document;
  private layer: Layer;
  private resultDocument: Document | null = null;

  constructor(document: Document, layer: Layer) {
    super('Add Layer');
    this.document = document;
    this.layer = layer;
  }

  execute(): void {
    this.resultDocument = this.document.addLayer(this.layer);
  }

  undo(): void {
    this.resultDocument = this.document.removeLayer(this.layer.id);
  }

  getResult(): Document | null {
    return this.resultDocument;
  }
}
