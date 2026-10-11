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
    // Validate layer ID uniqueness
    if (this._document.layers.some(l => l.id === layer.id)) {
      throw new Error(`Layer with id "${layer.id}" already exists`);
    }
    
    // Validate layer ID is not empty
    if (!layer.id || layer.id.trim() === '') {
      throw new Error('Layer ID cannot be empty');
    }

    const newDocument: EditorDocument = {
      ...this._document,
      layers: [...this._document.layers, layer],
      metadata: {
        ...this._document.metadata,
        modifiedAt: new Date().toISOString(),
      },
    };

    // If this is the first layer, set it as active
    if (newDocument.layers.length === 1) {
      newDocument.activeLayerId = layer.id;
    }

    return new Document(newDocument);
  }

  removeLayer(layerId: string): Document {
    // Validate layer exists
    const layerIndex = this._document.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) {
      throw new Error(`Layer with id "${layerId}" not found`);
    }

    const remainingLayers = this._document.layers.filter(l => l.id !== layerId);
    
    // Determine new active layer
    let newActiveLayerId = this._document.activeLayerId;
    if (this._document.activeLayerId === layerId) {
      // If removing active layer, select adjacent layer or first available
      if (remainingLayers.length === 0) {
        newActiveLayerId = null;
      } else if (layerIndex > 0) {
        // Select previous layer
        newActiveLayerId = remainingLayers[layerIndex - 1].id;
      } else {
        // Select first layer
        newActiveLayerId = remainingLayers[0].id;
      }
    }

    // Validate active layer still exists
    if (newActiveLayerId && !remainingLayers.some(l => l.id === newActiveLayerId)) {
      newActiveLayerId = remainingLayers.length > 0 ? remainingLayers[0].id : null;
    }

    return new Document({
      ...this._document,
      layers: remainingLayers,
      activeLayerId: newActiveLayerId,
      metadata: {
        ...this._document.metadata,
        modifiedAt: new Date().toISOString(),
      },
    });
  }

  updateLayer(layerId: string, updates: Partial<Layer>): Document {
    // Validate layer exists
    if (!this._document.layers.some(l => l.id === layerId)) {
      throw new Error(`Layer with id "${layerId}" not found`);
    }

    // Prevent changing immutable properties
    if ('id' in updates && updates.id !== layerId) {
      throw new Error('Cannot change layer ID through updateLayer');
    }
    if ('type' in updates) {
      throw new Error('Cannot change layer type through updateLayer');
    }

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
    // Validate all layer IDs exist
    const layerMap = new Map(this._document.layers.map(l => [l.id, l]));
    
    for (const id of layerIds) {
      if (!layerMap.has(id)) {
        throw new Error(`Layer with id "${id}" not found`);
      }
    }

    // Validate no layers are lost
    if (layerIds.length !== this._document.layers.length) {
      throw new Error(`Reorder must include all layers. Expected ${this._document.layers.length}, got ${layerIds.length}`);
    }

    // Validate no duplicates
    const uniqueIds = new Set(layerIds);
    if (uniqueIds.size !== layerIds.length) {
      throw new Error('Reorder contains duplicate layer IDs');
    }

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
    // Validate layer exists if not null
    if (layerId !== null && !this._document.layers.some(l => l.id === layerId)) {
      throw new Error(`Layer with id "${layerId}" not found`);
    }

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

  resize(width: number, height: number): Document {
    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error('Document dimensions must be positive');
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error('Document dimensions must be integers');
    }
    if (width > 100000 || height > 100000) {
      throw new Error('Document dimensions too large (max 100000x100000)');
    }

    return new Document({
      ...this._document,
      width,
      height,
      metadata: {
        ...this._document.metadata,
        modifiedAt: new Date().toISOString(),
      },
    });
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
    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error('Document dimensions must be positive');
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error('Document dimensions must be integers');
    }
    if (width > 100000 || height > 100000) {
      throw new Error('Document dimensions too large (max 100000x100000)');
    }

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
