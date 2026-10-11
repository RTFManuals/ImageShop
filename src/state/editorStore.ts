import { create } from 'zustand';
import { Document } from '../core/document';
import { DocumentHistoryManager, DocumentCommand } from '../core/commands';
import { Selection } from '../core/selection';
import { ViewportImpl } from '../core/rendering';

interface EditorState {
  // Document
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  
  // History
  historyManager: DocumentHistoryManager;
  
  // Tools
  activeToolId: string;
  setActiveTool: (toolId: string) => void;
  
  // Selection
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  
  // Viewport
  viewport: ViewportImpl;
  
  // UI State
  zoom: number;
  setZoom: (zoom: number) => void;
  
  // Actions
  executeCommand: (command: DocumentCommand) => void;
  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Document
  document: null,
  setDocument: (doc) => {
    const { historyManager } = get();
    // If document is set directly (not through executeCommand), invalidate history
    const currentDoc = get().document;
    if (currentDoc && doc && currentDoc !== doc) {
      // Check if this is a result of a command execution
      const expectedDoc = historyManager.getExpectedCurrentDocument();
      if (expectedDoc !== doc) {
        historyManager.invalidate('Direct document replacement');
      }
    }
    set({ document: doc });
  },
  
  // History
  historyManager: new DocumentHistoryManager(60),
  
  // Tools
  activeToolId: 'move',
  setActiveTool: (toolId) => set({ activeToolId: toolId }),
  
  // Selection
  selection: null,
  setSelection: (selection) => set({ selection }),
  
  // Viewport
  viewport: new ViewportImpl(800, 600),
  
  // UI State
  zoom: 1,
  setZoom: (zoom) => {
    set({ zoom });
    get().viewport.setZoom(zoom);
  },
  
  // Actions
  executeCommand: (command) => {
    const { document, historyManager } = get();
    if (!document) {
      console.error('Cannot execute command: no document');
      return;
    }

    try {
      const newDocument = historyManager.execute(command, document);
      set({ document: newDocument });
    } catch (error) {
      console.error('Command execution failed:', error);
      // Don't update state on failure
    }
  },
  
  undo: () => {
    const { document, historyManager } = get();
    if (!document) {
      return;
    }

    try {
      const previousDocument = historyManager.undo(document);
      if (previousDocument) {
        set({ document: previousDocument });
      }
    } catch (error) {
      console.error('Undo failed:', error);
      // Don't update state on failure
    }
  },
  
  redo: () => {
    const { document, historyManager } = get();
    if (!document) {
      return;
    }

    try {
      const nextDocument = historyManager.redo(document);
      if (nextDocument) {
        set({ document: nextDocument });
      }
    } catch (error) {
      console.error('Redo failed:', error);
      // Don't update state on failure
    }
  },
}));
