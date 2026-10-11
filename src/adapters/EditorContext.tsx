import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { Document } from '../core/document';
import { DocumentHistoryManager, DocumentCommand } from '../core/commands';
import { ToolRegistry, ToolManager, ToolContext, ToolContextProvider } from '../core/tools';
import { Selection } from '../core/selection';
import { ViewportImpl } from '../core/rendering';
import { MoveTool } from '../tools/move';
import { BrushTool } from '../tools/brush';
import { EraserTool } from '../tools/eraser';
import { EyedropperTool } from '../tools/eyedropper';
import { RectangularMarqueeTool } from '../tools/selection/RectangularMarqueeTool';
import { EllipticalMarqueeTool } from '../tools/selection/EllipticalMarqueeTool';
import { LassoTool } from '../tools/selection/LassoTool';
import { MagicWandTool } from '../tools/selection/MagicWandTool';
import { MaskPaintTool } from '../tools/mask';
import { SpotHealingBrushTool, CloneStampTool } from '../tools/retouch';

interface EditorContextValue {
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  historyManager: DocumentHistoryManager;
  toolRegistry: ToolRegistry;
  toolManager: ToolManager;
  activeToolId: string;
  setActiveTool: (toolId: string) => void;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  viewport: ViewportImpl;
  zoom: number;
  setZoom: (zoom: number) => void;
  executeCommand: (command: DocumentCommand) => void;
  undo: () => void;
  redo: () => void;
  renderTrigger: number;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
}

interface EditorProviderProps {
  children: React.ReactNode;
  initialDocument?: Document | null;
}

export function EditorProvider({ children, initialDocument = null }: EditorProviderProps) {
  const [document, setDocumentState] = useState<Document | null>(initialDocument);
  const [activeToolId, setActiveToolId] = useState<string>('move');
  const [selection, setSelectionState] = useState<Selection | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [renderTrigger, setRenderTrigger] = useState(0);

  const historyManagerRef = useRef(new DocumentHistoryManager(60));
  const toolRegistryRef = useRef(new ToolRegistry());
  const viewportRef = useRef(new ViewportImpl(800, 600));
  
  // Synchronous refs - updated immediately, not via useEffect
  const documentRef = useRef(document);
  const selectionRef = useRef(selection);
  
  // Update refs synchronously during render (before useEffect)
  documentRef.current = document;
  selectionRef.current = selection;

  // Wrapper functions that update both state and refs synchronously
  const setDocument = useCallback((doc: Document | null) => {
    documentRef.current = doc;
    setDocumentState(doc);
  }, []);

  const setSelection = useCallback((sel: Selection | null) => {
    selectionRef.current = sel;
    setSelectionState(sel);
  }, []);

  // Initialize tools
  useEffect(() => {
    const registry = toolRegistryRef.current;
    
    // Register all tools
    registry.register(new MoveTool());
    registry.register(new BrushTool());
    registry.register(new EraserTool());
    registry.register(new EyedropperTool());
    registry.register(new RectangularMarqueeTool());
    registry.register(new EllipticalMarqueeTool());
    registry.register(new LassoTool());
    registry.register(new MagicWandTool());
    registry.register(new MaskPaintTool());
    registry.register(new SpotHealingBrushTool());
    registry.register(new CloneStampTool());

    console.log('✅ Tools registered:', registry.getAll().map(t => t.id));
  }, []);

  // Execute command through unified pipeline
  const executeCommand = useCallback((command: DocumentCommand) => {
    const currentDoc = documentRef.current;
    if (!currentDoc) {
      console.error('Cannot execute command: no document');
      return;
    }

    try {
      // Execute command through history manager
      const newDocument = historyManagerRef.current.execute(command, currentDoc);
      
      // Update document state
      setDocument(newDocument);
      
      // Trigger render
      setRenderTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Command execution failed:', error);
      // Don't update state or trigger render on failure
    }
  }, [setDocument]);

  // Undo last command
  const undo = useCallback(() => {
    const currentDoc = documentRef.current;
    if (!currentDoc) {
      return;
    }

    const previousDocument = historyManagerRef.current.undo(currentDoc);
    if (previousDocument) {
      setDocument(previousDocument);
      setRenderTrigger(prev => prev + 1);
    }
  }, [setDocument]);

  // Redo last undone command
  const redo = useCallback(() => {
    const currentDoc = documentRef.current;
    if (!currentDoc) {
      return;
    }

    const nextDocument = historyManagerRef.current.redo(currentDoc);
    if (nextDocument) {
      setDocument(nextDocument);
      setRenderTrigger(prev => prev + 1);
    }
  }, [setDocument]);

  // Create tool context provider - returns fresh context on every call
  const getToolContext = useCallback((): ToolContext => {
    return {
      getDocument: () => documentRef.current,
      setDocument: (doc) => setDocument(doc),
      getActiveLayer: () => {
        const doc = documentRef.current;
        if (!doc) return null;
        return doc.getActiveLayer() ?? null;
      },
      getSelection: () => selectionRef.current,
      setSelection: (sel) => setSelection(sel),
      getViewport: () => viewportRef.current,
      executeCommand: (command: DocumentCommand) => executeCommand(command),
      requestRender: () => {
        // Trigger re-render for visual updates
        setRenderTrigger(prev => prev + 1);
      },
    };
  }, [setDocument, setSelection, executeCommand]);

  // Create ToolManager once with the context provider
  const toolManagerRef = useRef<ToolManager | null>(null);
  if (!toolManagerRef.current) {
    toolManagerRef.current = new ToolManager(toolRegistryRef.current, getToolContext);
  }
  
  // Update context provider on every render to ensure fresh state access
  toolManagerRef.current.updateContextProvider(getToolContext);

  // Sync active tool
  useEffect(() => {
    toolManagerRef.current?.setActiveTool(activeToolId);
  }, [activeToolId]);

  const value: EditorContextValue = {
    document,
    setDocument,
    historyManager: historyManagerRef.current,
    toolRegistry: toolRegistryRef.current,
    toolManager: toolManagerRef.current!,
    activeToolId,
    setActiveTool: setActiveToolId,
    selection,
    setSelection,
    viewport: viewportRef.current,
    zoom,
    setZoom,
    executeCommand,
    undo,
    redo,
    renderTrigger,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}
