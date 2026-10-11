import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../core/document';
import { DocumentHistoryManager, AddLayerCommand, RemoveLayerCommand } from '../core/commands';
import { ToolRegistry, ToolManager, ToolContext, ToolContextProvider } from '../core/tools';
import { Selection } from '../core/selection';
import { ViewportImpl } from '../core/rendering';
import { RasterLayer } from '../core/document/DocumentTypes';

describe('EditorContext Integration with Unified Pipeline', () => {
  let document: Document;
  let historyManager: DocumentHistoryManager;
  let toolRegistry: ToolRegistry;
  let toolManager: ToolManager;
  let currentSelection: Selection | null;
  let renderCallCount: number;

  beforeEach(() => {
    // Create initial document
    document = Document.create(100, 100, 'Test');
    
    // Add a layer
    const layer: RasterLayer = {
      id: 'layer1',
      name: 'Layer 1',
      type: 'raster',
      visible: true,
      opacity: 100,
      blendMode: 'normal',
      locked: false,
      width: 100,
      height: 100,
      imageData: new ImageData(100, 100),
    };
    document = document.addLayer(layer);

    historyManager = new DocumentHistoryManager(60);
    toolRegistry = new ToolRegistry();
    currentSelection = null;
    renderCallCount = 0;

    // Create state holders (simulating refs in EditorContext)
    const state = {
      document: document,
      selection: currentSelection,
    };

    // Create tool context provider - returns fresh context on every call
    const contextProvider: ToolContextProvider = () => {
      const context: ToolContext = {
        getDocument: () => state.document,
        setDocument: (doc) => {
          state.document = doc;
          document = doc;
        },
        getActiveLayer: () => {
          const doc = state.document;
          if (!doc) return null;
          return doc.getActiveLayer() ?? null;
        },
        getSelection: () => state.selection,
        setSelection: (sel) => {
          state.selection = sel;
          currentSelection = sel;
        },
        getViewport: () => new ViewportImpl(100, 100),
        executeCommand: (command) => {
          // Use unified pipeline
          const newDocument = historyManager.execute(command, state.document);
          state.document = newDocument;
          document = newDocument;
          renderCallCount++;
        },
        requestRender: () => {
          renderCallCount++;
        },
      };
      return context;
    };

    toolManager = new ToolManager(toolRegistry, contextProvider);
  });

  describe('Unified Command Pipeline', () => {
    it('should execute command and update document state', () => {
      const context = (toolManager as any).getContext();
      const initialDoc = context.getDocument();
      expect(initialDoc.layers.length).toBe(1);

      // Execute command through context
      const newLayer: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const command = new AddLayerCommand(newLayer);
      context.executeCommand(command);

      // Verify document updated
      const currentDoc = context.getDocument();
      expect(currentDoc.layers.length).toBe(2);
      expect(renderCallCount).toBe(1);
    });

    it('should undo command and restore document state', () => {
      const context = (toolManager as any).getContext();
      
      // Execute command
      const newLayer: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const command = new AddLayerCommand(newLayer);
      context.executeCommand(command);
      
      let currentDoc = context.getDocument();
      expect(currentDoc.layers.length).toBe(2);

      // Undo through history manager
      const undoneDoc = historyManager.undo(currentDoc);
      expect(undoneDoc).not.toBeNull();
      
      context.setDocument(undoneDoc);
      currentDoc = context.getDocument();
      expect(currentDoc.layers.length).toBe(1);
    });

    it('should redo command and restore new document state', () => {
      const context = (toolManager as any).getContext();
      
      // Execute command
      const newLayer: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const command = new AddLayerCommand(newLayer);
      context.executeCommand(command);
      
      let currentDoc = context.getDocument();
      
      // Undo
      const undoneDoc = historyManager.undo(currentDoc);
      context.setDocument(undoneDoc);
      
      // Redo
      const redoneDoc = historyManager.redo(undoneDoc!);
      expect(redoneDoc).not.toBeNull();
      
      context.setDocument(redoneDoc);
      currentDoc = context.getDocument();
      expect(currentDoc.layers.length).toBe(2);
    });

    it('should handle sequential commands correctly', () => {
      const context = (toolManager as any).getContext();
      
      // Execute three commands
      for (let i = 2; i <= 4; i++) {
        const newLayer: RasterLayer = {
          id: `layer${i}`,
          name: `Layer ${i}`,
          type: 'raster',
          visible: true,
          opacity: 100,
          blendMode: 'normal',
          locked: false,
          width: 100,
          height: 100,
          imageData: new ImageData(100, 100),
        };

        const command = new AddLayerCommand(newLayer);
        context.executeCommand(command);
      }

      let currentDoc = context.getDocument();
      expect(currentDoc.layers.length).toBe(4);
      expect(renderCallCount).toBe(3);

      // Undo three times
      for (let i = 0; i < 3; i++) {
        const undoneDoc = historyManager.undo(currentDoc);
        expect(undoneDoc).not.toBeNull();
        context.setDocument(undoneDoc);
        currentDoc = context.getDocument();
      }

      expect(currentDoc.layers.length).toBe(1);

      // Redo three times
      for (let i = 0; i < 3; i++) {
        const redoneDoc = historyManager.redo(currentDoc);
        expect(redoneDoc).not.toBeNull();
        context.setDocument(redoneDoc);
        currentDoc = context.getDocument();
      }

      expect(currentDoc.layers.length).toBe(4);
    });

    it('should invalidate redo after new command', () => {
      const context = (toolManager as any).getContext();
      
      // Execute first command
      const layer2: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const command1 = new AddLayerCommand(layer2);
      context.executeCommand(command1);
      
      let currentDoc = context.getDocument();
      expect(historyManager.canRedo()).toBe(false);

      // Undo
      const undoneDoc = historyManager.undo(currentDoc);
      context.setDocument(undoneDoc);
      currentDoc = context.getDocument();
      
      expect(historyManager.canRedo()).toBe(true);

      // Execute new command (should invalidate redo)
      const layer3: RasterLayer = {
        id: 'layer3',
        name: 'Layer 3',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const command2 = new AddLayerCommand(layer3);
      context.executeCommand(command2);
      
      expect(historyManager.canRedo()).toBe(false);
      currentDoc = context.getDocument();
      expect(currentDoc.layers.length).toBe(2);
      expect(currentDoc.getLayer('layer3')).toBeDefined();
    });

    it('should handle failed commands without corrupting state', () => {
      const context = (toolManager as any).getContext();
      
      const initialDoc = context.getDocument();
      const initialLayerCount = initialDoc.layers.length;
      const initialHistorySize = historyManager.getUndoCount();

      // Try to remove non-existent layer
      const command = new RemoveLayerCommand('nonexistent');
      
      expect(() => {
        context.executeCommand(command);
      }).toThrow();

      // Document should be unchanged
      const currentDoc = context.getDocument();
      expect(currentDoc.layers.length).toBe(initialLayerCount);
      
      // History should be unchanged
      expect(historyManager.getUndoCount()).toBe(initialHistorySize);
    });
  });

  describe('Active Layer Preservation', () => {
    it('should preserve valid active layer after layer removal', () => {
      const context = (toolManager as any).getContext();
      
      // Add second layer
      const layer2: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      let doc = context.getDocument();
      const addCmd = new AddLayerCommand(layer2);
      doc = historyManager.execute(addCmd, doc);
      doc = doc.setActiveLayer('layer2');
      context.setDocument(doc);

      // Remove active layer
      const removeCmd = new RemoveLayerCommand('layer2');
      doc = historyManager.execute(removeCmd, doc);
      context.setDocument(doc);

      // Active layer should be valid
      const currentDoc = context.getDocument();
      expect(currentDoc.activeLayerId).toBe('layer1');
      expect(currentDoc.getActiveLayer()).toBeDefined();
    });
  });

  describe('History and Rendering Coordination', () => {
    it('should coordinate command execution with rendering', () => {
      const context = (toolManager as any).getContext();
      expect(renderCallCount).toBe(0);
      expect(historyManager.getUndoCount()).toBe(0);

      // Execute multiple commands
      for (let i = 2; i <= 4; i++) {
        const newLayer: RasterLayer = {
          id: `layer${i}`,
          name: `Layer ${i}`,
          type: 'raster',
          visible: true,
          opacity: 100,
          blendMode: 'normal',
          locked: false,
          width: 100,
          height: 100,
          imageData: new ImageData(100, 100),
        };

        const command = new AddLayerCommand(newLayer);
        context.executeCommand(command);
      }

      expect(historyManager.getUndoCount()).toBe(3);
      expect(renderCallCount).toBe(3);
    });
  });
});
