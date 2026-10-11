import { create } from 'zustand';
import { Document } from '../core/document';
import { DocumentHistoryManager, DocumentCommand } from '../core/commands';
import { ToolRegistry, ToolManager } from '../core/tools';
import { Selection } from '../core/selection';
import { ViewportImpl } from '../core/rendering';

interface EditorState {
  // Document
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  
  // History
  historyManager: DocumentHistoryManager;
  
  // Tools
  toolRegistry: ToolRegistry;
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
  setDocument: (doc) => set({ document: doc }),
  
  // History
  historyManager: new DocumentHistoryManager(60),
  
  // Tools
  toolRegistry: new ToolRegistry(),
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
    }
  },
  
  undo: () => {
    const { document, historyManager } = get();
    if (!document) {
      return;
    }

    const previousDocument = historyManager.undo(document);
    if (previousDocument) {
      set({ document: previousDocument });
    }
  },
  
  redo: () => {
    const { document, historyManager } = get();
    if (!document) {
      return;
    }

    const nextDocument = historyManager.redo(document);
    if (nextDocument) {
      set({ document: nextDocument });
    }
  },
}));
