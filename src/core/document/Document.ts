import { EditorDocument, Layer, RasterLayer, DocumentMetadata } from './DocumentTypes';

export class Document {
  private _document: EditorDocument;

  constructor(document: EditorDocument) {
    this._document = document;
  }

  // Getters
  get id(): string {
    return this._document.id;
  }

  get name(): string {
    return this._document.name;
  }

  get width(): number {
    return this._document.width;
  }

  get height(): number {
    return this._document.height;
  }

  get layers(): readonly Layer[] {
    return this._document.layers;
  }

  get activeLayerId(): string | null {
    return this._document.activeLayerId;
  }

  get metadata(): DocumentMetadata {
    return this._document.metadata;
  }

  // Immutable operations - return new Document instances
  setName(name: string): Document {
    return new Document({
      ...this._document,
      name,
      metadata: {
        ...this._document.metadata,
        modifiedAt: new Date().toISOString(),
      },
    });
  }

  addLayer(layer: Layer): Document {
    return new Document({
      ...this._document,
      layers: [...this._document.layers, layer],
      metadata: {
        ...this._document.metadata,
        modifiedAt: new Date().toISOString(),
      },
    });
  }

  removeLayer(layerId: string): Document {
    return new Document({
      ...this._document,
      layers: this._document.layers.filter(l => l.id !== layerId),
      activeLayerId: this._document.activeLayerId === layerId 
        ? (this._document.layers[0]?.id || null)
        : this._document.activeLayerId,
      metadata: {
        ...this._document.metadata,
        modifiedAt: new Date().toISOString(),
      },
    });
  }

  updateLayer(layerId: string, updates: Partial<Layer>): Document {
    return new Document({
      ...this._document,
      layers: this._document.layers.map(layer =>
        layer.id === layerId ? { ...layer, ...updates } : layer
      ),
      metadata: {
        ...this._document.metadata,
        modifiedAt: new Date().toISOString(),
      },
    });
  }

  reorderLayers(layerIds: string[]): Document {
    const layerMap = new Map(this._document.layers.map(l => [l.id, l]));
    const reorderedLayers = layerIds
      .map(id => layerMap.get(id))
      .filter((l): l is Layer => l !== undefined);

    return new Document({
      ...this._document,
      layers: reorderedLayers,
      metadata: {
        ...this._document.metadata,
        modifiedAt: new Date().toISOString(),
      },
    });
  }

  setActiveLayer(layerId: string | null): Document {
    return new Document({
      ...this._document,
      activeLayerId: layerId,
    });
  }

  getLayer(layerId: string): Layer | undefined {
    return this._document.layers.find(l => l.id === layerId);
  }

  getActiveLayer(): Layer | undefined {
    if (!this._document.activeLayerId) return undefined;
    return this.getLayer(this._document.activeLayerId);
  }

  getLayerIndex(layerId: string): number {
    return this._document.layers.findIndex(l => l.id === layerId);
  }

  // Serialization
  toJSON(): EditorDocument {
    return { ...this._document };
  }

  static fromJSON(json: EditorDocument): Document {
    return new Document(json);
  }

  // Factory methods
  static create(width: number, height: number, name: string = 'Untitled'): Document {
    const id = crypto.randomUUID();
    const metadata: DocumentMetadata = {
      id,
      name,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      colorSpace: 'sRGB',
      dpi: 72,
    };

    const document: EditorDocument = {
      id,
      name,
      width,
      height,
      layers: [],
      activeLayerId: null,
      metadata,
      schemaVersion: '1.0',
    };

    return new Document(document);
  }
}
