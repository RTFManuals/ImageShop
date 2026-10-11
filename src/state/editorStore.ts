import { create } from 'zustand';
import { Document } from '../core/document';
import { HistoryManager } from '../core/commands';
import { ToolRegistry, ToolManager } from '../core/tools';
import { Selection } from '../core/selection';
import { ViewportImpl } from '../core/rendering';

interface EditorState {
  // Document
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  
  // History
  historyManager: HistoryManager;
  
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
  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Document
  document: null,
  setDocument: (doc) => set({ document: doc }),
  
  // History
  historyManager: new HistoryManager(60),
  
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
  undo: () => {
    get().historyManager.undo();
  },
  
  redo: () => {
    get().historyManager.redo();
  },
}));
