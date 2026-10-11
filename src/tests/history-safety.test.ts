import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../core/document';
import { DocumentHistoryManager, AddLayerCommand, RemoveLayerCommand, ChangeOpacityCommand } from '../core/commands';
import { RasterLayer } from '../core/document/DocumentTypes';

describe('DocumentHistoryManager Safety', () => {
  let document: Document;
  let historyManager: DocumentHistoryManager;

  const createTestLayer = (id: string, name: string): RasterLayer => ({
    id,
    name,
    type: 'raster',
    visible: true,
    opacity: 100,
    blendMode: 'normal',
    locked: false,
    width: 100,
    height: 100,
    imageData: new ImageData(100, 100),
  });

  beforeEach(() => {
    document = Document.create(100, 100, 'Test Document');
    historyManager = new DocumentHistoryManager(60);
  });

  describe('State Mismatch Rejection', () => {
    it('should reject undo when document state does not match', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const command = new AddLayerCommand(layer1);
      
      // Execute command
      const docAfterExecute = historyManager.execute(command, document);
      
      // Create a different document (simulating external modification)
      const layer2 = createTestLayer('layer2', 'Layer 2');
      const differentDoc = document.addLayer(layer2);
      
      // Try to undo with wrong document - should throw
      expect(() => {
        historyManager.undo(differentDoc);
      }).toThrow('Undo rejected: current document state does not match expected history state');
      
      // History should be preserved
      expect(historyManager.getUndoCount()).toBe(1);
      expect(historyManager.getRedoCount()).toBe(0);
    });

    it('should reject redo when document state does not match', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const command = new AddLayerCommand(layer1);
      
      // Execute and undo
      const docAfterExecute = historyManager.execute(command, document);
      const docAfterUndo = historyManager.undo(docAfterExecute);
      
      // Create a different document
      const layer2 = createTestLayer('layer2', 'Layer 2');
      const differentDoc = document.addLayer(layer2);
      
      // Try to redo with wrong document - should throw
      expect(() => {
        historyManager.redo(differentDoc);
      }).toThrow('Redo rejected: current document state does not match expected history state');
      
      // History should be preserved
      expect(historyManager.getUndoCount()).toBe(0);
      expect(historyManager.getRedoCount()).toBe(1);
    });

    it('should preserve history stacks when operation is rejected', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const layer2 = createTestLayer('layer2', 'Layer 2');
      
      // Execute two commands
      const doc1 = historyManager.execute(new AddLayerCommand(layer1), document);
      const doc2 = historyManager.execute(new AddLayerCommand(layer2), doc1);
      
      expect(historyManager.getUndoCount()).toBe(2);
      
      // Try to undo with wrong document
      const wrongDoc = document.addLayer(createTestLayer('wrong', 'Wrong'));
      
      expect(() => {
        historyManager.undo(wrongDoc);
      }).toThrow();
      
      // History should still have 2 entries
      expect(historyManager.getUndoCount()).toBe(2);
      expect(historyManager.getRedoCount()).toBe(0);
    });
  });

  describe('External Document Replacement', () => {
    it('should provide method to invalidate history', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      historyManager.execute(new AddLayerCommand(layer1), document);
      
      expect(historyManager.getUndoCount()).toBe(1);
      
      // Invalidate history (simulating external document replacement)
      historyManager.invalidate('Test invalidation');
      
      expect(historyManager.getUndoCount()).toBe(0);
      expect(historyManager.getRedoCount()).toBe(0);
    });

    it('should track expected current document', () => {
      expect(historyManager.getExpectedCurrentDocument()).toBeNull();
      
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const doc1 = historyManager.execute(new AddLayerCommand(layer1), document);
      
      expect(historyManager.getExpectedCurrentDocument()).toBe(doc1);
      
      const layer2 = createTestLayer('layer2', 'Layer 2');
      const doc2 = historyManager.execute(new AddLayerCommand(layer2), doc1);
      
      expect(historyManager.getExpectedCurrentDocument()).toBe(doc2);
      
      // After undo
      const docAfterUndo = historyManager.undo(doc2);
      expect(historyManager.getExpectedCurrentDocument()).toBe(docAfterUndo);
    });
  });

  describe('Command Failure Handling', () => {
    it('should not modify history when command fails', () => {
      const initialUndoCount = historyManager.getUndoCount();
      const initialRedoCount = historyManager.getRedoCount();
      
      // Try to remove non-existent layer
      const command = new RemoveLayerCommand('nonexistent');
      
      expect(() => {
        historyManager.execute(command, document);
      }).toThrow();
      
      // History should be unchanged
      expect(historyManager.getUndoCount()).toBe(initialUndoCount);
      expect(historyManager.getRedoCount()).toBe(initialRedoCount);
    });

    it('should not modify document when command fails', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const docWithLayer = document.addLayer(layer1);
      
      const initialLayerCount = docWithLayer.layers.length;
      
      // Try to remove non-existent layer
      const command = new RemoveLayerCommand('nonexistent');
      
      expect(() => {
        historyManager.execute(command, docWithLayer);
      }).toThrow();
      
      // Document should be unchanged
      expect(docWithLayer.layers.length).toBe(initialLayerCount);
    });
  });

  describe('Memory Limitations', () => {
    it('should respect maximum history size', () => {
      const maxSize = 5;
      const limitedHistoryManager = new DocumentHistoryManager(maxSize);
      
      // Execute more commands than the limit
      for (let i = 0; i < 10; i++) {
        const layer = createTestLayer(`layer${i}`, `Layer ${i}`);
        const doc = limitedHistoryManager.getExpectedCurrentDocument() || document;
        limitedHistoryManager.execute(new AddLayerCommand(layer), doc);
      }
      
      // Should only keep the last maxSize entries
      expect(limitedHistoryManager.getUndoCount()).toBe(maxSize);
    });

    it('should document memory limitations', () => {
      // This test documents that each history entry stores full document snapshots
      // For large documents, this can consume significant memory
      // The maxSize parameter limits the number of entries but not the memory per entry
      
      const layer = createTestLayer('layer1', 'Layer 1');
      const doc1 = historyManager.execute(new AddLayerCommand(layer), document);
      
      // Each entry stores documentBefore and documentAfter
      // For a 1000x1000 RGBA image, each snapshot is ~4MB
      // With 60 entries, that's ~480MB of history
      // This is a known limitation that should be addressed in future iterations
      
      expect(historyManager.getUndoCount()).toBe(1);
    });
  });

  describe('Immutable Document Guarantee', () => {
    it('should not mutate original document during execute', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const originalDoc = document;
      const originalLayerCount = originalDoc.layers.length;
      
      const command = new AddLayerCommand(layer1);
      const newDoc = historyManager.execute(command, originalDoc);
      
      // Original document should be unchanged
      expect(originalDoc.layers.length).toBe(originalLayerCount);
      
      // New document should have the layer
      expect(newDoc.layers.length).toBe(originalLayerCount + 1);
    });

    it('should not mutate document during undo', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const doc1 = historyManager.execute(new AddLayerCommand(layer1), document);
      
      const docBeforeUndo = doc1;
      const layerCountBeforeUndo = docBeforeUndo.layers.length;
      
      const docAfterUndo = historyManager.undo(doc1);
      
      // Document passed to undo should be unchanged
      expect(docBeforeUndo.layers.length).toBe(layerCountBeforeUndo);
      
      // Returned document should be different
      expect(docAfterUndo).not.toBe(docBeforeUndo);
      expect(docAfterUndo!.layers.length).toBe(layerCountBeforeUndo - 1);
    });
  });
});
