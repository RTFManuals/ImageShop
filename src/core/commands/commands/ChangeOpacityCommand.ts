import { BaseCommand } from '../Command';
import { Document } from '../../document/Document';

export class ChangeOpacityCommand extends BaseCommand {
  private document: Document;
  private layerId: string;
  private newOpacity: number;
  private oldOpacity: number | null = null;
  private resultDocument: Document | null = null;

  constructor(document: Document, layerId: string, newOpacity: number) {
    super('Change Opacity');
    this.document = document;
    this.layerId = layerId;
    this.newOpacity = Math.max(0, Math.min(100, newOpacity));
  }

  execute(): void {
    const layer = this.document.getLayer(this.layerId);
    if (layer) {
      this.oldOpacity = layer.opacity;
      this.resultDocument = this.document.updateLayer(this.layerId, {
        opacity: this.newOpacity,
      });
    }
  }

  undo(): void {
    if (this.oldOpacity !== null && this.resultDocument) {
      this.resultDocument = this.resultDocument.updateLayer(this.layerId, {
        opacity: this.oldOpacity,
      });
    }
  }

  getResult(): Document | null {
    return this.resultDocument;
  }
}
