import { describe, it, expect } from 'vitest';
import { Document } from './Document';

describe('Document', () => {
  it('should create document with dimensions', () => {
    const doc = Document.create(800, 600, 'Test Document');
    expect(doc.width).toBe(800);
    expect(doc.height).toBe(600);
    expect(doc.name).toBe('Test Document');
  });

  it('should have unique id', () => {
    const doc1 = Document.create(800, 600);
    const doc2 = Document.create(800, 600);
    expect(doc1.id).not.toBe(doc2.id);
  });

  it('should start with no layers', () => {
    const doc = Document.create(800, 600);
    expect(doc.layers.length).toBe(0);
    expect(doc.activeLayerId).toBeNull();
  });

  it('should add layer immutably', () => {
    const doc = Document.create(800, 600);
    const layer = {
      id: 'layer1',
      name: 'Layer 1',
      type: 'raster' as const,
      visible: true,
      opacity: 100,
      blendMode: 'normal' as const,
      locked: false,
    };

    const newDoc = doc.addLayer(layer);
    
    // Original document unchanged
    expect(doc.layers.length).toBe(0);
    
    // New document has layer
    expect(newDoc.layers.length).toBe(1);
    expect(newDoc.layers[0].id).toBe('layer1');
  });

  it('should remove layer immutably', () => {
    const layer = {
      id: 'layer1',
      name: 'Layer 1',
      type: 'raster' as const,
      visible: true,
      opacity: 100,
      blendMode: 'normal' as const,
      locked: false,
    };

    const doc = Document.create(800, 600).addLayer(layer);
    const newDoc = doc.removeLayer('layer1');
    
    expect(doc.layers.length).toBe(1);
    expect(newDoc.layers.length).toBe(0);
  });

  it('should update layer immutably', () => {
    const layer = {
      id: 'layer1',
      name: 'Layer 1',
      type: 'raster' as const,
      visible: true,
      opacity: 100,
      blendMode: 'normal' as const,
      locked: false,
    };

    const doc = Document.create(800, 600).addLayer(layer);
    const newDoc = doc.updateLayer('layer1', { opacity: 50 });
    
    expect(doc.layers[0].opacity).toBe(100);
    expect(newDoc.layers[0].opacity).toBe(50);
  });

  it('should get layer by id', () => {
    const layer = {
      id: 'layer1',
      name: 'Layer 1',
      type: 'raster' as const,
      visible: true,
      opacity: 100,
      blendMode: 'normal' as const,
      locked: false,
    };

    const doc = Document.create(800, 600).addLayer(layer);
    const found = doc.getLayer('layer1');
    
    expect(found).toBeDefined();
    expect(found?.name).toBe('Layer 1');
  });

  it('should serialize to JSON', () => {
    const doc = Document.create(800, 600, 'Test');
    const json = doc.toJSON();
    
    expect(json.id).toBe(doc.id);
    expect(json.name).toBe('Test');
    expect(json.width).toBe(800);
    expect(json.height).toBe(600);
  });

  it('should deserialize from JSON', () => {
    const doc = Document.create(800, 600, 'Test');
    const json = doc.toJSON();
    const restored = Document.fromJSON(json);
    
    expect(restored.id).toBe(doc.id);
    expect(restored.name).toBe(doc.name);
    expect(restored.width).toBe(doc.width);
    expect(restored.height).toBe(doc.height);
  });
});
