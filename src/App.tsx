import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, Layer, HistoryState, BLEND_MODES, FONTS, TransformState } from './types';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function cloneLayer(layer: Layer): Layer {
  const newCanvas = createCanvas(layer.canvas.width, layer.canvas.height);
  const ctx = newCanvas.getContext('2d')!;
  ctx.drawImage(layer.canvas, 0, 0);
  const newLayer = { ...layer, canvas: newCanvas };
  if (layer.mask) {
    const maskCanvas = createCanvas(layer.canvas.width, layer.canvas.height);
    maskCanvas.getContext('2d')!.drawImage(layer.mask, 0, 0);
    newLayer.mask = maskCanvas;
  }
  return newLayer;
}

function saveHistoryState(layers: Layer[], activeLayerId: string): HistoryState {
  return {
    layers: layers.map(l => {
      const state: any = {
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        imageData: l.canvas.getContext('2d')!.getImageData(0, 0, l.canvas.width, l.canvas.height),
        blendMode: l.blendMode,
        locked: l.locked,
        maskData: l.mask ? l.mask.getContext('2d')!.getImageData(0, 0, l.canvas.width, l.canvas.height) : null,
      };
      return state;
    }),
    activeLayerId,
  };
}

function restoreHistoryState(state: HistoryState, canvasWidth: number, canvasHeight: number): { layers: Layer[]; activeLayerId: string } {
  const layers: Layer[] = state.layers.map(ls => {
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(ls.imageData, 0, 0);
    const layer: Layer = {
      id: ls.id,
      name: ls.name,
      visible: ls.visible,
      opacity: ls.opacity,
      canvas,
      blendMode: ls.blendMode,
      locked: ls.locked,
    };
    if (ls.maskData) {
      const maskCanvas = createCanvas(canvasWidth, canvasHeight);
      maskCanvas.getContext('2d')!.putImageData(ls.maskData, 0, 0);
      layer.mask = maskCanvas;
    }
    return layer;
  });
  return { layers, activeLayerId: state.activeLayerId };
}

function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string, tolerance: number = 32) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const startIdx = (startY * width + startX) * 4;
  const startR = data[startIdx], startG = data[startIdx + 1], startB = data[startIdx + 2], startA = data[startIdx + 3];
  const fill = hexToRgba(fillColor);
  if (startR === fill.r && startG === fill.g && startB === fill.b && startA === fill.a) return;
  const stack: [number, number][] = [[startX, startY]];
  const visited = new Uint8Array(width * height);
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const pixelIdx = y * width + x;
    if (visited[pixelIdx]) continue;
    const idx = pixelIdx * 4;
    const dr = Math.abs(data[idx] - startR);
    const dg = Math.abs(data[idx + 1] - startG);
    const db = Math.abs(data[idx + 2] - startB);
    const da = Math.abs(data[idx + 3] - startA);
    if (dr + dg + db + da > tolerance * 4) continue;
    visited[pixelIdx] = 1;
    data[idx] = fill.r; data[idx + 1] = fill.g; data[idx + 2] = fill.b; data[idx + 3] = fill.a;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(imageData, 0, 0);
}

function hexToRgba(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) return { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 255 };
  return { r: 0, g: 0, b: 0, a: 255 };
}

function rgbaToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}

// SVG Icons for tools
const ToolIcons: Record<string, React.ReactNode> = {
  move: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 3h-2v5h5v-2l3 3-3 3v-2h-5v5h2l-3 3-3-3h2v-5H5v2l-3-3 3-3v2h5V5H8l3-3z"/></svg>,
  select: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2"><rect x="3" y="3" width="18" height="18" rx="1"/></svg>,
  lasso: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12c0-5 4-9 9-9s7 3 7 6-2 5-5 5-4-2-4-4 1-3 3-3 3 1 3 3"/><circle cx="8" cy="19" r="2"/></svg>,
  'magic-wand': <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21L15 9"/><path d="M14 4l2 2-2 2-2-2z"/><path d="M20 4v2M20 10v2M18 6h2M22 6h-2M17 1l1 1M21 1l-1 1M17 11l1-1M21 11l-1-1"/></svg>,
  crop: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v16h16M2 6h16v16"/></svg>,
  eyedropper: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 22l1-5L17 3l4 4L7 21z"/><path d="M14 6l4 4"/></svg>,
  brush: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2l4 4-12 12H6v-4z"/><path d="M6 18c-2 0-4 2-4 4 2 0 4-2 4-4z"/></svg>,
  eraser: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L2 15l10-10 8 8-5 5"/><path d="M18 13l-8-8"/></svg>,
  gradient: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18" opacity="0.5"/><rect x="3" y="3" width="9" height="18" fill="currentColor" opacity="0.3"/></svg>,
  'blur-tool': <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" opacity="0.3"/><circle cx="12" cy="12" r="6" opacity="0.5"/><circle cx="12" cy="12" r="9" opacity="0.7"/></svg>,
  'sharpen-tool': <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l4 8-4 12-4-12z"/><path d="M8 10h8"/></svg>,
  dodge: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><path d="M12 4v16" strokeWidth="3"/></svg>,
  burn: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>,
  smudge: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20c2-4 6-6 8-10s2-6 6-8"/><circle cx="18" cy="4" r="2"/></svg>,
  clone: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="5"/><circle cx="16" cy="16" r="5"/><path d="M12 12l-1 1"/></svg>,
  fill: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11l-8-8-7 7 8 8"/><path d="M5 14l4 4"/><path d="M19 15c0 3-2 5-3 5s-3-2-3-5 3-5 3-5 3 2 3 5z" fill="currentColor"/></svg>,
  text: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 4h14v3h-2V6H13v12h2v2H9v-2h2V6H7v1H5V4z"/></svg>,
  pen: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>,
  line: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="4"/></svg>,
  rectangle: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="1"/></svg>,
  ellipse: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>,
  zoom: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/><path d="M10 7v6M7 10h6"/></svg>,
  hand: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 00-4 0v1M14 7V4a2 2 0 00-4 0v6M10 5V4a2 2 0 00-4 0v8"/><path d="M18 11a2 2 0 014 0v3a8 8 0 01-8 8h-2c-2.5 0-4-1-6-4l-2.3-3.3a2 2 0 013-2.5L6 14"/></svg>,
};

export default function App() {
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(12);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [brushHardness, setBrushHardness] = useState(100);
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState('');
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showFilters, setShowFilters] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showNavigator, setShowNavigator] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [textOptions, setTextOptions] = useState({ text: '', font: 'Arial', size: 32, color: '#000000', bold: false, italic: false, align: 'left' as CanvasTextAlign });
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
  const [gradientStart, setGradientStart] = useState<{ x: number; y: number } | null>(null);
  const [newCanvasSize, setNewCanvasSize] = useState({ width: 1200, height: 800 });
  const [filterValues, setFilterValues] = useState({ brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 });
  const [activeTab, setActiveTab] = useState<'layers' | 'history' | 'color' | 'navigator'>('layers');
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [transform, setTransform] = useState<TransformState | null>(null);
  const [cloneSource, setCloneSource] = useState<{ x: number; y: number } | null>(null);
  const [tolerance, setTolerance] = useState(32);
  const [shapeFill, setShapeFill] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [selectionPath, setSelectionPath] = useState<{ x: number; y: number }[] | null>(null);
  const selectionPathRef = useRef<{ x: number; y: number }[] | null>(null);
  const [pixelColor, setPixelColor] = useState('#ffffff');

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const navigatorCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorOverlayRef = useRef<HTMLCanvasElement>(null);
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  // Initialize
  useEffect(() => {
    const initialLayer: Layer = {
      id: generateId(), name: 'Background', visible: true, opacity: 100,
      canvas: createCanvas(canvasWidth, canvasHeight), blendMode: 'normal', locked: false,
    };
    const ctx = initialLayer.canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    setLayers([initialLayer]);
    setActiveLayerId(initialLayer.id);
    const state = saveHistoryState([initialLayer], initialLayer.id);
    setHistory([state]);
    setHistoryIndex(0);
  }, []);

  // Render composite
  const renderComposite = () => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Checkerboard
    const size = 8;
    for (let y = 0; y < canvasHeight; y += size) {
      for (let x = 0; x < canvasWidth; x += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#b0b0b0' : '#e0e0e0';
        ctx.fillRect(x, y, size, size);
      }
    }

    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      if (layer.mask) {
        // Apply mask
        const tempCanvas = createCanvas(canvasWidth, canvasHeight);
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(layer.canvas, 0, 0);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(layer.mask, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
      } else {
        ctx.drawImage(layer.canvas, 0, 0);
      }
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Selection marching ants
    if (selection) {
      const mask = (window as any).__selectionMask as HTMLCanvasElement | undefined;
      
      if (mask) {
        // Draw selection mask as semi-transparent overlay
        ctx.globalAlpha = 0.3;
        ctx.drawImage(mask, 0, 0);
        ctx.globalAlpha = 1;
      }
      
      // Draw marching ants on bounding box
      const time = Date.now() / 100;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = time % 8;
      ctx.strokeRect(selection.x + 0.5, selection.y + 0.5, selection.w, selection.h);
      ctx.strokeStyle = '#fff';
      ctx.lineDashOffset = (time + 4) % 8;
      ctx.strokeRect(selection.x + 0.5, selection.y + 0.5, selection.w, selection.h);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    // Transform handles
    if (transform?.active) {
      ctx.strokeStyle = '#4a90d9';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(transform.x, transform.y, transform.width, transform.height);
      const handles = [
        { x: transform.x, y: transform.y },
        { x: transform.x + transform.width, y: transform.y },
        { x: transform.x, y: transform.y + transform.height },
        { x: transform.x + transform.width, y: transform.y + transform.height },
        { x: transform.x + transform.width / 2, y: transform.y },
        { x: transform.x + transform.width / 2, y: transform.y + transform.height },
        { x: transform.x, y: transform.y + transform.height / 2 },
        { x: transform.x + transform.width, y: transform.y + transform.height / 2 },
      ];
      handles.forEach(h => {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#4a90d9';
        ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
        ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
      });
    }

    // Update navigator
    updateNavigator();
  };

  const updateNavigator = () => {
    const navCanvas = navigatorCanvasRef.current;
    if (!navCanvas || !mainCanvasRef.current) return;
    const navCtx = navCanvas.getContext('2d')!;
    const scale = Math.min(navCanvas.width / canvasWidth, navCanvas.height / canvasHeight);
    navCtx.clearRect(0, 0, navCanvas.width, navCanvas.height);
    navCtx.fillStyle = '#333';
    navCtx.fillRect(0, 0, navCanvas.width, navCanvas.height);
    const w = canvasWidth * scale;
    const h = canvasHeight * scale;
    const x = (navCanvas.width - w) / 2;
    const y = (navCanvas.height - h) / 2;
    navCtx.drawImage(mainCanvasRef.current, x, y, w, h);
    // Viewport indicator
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const vpX = x + (-panOffset.x / zoom) * scale;
      const vpY = y + (-panOffset.y / zoom) * scale;
      const vpW = (containerRect.width / zoom) * scale;
      const vpH = (containerRect.height / zoom) * scale;
      navCtx.strokeStyle = '#ff4444';
      navCtx.lineWidth = 1;
      navCtx.strokeRect(vpX, vpY, vpW, vpH);
    }
  };

  // Animate marching ants
  useEffect(() => {
    if (!selection && !transform?.active) return;
    const animate = () => {
      renderComposite();
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [selection, transform?.active, renderComposite]);

  // Draw rulers
  const drawRulers = useCallback(() => {
    if (!showRulers) return;
    // Top ruler
    const topRuler = topRulerRef.current;
    if (topRuler) {
      const parent = topRuler.parentElement;
      if (parent) {
        topRuler.width = parent.clientWidth;
        topRuler.height = 20;
        const ctx = topRuler.getContext('2d')!;
        ctx.fillStyle = '#444';
        ctx.fillRect(0, 0, topRuler.width, 20);
        ctx.fillStyle = '#aaa';
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 0.5;
        ctx.font = '8px sans-serif';
        const step = zoom < 0.5 ? 100 : zoom < 1 ? 50 : zoom < 4 ? 20 : 10;
        const bigStep = step * 5;
        for (let x = 0; x < topRuler.width; x += 1) {
          const worldX = Math.round((x - topRuler.width / 2 - panOffset.x) / zoom + canvasWidth / 2);
          if (worldX % step === 0) {
            const tickH = worldX % bigStep === 0 ? 12 : worldX % (step * 2) === 0 ? 8 : 4;
            ctx.beginPath();
            ctx.moveTo(x, 20);
            ctx.lineTo(x, 20 - tickH);
            ctx.stroke();
            if (worldX % bigStep === 0) {
              ctx.fillText(String(worldX), x + 2, 10);
            }
          }
        }
      }
    }
    // Left ruler
    const leftRuler = leftRulerRef.current;
    if (leftRuler) {
      const parent = leftRuler.parentElement;
      if (parent) {
        leftRuler.width = 20;
        leftRuler.height = parent.clientHeight;
        const ctx = leftRuler.getContext('2d')!;
        ctx.fillStyle = '#444';
        ctx.fillRect(0, 0, 20, leftRuler.height);
        ctx.fillStyle = '#aaa';
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 0.5;
        ctx.font = '8px sans-serif';
        const step = zoom < 0.5 ? 100 : zoom < 1 ? 50 : zoom < 4 ? 20 : 10;
        const bigStep = step * 5;
        for (let y = 0; y < leftRuler.height; y += 1) {
          const worldY = Math.round((y - leftRuler.height / 2 - panOffset.y) / zoom + canvasHeight / 2);
          if (worldY % step === 0) {
            const tickW = worldY % bigStep === 0 ? 12 : worldY % (step * 2) === 0 ? 8 : 4;
            ctx.beginPath();
            ctx.moveTo(20, y);
            ctx.lineTo(20 - tickW, y);
            ctx.stroke();
            if (worldY % bigStep === 0 && worldY > 0) {
              ctx.save();
              ctx.translate(8, y + 3);
              ctx.rotate(-Math.PI / 2);
              ctx.fillText(String(worldY), 0, 0);
              ctx.restore();
            }
          }
        }
      }
    }
  }, [zoom, panOffset, canvasWidth, canvasHeight, showRulers]);

  useEffect(() => {
    drawRulers();
  }, [drawRulers]);

  useEffect(() => {
    renderComposite();
  }, [layers, canvasWidth, canvasHeight, selection, transform]);

  const pushHistory = (currentLayers: Layer[], currentActiveId: string) => {
    const state = saveHistoryState(currentLayers, currentActiveId);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      if (newHistory.length > 60) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 59));
  };

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const state = history[newIndex];
    if (!state) return;
    const { layers: restoredLayers, activeLayerId: restoredId } = restoreHistoryState(state, canvasWidth, canvasHeight);
    setLayers(restoredLayers);
    setActiveLayerId(restoredId);
    setHistoryIndex(newIndex);
  }, [historyIndex, history, canvasWidth, canvasHeight]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const state = history[newIndex];
    if (!state) return;
    const { layers: restoredLayers, activeLayerId: restoredId } = restoreHistoryState(state, canvasWidth, canvasHeight);
    setLayers(restoredLayers);
    setActiveLayerId(restoredId);
    setHistoryIndex(newIndex);
  }, [historyIndex, history, canvasWidth, canvasHeight]);

  const getActiveLayer = () => layers.find(l => l.id === activeLayerId);

  const getCanvasCoords = (e: React.MouseEvent) => {
    const mainCanvas = mainCanvasRef.current!;
    const rect = mainCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const drawBrushLine = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, size: number, color: string, opacity: number, isEraser: boolean) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = `rgba(0,0,0,${opacity / 100})`;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      const rgb = hexToRgba(color);
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity / 100})`;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    // Smooth line with quadratic curve
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    ctx.quadraticCurveTo(from.x, from.y, midX, midY);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const applyBlurSharpen = (ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, isBlur: boolean) => {
    const radius = Math.floor(brushSize / 2);
    const x = Math.max(0, pos.x - radius);
    const y = Math.max(0, pos.y - radius);
    const w = Math.min(brushSize * 2, ctx.canvas.width - x);
    const h = Math.min(brushSize * 2, ctx.canvas.height - y);
    if (w <= 2 || h <= 2) return;
    const imageData = ctx.getImageData(x, y, w, h);
    const data = imageData.data;
    const copy = new Uint8ClampedArray(data);
    const kernel = isBlur ? [1, 2, 1, 2, 4, 2, 1, 2, 1] : [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const kSum = isBlur ? 16 : 1;
    for (let py = 1; py < h - 1; py++) {
      for (let px = 1; px < w - 1; px++) {
        for (let c = 0; c < 3; c++) {
          let val = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((py + ky) * w + (px + kx)) * 4 + c;
              val += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          data[(py * w + px) * 4 + c] = Math.max(0, Math.min(255, val / kSum));
        }
      }
    }
    ctx.putImageData(imageData, x, y);
  };

  const applyDodgeBurn = (ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, isDodge: boolean) => {
    const radius = Math.floor(brushSize / 2);
    const x = Math.max(0, pos.x - radius);
    const y = Math.max(0, pos.y - radius);
    const w = Math.min(brushSize * 2, ctx.canvas.width - x);
    const h = Math.min(brushSize * 2, ctx.canvas.height - y);
    if (w <= 0 || h <= 0) return;
    const imageData = ctx.getImageData(x, y, w, h);
    const data = imageData.data;
    const amount = (brushOpacity / 100) * 20;
    for (let i = 0; i < data.length; i += 4) {
      const dist = Math.sqrt(Math.pow((i / 4) % w - radius, 2) + Math.pow(Math.floor((i / 4) / w) - radius, 2));
      if (dist > radius) continue;
      const factor = 1 - dist / radius;
      if (isDodge) {
        data[i] = Math.min(255, data[i] + amount * factor);
        data[i + 1] = Math.min(255, data[i + 1] + amount * factor);
        data[i + 2] = Math.min(255, data[i + 2] + amount * factor);
      } else {
        data[i] = Math.max(0, data[i] - amount * factor);
        data[i + 1] = Math.max(0, data[i + 1] - amount * factor);
        data[i + 2] = Math.max(0, data[i + 2] - amount * factor);
      }
    }
    ctx.putImageData(imageData, x, y);
  };

  const applySmudge = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const radius = Math.floor(brushSize / 2);
    const sx = Math.max(0, from.x - radius);
    const sy = Math.max(0, from.y - radius);
    const sw = Math.min(brushSize * 2, ctx.canvas.width - sx);
    const sh = Math.min(brushSize * 2, ctx.canvas.height - sy);
    if (sw <= 0 || sh <= 0) return;
    const sourceData = ctx.getImageData(sx, sy, sw, sh);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const destX = Math.max(0, sx + dx);
    const destY = Math.max(0, sy + dy);
    ctx.globalAlpha = brushOpacity / 100 * 0.5;
    const tempCanvas = createCanvas(sw, sh);
    tempCanvas.getContext('2d')!.putImageData(sourceData, 0, 0);
    ctx.drawImage(tempCanvas, destX - sx + sx, destY - sy + sy);
    ctx.globalAlpha = 1;
  };

  const magicWandSelect = (startX: number, startY: number) => {
    // Use active layer instead of composite
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    
    const startIdx = (startY * canvasWidth + startX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];
    
    // If clicked on transparent pixel, select all transparent areas
    const selectTransparent = startA < 10;
    
    const visited = new Uint8Array(canvasWidth * canvasHeight);
    const selected = new Uint8Array(canvasWidth * canvasHeight);
    const stack: [number, number][] = [[startX, startY]];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;
      const pixelIdx = y * canvasWidth + x;
      if (visited[pixelIdx]) continue;
      
      const idx = pixelIdx * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      
      let shouldSelect = false;
      
      if (selectTransparent) {
        // Select transparent or semi-transparent pixels
        shouldSelect = a < 10;
      } else {
        // Select pixels similar to start color
        const dr = Math.abs(r - startR);
        const dg = Math.abs(g - startG);
        const db = Math.abs(b - startB);
        const da = Math.abs(a - startA);
        // Use Euclidean distance for better color matching
        const distance = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
        shouldSelect = distance <= tolerance * 2;
      }
      
      if (!shouldSelect) continue;
      
      visited[pixelIdx] = 1;
      selected[pixelIdx] = 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // 8-connected flood fill for better contour detection
      stack.push(
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
        [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]
      );
    }
    
    // Create selection mask
    const maskCanvas = createCanvas(canvasWidth, canvasHeight);
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskData = maskCtx.createImageData(canvasWidth, canvasHeight);
    
    for (let i = 0; i < selected.length; i++) {
      if (selected[i]) {
        maskData.data[i * 4] = 255;     // R
        maskData.data[i * 4 + 1] = 255; // G
        maskData.data[i * 4 + 2] = 255; // B
        maskData.data[i * 4 + 3] = 128; // A (semi-transparent for visualization)
      }
    }
    
    maskCtx.putImageData(maskData, 0, 0);
    
    // Store selection mask globally for later use
    (window as any).__selectionMask = maskCanvas;
    
    // Set bounding box for now (real mask is stored separately)
    setSelection({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    renderComposite();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    if (e.button === 1 || (e.button === 0 && e.altKey) || tool === 'hand') {
      isPanning.current = true;
      panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      return;
    }
    if (e.button === 2) return;

    const pos = getCanvasCoords(e);
    const activeLayer = getActiveLayer();

    // Transform mode
    if (transform?.active) {
      // Check if clicking on a handle or inside transform
      const t = transform;
      const inside = pos.x >= t.x && pos.x <= t.x + t.width && pos.y >= t.y && pos.y <= t.y + t.height;
      if (!inside) {
        // Commit transform
        commitTransform();
        return;
      }
    }

    if (!activeLayer || activeLayer.locked) return;
    const ctx = activeLayer.canvas.getContext('2d')!;

    switch (tool) {
      case 'brush':
      case 'eraser':
        setIsDrawing(true);
        setLastPos(pos);
        drawBrushLine(ctx, pos, pos, brushSize, tool === 'eraser' ? '#000' : fgColor, brushOpacity, tool === 'eraser');
        renderComposite();
        break;
      case 'fill':
        floodFill(ctx, pos.x, pos.y, fgColor, tolerance);
        renderComposite();
        pushHistory(layers, activeLayerId);
        break;
      case 'eyedropper': {
        const mainCanvas = mainCanvasRef.current!;
        const mainCtx = mainCanvas.getContext('2d')!;
        const pixel = mainCtx.getImageData(pos.x, pos.y, 1, 1).data;
        if (e.shiftKey) setBgColor(rgbaToHex(pixel[0], pixel[1], pixel[2]));
        else setFgColor(rgbaToHex(pixel[0], pixel[1], pixel[2]));
        break;
      }
      case 'magic-wand':
        magicWandSelect(pos.x, pos.y);
        break;
      case 'select':
        setIsDrawing(true);
        setSelectionStart(pos);
        setSelection(null);
        (window as any).__selectionMask = null;
        break;
      case 'lasso':
        setIsDrawing(true);
        setSelectionPath([pos]);
        selectionPathRef.current = [pos];
        setSelection(null);
        (window as any).__selectionMask = null;
        break;
      case 'text':
        setTextPosition(pos);
        setShowTextDialog(true);
        break;
      case 'line':
      case 'rectangle':
      case 'ellipse':
      case 'gradient':
        setIsDrawing(true);
        setGradientStart(pos);
        setLastPos(pos);
        break;
      case 'zoom':
        if (e.shiftKey) setZoom(z => Math.max(0.1, z - 0.25));
        else setZoom(z => Math.min(32, z * 1.5));
        break;
      case 'blur-tool':
      case 'sharpen-tool':
        setIsDrawing(true);
        setLastPos(pos);
        applyBlurSharpen(ctx, pos, tool === 'blur-tool');
        renderComposite();
        break;
      case 'dodge':
      case 'burn':
        setIsDrawing(true);
        setLastPos(pos);
        applyDodgeBurn(ctx, pos, tool === 'dodge');
        renderComposite();
        break;
      case 'smudge':
        setIsDrawing(true);
        setLastPos(pos);
        break;
      case 'clone':
        if (e.altKey) {
          setCloneSource(pos);
          setSelectionStart(pos); // temp storage for initial offset
        } else if (cloneSource) {
          setIsDrawing(true);
          setLastPos(pos);
        }
        break;
      case 'move':
        setIsDrawing(true);
        setLastPos(pos);
        break;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);
    setCursorPos(pos);

    // Get pixel color under cursor
    if (pos.x >= 0 && pos.x < canvasWidth && pos.y >= 0 && pos.y < canvasHeight && mainCanvasRef.current) {
      const mainCtx = mainCanvasRef.current.getContext('2d')!;
      const pixel = mainCtx.getImageData(pos.x, pos.y, 1, 1).data;
      setPixelColor(rgbaToHex(pixel[0], pixel[1], pixel[2]));
    }

    // Draw cursor overlay
    drawCursorOverlay(pos);

    if (isPanning.current) {
      setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }
    if (!isDrawing) return;
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;

    // Draw shape preview on overlay
    if (['line', 'rectangle', 'ellipse', 'gradient'].includes(tool) && gradientStart) {
      const overlay = cursorOverlayRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d')!;
        octx.clearRect(0, 0, overlay.width, overlay.height);
        octx.strokeStyle = '#4a90d9';
        octx.lineWidth = 1;
        octx.setLineDash([4, 4]);
        if (tool === 'line') {
          octx.beginPath();
          octx.moveTo(gradientStart.x, gradientStart.y);
          octx.lineTo(pos.x, pos.y);
          octx.stroke();
          // Show length
          const len = Math.round(Math.sqrt(Math.pow(pos.x - gradientStart.x, 2) + Math.pow(pos.y - gradientStart.y, 2)));
          octx.fillStyle = '#4a90d9';
          octx.font = '10px sans-serif';
          octx.fillText(`${len}px`, pos.x + 10, pos.y - 5);
        } else if (tool === 'rectangle') {
          octx.strokeRect(gradientStart.x, gradientStart.y, pos.x - gradientStart.x, pos.y - gradientStart.y);
          octx.fillStyle = '#4a90d9';
          octx.font = '10px sans-serif';
          octx.fillText(`${Math.abs(pos.x - gradientStart.x)} × ${Math.abs(pos.y - gradientStart.y)}`, pos.x + 5, pos.y - 5);
        } else if (tool === 'ellipse') {
          const cx = (gradientStart.x + pos.x) / 2;
          const cy = (gradientStart.y + pos.y) / 2;
          const rx = Math.abs(pos.x - gradientStart.x) / 2;
          const ry = Math.abs(pos.y - gradientStart.y) / 2;
          octx.beginPath();
          octx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          octx.stroke();
        } else if (tool === 'gradient') {
          octx.beginPath();
          octx.moveTo(gradientStart.x, gradientStart.y);
          octx.lineTo(pos.x, pos.y);
          octx.stroke();
          octx.fillStyle = fgColor;
          octx.beginPath();
          octx.arc(gradientStart.x, gradientStart.y, 4, 0, Math.PI * 2);
          octx.fill();
          octx.fillStyle = bgColor;
          octx.beginPath();
          octx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
          octx.fill();
        }
        octx.setLineDash([]);
      }
    }

    switch (tool) {
      case 'brush':
      case 'eraser':
        if (lastPos) {
          drawBrushLine(ctx, lastPos, pos, brushSize, tool === 'eraser' ? '#000' : fgColor, brushOpacity, tool === 'eraser');
          setLastPos(pos);
          renderComposite();
        }
        break;
      case 'select':
        if (selectionStart) {
          const sel = {
            x: Math.min(selectionStart.x, pos.x),
            y: Math.min(selectionStart.y, pos.y),
            w: Math.abs(pos.x - selectionStart.x),
            h: Math.abs(pos.y - selectionStart.y),
          };
          setSelection(sel);
          // Draw preview on overlay
          const overlay = cursorOverlayRef.current;
          if (overlay) {
            const octx = overlay.getContext('2d')!;
            octx.clearRect(0, 0, overlay.width, overlay.height);
            octx.strokeStyle = '#fff';
            octx.lineWidth = 1;
            octx.setLineDash([4, 4]);
            octx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h);
            octx.strokeStyle = '#000';
            octx.lineDashOffset = 4;
            octx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h);
            octx.setLineDash([]);
            octx.lineDashOffset = 0;
            // Show dimensions
            octx.fillStyle = '#4a90d9';
            octx.font = '10px sans-serif';
            octx.fillText(`${sel.w} × ${sel.h}`, pos.x + 10, pos.y - 5);
          }
          renderComposite();
        }
        break;
      case 'lasso':
        if (selectionPathRef.current) {
          const newPath = [...selectionPathRef.current, pos];
          selectionPathRef.current = newPath;
          setSelectionPath(newPath);
          // Draw lasso path on overlay
          const overlay = cursorOverlayRef.current;
          if (overlay && newPath.length > 0) {
            const octx = overlay.getContext('2d')!;
            octx.clearRect(0, 0, overlay.width, overlay.height);
            octx.strokeStyle = '#fff';
            octx.lineWidth = 1;
            octx.setLineDash([3, 3]);
            octx.beginPath();
            octx.moveTo(newPath[0].x, newPath[0].y);
            newPath.forEach(p => octx.lineTo(p.x, p.y));
            octx.lineTo(pos.x, pos.y);
            octx.stroke();
            octx.setLineDash([]);
          }
        }
        break;
      case 'blur-tool':
      case 'sharpen-tool':
        applyBlurSharpen(ctx, pos, tool === 'blur-tool');
        setLastPos(pos);
        renderComposite();
        break;
      case 'dodge':
      case 'burn':
        applyDodgeBurn(ctx, pos, tool === 'dodge');
        setLastPos(pos);
        renderComposite();
        break;
      case 'smudge':
        if (lastPos) {
          applySmudge(ctx, lastPos, pos);
          setLastPos(pos);
          renderComposite();
        }
        break;
      case 'clone':
        if (lastPos && cloneSource && selectionStart) {
          const offsetX = cloneSource.x - selectionStart.x;
          const offsetY = cloneSource.y - selectionStart.y;
          const r = Math.floor(brushSize / 2);
          const srcX = Math.max(0, pos.x + offsetX - r);
          const srcY = Math.max(0, pos.y + offsetY - r);
          const srcW = Math.min(brushSize, canvasWidth - srcX);
          const srcH = Math.min(brushSize, canvasHeight - srcY);
          if (srcW > 0 && srcH > 0) {
            const srcData = ctx.getImageData(srcX, srcY, srcW, srcH);
            const destX = Math.max(0, pos.x - r);
            const destY = Math.max(0, pos.y - r);
            // Apply with circular mask
            const tempCanvas = createCanvas(srcW, srcH);
            const tempCtx = tempCanvas.getContext('2d')!;
            tempCtx.putImageData(srcData, 0, 0);
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(tempCanvas, destX - srcX + (pos.x - r), destY - srcY + (pos.y - r));
            ctx.restore();
          }
          setLastPos(pos);
          renderComposite();
        }
        break;
      case 'move':
        if (lastPos) {
          const dx = pos.x - lastPos.x;
          const dy = pos.y - lastPos.y;
          const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          ctx.putImageData(imgData, dx, dy);
          setLastPos(pos);
          renderComposite();
        }
        break;
    }
  };

  const drawCursorOverlay = (pos: { x: number; y: number }) => {
    const overlay = cursorOverlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    // Don't clear if we're drawing shapes or selection (they handle their own overlay)
    if (!isDrawing || !['line', 'rectangle', 'ellipse', 'gradient', 'lasso', 'select'].includes(tool)) {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
    // Draw brush circle for brush-like tools
    if (['brush', 'eraser', 'blur-tool', 'sharpen-tool', 'dodge', 'burn', 'smudge', 'clone'].includes(tool) && !isDrawing) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Crosshair
    if (!['hand', 'move', 'zoom'].includes(tool)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pos.x - 12, pos.y); ctx.lineTo(pos.x - 4, pos.y);
      ctx.moveTo(pos.x + 4, pos.y); ctx.lineTo(pos.x + 12, pos.y);
      ctx.moveTo(pos.x, pos.y - 12); ctx.lineTo(pos.x, pos.y - 4);
      ctx.moveTo(pos.x, pos.y + 4); ctx.lineTo(pos.x, pos.y + 12);
      ctx.stroke();
    }
    // Clone source indicator
    if (tool === 'clone' && cloneSource) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      const cs = 8;
      ctx.beginPath();
      ctx.moveTo(cloneSource.x - cs, cloneSource.y); ctx.lineTo(cloneSource.x + cs, cloneSource.y);
      ctx.moveTo(cloneSource.x, cloneSource.y - cs); ctx.lineTo(cloneSource.x, cloneSource.y + cs);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cloneSource.x, cloneSource.y, cs, 0, Math.PI * 2);
      ctx.stroke();
      // Show source preview at cursor
      if (isDrawing) {
        ctx.strokeStyle = 'rgba(255,100,100,0.5)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning.current) { isPanning.current = false; return; }
    if (!isDrawing) return;
    const pos = getCanvasCoords(e);
    const activeLayer = getActiveLayer();
    if (!activeLayer) { setIsDrawing(false); return; }
    const ctx = activeLayer.canvas.getContext('2d')!;

    if ((tool === 'line' || tool === 'rectangle' || tool === 'ellipse') && gradientStart) {
      ctx.strokeStyle = fgColor;
      ctx.fillStyle = fgColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(gradientStart.x, gradientStart.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'rectangle') {
        if (shapeFill) ctx.fillRect(gradientStart.x, gradientStart.y, pos.x - gradientStart.x, pos.y - gradientStart.y);
        else ctx.strokeRect(gradientStart.x, gradientStart.y, pos.x - gradientStart.x, pos.y - gradientStart.y);
      } else if (tool === 'ellipse') {
        const cx = (gradientStart.x + pos.x) / 2;
        const cy = (gradientStart.y + pos.y) / 2;
        const rx = Math.abs(pos.x - gradientStart.x) / 2;
        const ry = Math.abs(pos.y - gradientStart.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (shapeFill) ctx.fill(); else ctx.stroke();
      }
      renderComposite();
    }

    if (tool === 'gradient' && gradientStart) {
      let gradient: CanvasGradient;
      if (gradientType === 'linear') {
        gradient = ctx.createLinearGradient(gradientStart.x, gradientStart.y, pos.x, pos.y);
      } else {
        const dist = Math.sqrt(Math.pow(pos.x - gradientStart.x, 2) + Math.pow(pos.y - gradientStart.y, 2));
        gradient = ctx.createRadialGradient(gradientStart.x, gradientStart.y, 0, gradientStart.x, gradientStart.y, dist);
      }
      gradient.addColorStop(0, fgColor);
      gradient.addColorStop(1, bgColor);
      ctx.fillStyle = gradient;
      if (selection) ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
      else ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      renderComposite();
    }

    if (tool === 'lasso' && selectionPathRef.current && selectionPathRef.current.length > 2) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      selectionPathRef.current.forEach(p => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
      setSelection({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
      setSelectionPath(null);
      selectionPathRef.current = null;
      renderComposite();
    }

    setIsDrawing(false);
    setLastPos(null);
    setGradientStart(null);
    setSelectionStart(null);
    setSelectionPath(null);
    selectionPathRef.current = null;
    // Clear overlay (but keep selection visible via renderComposite)
    const overlay = cursorOverlayRef.current;
    if (overlay) overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height);
    // Only push history for tools that modify the canvas
    if (['brush', 'eraser', 'fill', 'blur-tool', 'sharpen-tool', 'dodge', 'burn', 'smudge', 'clone', 'line', 'rectangle', 'ellipse', 'gradient', 'move'].includes(tool)) {
      pushHistory(layers, activeLayerId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getCanvasCoords(e);
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX: pos.x, canvasY: pos.y });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.85 : 1.15;
      setZoom(z => Math.max(0.1, Math.min(32, z * delta)));
    } else {
      setPanOffset(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  // Transform
  const startTransform = () => {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    setTransform({
      active: true, x: 0, y: 0, width: canvasWidth, height: canvasHeight,
      rotation: 0, scaleX: 1, scaleY: 1, layerId: activeLayerId,
      snapshot: activeLayer.canvas.getContext('2d')!.getImageData(0, 0, canvasWidth, canvasHeight),
    });
  };

  const commitTransform = () => {
    if (!transform?.active || !transform.snapshot) return;
    setTransform(null);
    pushHistory(layers, activeLayerId);
  };

  // Layer operations
  const addLayer = () => {
    const newLayer: Layer = {
      id: generateId(), name: `Layer ${layers.length + 1}`, visible: true, opacity: 100,
      canvas: createCanvas(canvasWidth, canvasHeight), blendMode: 'normal', locked: false,
    };
    const newLayers = [...layers, newLayer];
    setLayers(newLayers);
    setActiveLayerId(newLayer.id);
    pushHistory(newLayers, newLayer.id);
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const newLayers = layers.filter(l => l.id !== id);
    setLayers(newLayers);
    const newActiveId = activeLayerId === id ? newLayers[newLayers.length - 1].id : activeLayerId;
    setActiveLayerId(newActiveId);
    pushHistory(newLayers, newActiveId);
  };

  const duplicateLayer = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    const newLayer = cloneLayer(layer);
    newLayer.id = generateId();
    newLayer.name = `${layer.name} copy`;
    const idx = layers.findIndex(l => l.id === id);
    const newLayers = [...layers];
    newLayers.splice(idx + 1, 0, newLayer);
    setLayers(newLayers);
    setActiveLayerId(newLayer.id);
    pushHistory(newLayers, newLayer.id);
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = layers.findIndex(l => l.id === id);
    if (direction === 'up' && idx < layers.length - 1) {
      const newLayers = [...layers];
      [newLayers[idx], newLayers[idx + 1]] = [newLayers[idx + 1], newLayers[idx]];
      setLayers(newLayers);
      pushHistory(newLayers, activeLayerId);
    } else if (direction === 'down' && idx > 0) {
      const newLayers = [...layers];
      [newLayers[idx], newLayers[idx - 1]] = [newLayers[idx - 1], newLayers[idx]];
      setLayers(newLayers);
      pushHistory(newLayers, activeLayerId);
    }
  };

  const updateLayerProperty = (id: string, prop: keyof Layer, value: any) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, [prop]: value } : l));
  };

  // Re-render when layers change
  const mergeDown = (id: string) => {
    const idx = layers.findIndex(l => l.id === id);
    if (idx <= 0) return;
    const upper = layers[idx];
    const lower = layers[idx - 1];
    const ctx = lower.canvas.getContext('2d')!;
    ctx.globalAlpha = upper.opacity / 100;
    ctx.globalCompositeOperation = upper.blendMode as GlobalCompositeOperation;
    ctx.drawImage(upper.canvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const newLayers = layers.filter(l => l.id !== id);
    setLayers(newLayers);
    setActiveLayerId(lower.id);
    pushHistory(newLayers, lower.id);
  };

  const flattenImage = () => {
    const flatCanvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = flatCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      ctx.drawImage(layer.canvas, 0, 0);
    });
    const flatLayer: Layer = {
      id: generateId(), name: 'Background', visible: true, opacity: 100,
      canvas: flatCanvas, blendMode: 'normal', locked: false,
    };
    setLayers([flatLayer]);
    setActiveLayerId(flatLayer.id);
    pushHistory([flatLayer], flatLayer.id);
  };

  const addLayerMask = () => {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const maskCanvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = maskCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    if (selection) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
    }
    setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, mask: maskCanvas } : l));
    renderComposite();
    pushHistory(layers, activeLayerId);
  };

  const removeLayerMask = () => {
    setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, mask: undefined } : l));
    renderComposite();
    pushHistory(layers, activeLayerId);
  };

  // File operations
  const newDocument = () => {
    const w = newCanvasSize.width;
    const h = newCanvasSize.height;
    setCanvasWidth(w);
    setCanvasHeight(h);
    const bgLayer: Layer = {
      id: generateId(), name: 'Background', visible: true, opacity: 100,
      canvas: createCanvas(w, h), blendMode: 'normal', locked: false,
    };
    const ctx = bgLayer.canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    setLayers([bgLayer]);
    setActiveLayerId(bgLayer.id);
    setHistory([]);
    setHistoryIndex(-1);
    setTimeout(() => {
      const state = saveHistoryState([bgLayer], bgLayer.id);
      setHistory([state]);
      setHistoryIndex(0);
    }, 0);
    setShowNewDialog(false);
  };

  const openFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        setCanvasWidth(img.width);
        setCanvasHeight(img.height);
        const layer: Layer = {
          id: generateId(), name: file.name, visible: true, opacity: 100,
          canvas: createCanvas(img.width, img.height), blendMode: 'normal', locked: false,
        };
        layer.canvas.getContext('2d')!.drawImage(img, 0, 0);
        setLayers([layer]);
        setActiveLayerId(layer.id);
        setHistory([]);
        setHistoryIndex(-1);
        setTimeout(() => {
          const state = saveHistoryState([layer], layer.id);
          setHistory([state]);
          setHistoryIndex(0);
        }, 0);
      };
      img.src = URL.createObjectURL(file);
    };
    input.click();
  };

  const saveFile = (format: 'png' | 'jpeg' | 'webp') => {
    const exportCanvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = exportCanvas.getContext('2d')!;
    if (format === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasWidth, canvasHeight); }
    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      ctx.drawImage(layer.canvas, 0, 0);
    });
    const link = document.createElement('a');
    link.download = `image.${format}`;
    link.href = exportCanvas.toDataURL(`image/${format}`, 0.92);
    link.click();
  };

  // Filters
  const applyFilter = () => {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    const brightnessFactor = filterValues.brightness / 100;
    const contrastFactor = filterValues.contrast / 100;
    const satFactor = filterValues.saturation / 100;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] * brightnessFactor;
      let g = data[i + 1] * brightnessFactor;
      let b = data[i + 2] * brightnessFactor;
      r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
      g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
      b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;
      const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
      r = gray + satFactor * (r - gray);
      g = gray + satFactor * (g - gray);
      b = gray + satFactor * (b - gray);
      if (filterValues.hue !== 0) {
        const angle = filterValues.hue * Math.PI / 180;
        const cos = Math.cos(angle); const sin = Math.sin(angle);
        const nr = r * (0.213 + cos * 0.787 - sin * 0.213) + g * (0.715 - cos * 0.715 - sin * 0.715) + b * (0.072 - cos * 0.072 + sin * 0.928);
        const ng = r * (0.213 - cos * 0.213 + sin * 0.143) + g * (0.715 + cos * 0.285 + sin * 0.140) + b * (0.072 - cos * 0.072 - sin * 0.283);
        const nb = r * (0.213 - cos * 0.213 - sin * 0.787) + g * (0.715 - cos * 0.715 + sin * 0.715) + b * (0.072 + cos * 0.928 + sin * 0.072);
        r = nr; g = ng; b = nb;
      }
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
    ctx.putImageData(imageData, 0, 0);
    if (filterValues.blur > 0) {
      ctx.filter = `blur(${filterValues.blur}px)`;
      const tempCanvas = createCanvas(canvasWidth, canvasHeight);
      tempCanvas.getContext('2d')!.drawImage(activeLayer.canvas, 0, 0);
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.filter = 'none';
    }
    renderComposite();
    pushHistory(layers, activeLayerId);
    setShowFilters(false);
  };

  const applyQuickFilter = (type: string) => {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    switch (type) {
      case 'invert':
        for (let i = 0; i < data.length; i += 4) { data[i] = 255 - data[i]; data[i + 1] = 255 - data[i + 1]; data[i + 2] = 255 - data[i + 2]; }
        break;
      case 'grayscale':
        for (let i = 0; i < data.length; i += 4) { const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; data[i] = data[i + 1] = data[i + 2] = gray; }
        break;
      case 'sepia':
        for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2]; data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189); data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168); data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131); }
        break;
      case 'threshold':
        for (let i = 0; i < data.length; i += 4) { const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; const val = gray > 128 ? 255 : 0; data[i] = data[i + 1] = data[i + 2] = val; }
        break;
      case 'posterize':
        for (let i = 0; i < data.length; i += 4) { data[i] = Math.round(data[i] / 255 * 4) / 4 * 255; data[i + 1] = Math.round(data[i + 1] / 255 * 4) / 4 * 255; data[i + 2] = Math.round(data[i + 2] / 255 * 4) / 4 * 255; }
        break;
      case 'noise':
        for (let i = 0; i < data.length; i += 4) { const noise = (Math.random() - 0.5) * 50; data[i] = Math.max(0, Math.min(255, data[i] + noise)); data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); }
        break;
      case 'pixelate':
        const pSize = 8;
        for (let y = 0; y < canvasHeight; y += pSize) {
          for (let x = 0; x < canvasWidth; x += pSize) {
            const idx = (y * canvasWidth + x) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            for (let py = 0; py < pSize && y + py < canvasHeight; py++) {
              for (let px = 0; px < pSize && x + px < canvasWidth; px++) {
                const pidx = ((y + py) * canvasWidth + (x + px)) * 4;
                data[pidx] = r; data[pidx + 1] = g; data[pidx + 2] = b;
              }
            }
          }
        }
        break;
      case 'emboss':
        const embossKernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
        const embossCopy = new Uint8ClampedArray(data);
        for (let y = 1; y < canvasHeight - 1; y++) {
          for (let x = 1; x < canvasWidth - 1; x++) {
            for (let c = 0; c < 3; c++) {
              let val = 0;
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  val += embossCopy[((y + ky) * canvasWidth + (x + kx)) * 4 + c] * embossKernel[(ky + 1) * 3 + (kx + 1)];
                }
              }
              data[(y * canvasWidth + x) * 4 + c] = Math.max(0, Math.min(255, val + 128));
            }
          }
        }
        break;
      case 'vignette':
        const cx = canvasWidth / 2, cy = canvasHeight / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);
        for (let y = 0; y < canvasHeight; y++) {
          for (let x = 0; x < canvasWidth; x++) {
            const idx = (y * canvasWidth + x) * 4;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
            const factor = 1 - dist * dist * 0.8;
            data[idx] *= factor; data[idx + 1] *= factor; data[idx + 2] *= factor;
          }
        }
        break;
    }
    ctx.putImageData(imageData, 0, 0);
    renderComposite();
    pushHistory(layers, activeLayerId);
  };

  // Selection operations
  const deleteSelection = () => {
    if (!selection) return;
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    const mask = (window as any).__selectionMask as HTMLCanvasElement | undefined;
    
    if (mask) {
      // Use selection mask for precise deletion
      const layerData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const maskData = mask.getContext('2d')!.getImageData(0, 0, canvasWidth, canvasHeight);
      
      for (let i = 0; i < layerData.data.length; i += 4) {
        if (maskData.data[i + 3] > 0) {
          layerData.data[i + 3] = 0; // Make transparent
        }
      }
      
      ctx.putImageData(layerData, 0, 0);
    } else {
      // Fallback to bounding box
      ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    }
    
    renderComposite();
    pushHistory(layers, activeLayerId);
  };

  const fillSelection = () => {
    if (!selection) return;
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    const mask = (window as any).__selectionMask as HTMLCanvasElement | undefined;
    
    if (mask) {
      // Use selection mask for precise fill
      const layerData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const maskData = mask.getContext('2d')!.getImageData(0, 0, canvasWidth, canvasHeight);
      const fillColor = hexToRgba(fgColor);
      
      for (let i = 0; i < layerData.data.length; i += 4) {
        if (maskData.data[i + 3] > 0) {
          layerData.data[i] = fillColor.r;
          layerData.data[i + 1] = fillColor.g;
          layerData.data[i + 2] = fillColor.b;
          layerData.data[i + 3] = fillColor.a;
        }
      }
      
      ctx.putImageData(layerData, 0, 0);
    } else {
      // Fallback to bounding box
      ctx.fillStyle = fgColor;
      ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
    }
    
    renderComposite();
    pushHistory(layers, activeLayerId);
  };

  const strokeSelection = () => {
    if (!selection) return;
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    const mask = (window as any).__selectionMask as HTMLCanvasElement | undefined;
    
    if (mask) {
      // Create edge detection from mask
      const maskData = mask.getContext('2d')!.getImageData(0, 0, canvasWidth, canvasHeight);
      const layerData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const strokeColor = hexToRgba(fgColor);
      const halfStroke = Math.floor(brushSize / 2);
      
      for (let y = 0; y < canvasHeight; y++) {
        for (let x = 0; x < canvasWidth; x++) {
          const idx = (y * canvasWidth + x) * 4;
          if (maskData.data[idx + 3] === 0) continue;
          
          // Check if this is an edge pixel
          let isEdge = false;
          for (let dy = -halfStroke; dy <= halfStroke && !isEdge; dy++) {
            for (let dx = -halfStroke; dx <= halfStroke && !isEdge; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= canvasWidth || ny < 0 || ny >= canvasHeight) {
                isEdge = true;
                continue;
              }
              const nIdx = (ny * canvasWidth + nx) * 4;
              if (maskData.data[nIdx + 3] === 0) {
                isEdge = true;
              }
            }
          }
          
          if (isEdge) {
            layerData.data[idx] = strokeColor.r;
            layerData.data[idx + 1] = strokeColor.g;
            layerData.data[idx + 2] = strokeColor.b;
            layerData.data[idx + 3] = strokeColor.a;
          }
        }
      }
      
      ctx.putImageData(layerData, 0, 0);
    } else {
      // Fallback to bounding box
      ctx.strokeStyle = fgColor;
      ctx.lineWidth = brushSize;
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
    }
    
    renderComposite();
    pushHistory(layers, activeLayerId);
  };

  const selectAll = () => { 
    setSelection({ x: 0, y: 0, w: canvasWidth, h: canvasHeight }); 
    (window as any).__selectionMask = null;
    renderComposite(); 
  };
  const deselectAll = () => { 
    setSelection(null); 
    (window as any).__selectionMask = null;
    renderComposite(); 
  };
  const invertSelection = () => {
    if (!selection) { selectAll(); return; }
    // Simple invert - just select the inverse bounding area
    // In a real app this would use the actual selection mask
    setSelection({ x: 0, y: 0, w: canvasWidth, h: canvasHeight });
    renderComposite();
  };

  // Copy/Paste
  const copySelection = () => {
    if (!selection) return;
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    const imageData = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
    const tempCanvas = createCanvas(selection.w, selection.h);
    tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0);
    // Store in a global for paste
    (window as any).__clipboard = { canvas: tempCanvas, x: selection.x, y: selection.y };
  };

  const pasteClipboard = () => {
    const clip = (window as any).__clipboard;
    if (!clip) return;
    const newLayer: Layer = {
      id: generateId(), name: 'Pasted Layer', visible: true, opacity: 100,
      canvas: createCanvas(canvasWidth, canvasHeight), blendMode: 'normal', locked: false,
    };
    newLayer.canvas.getContext('2d')!.drawImage(clip.canvas, clip.x, clip.y);
    const newLayers = [...layers, newLayer];
    setLayers(newLayers);
    setActiveLayerId(newLayer.id);
    pushHistory(newLayers, newLayer.id);
  };

  // Text
  const applyText = () => {
    const activeLayer = getActiveLayer();
    if (!activeLayer || !textOptions.text) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    let fontStr = '';
    if (textOptions.italic) fontStr += 'italic ';
    if (textOptions.bold) fontStr += 'bold ';
    fontStr += `${textOptions.size}px "${textOptions.font}"`;
    ctx.font = fontStr;
    ctx.fillStyle = textOptions.color;
    ctx.textAlign = textOptions.align;
    ctx.textBaseline = 'top';
    ctx.fillText(textOptions.text, textPosition.x, textPosition.y);
    renderComposite();
    pushHistory(layers, activeLayerId);
    setShowTextDialog(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showTextDialog || showFilters || showNewDialog || showResizeDialog) return;
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); selectAll(); }
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); deselectAll(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveFile('png'); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); openFile(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setShowNewDialog(true); }
      if (e.ctrlKey && e.key === 'c') { e.preventDefault(); copySelection(); }
      if (e.ctrlKey && e.key === 'v') { e.preventDefault(); pasteClipboard(); }
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); startTransform(); }
      if (e.key === 'Delete' && selection) deleteSelection();
      if (e.key === 'Escape') { if (transform?.active) commitTransform(); deselectAll(); setTransform(null); }
      if (e.key === 'Enter' && transform?.active) commitTransform();
      if (!e.ctrlKey && !e.altKey) {
        if (e.key === 'b' || e.key === 'B') setTool('brush');
        if (e.key === 'e' || e.key === 'E') setTool('eraser');
        if (e.key === 'g' || e.key === 'G') setTool('fill');
        if (e.key === 'i' || e.key === 'I') setTool('eyedropper');
        if (e.key === 't' && !e.ctrlKey) setTool('text');
        if (e.key === 'v' && !e.ctrlKey) setTool('move');
        if (e.key === 'm' || e.key === 'M') setTool('select');
        if (e.key === 'w' || e.key === 'W') setTool('magic-wand');
        if (e.key === 'l' || e.key === 'L') setTool('lasso');
        if (e.key === 'u' || e.key === 'U') setTool('line');
        if (e.key === 'o' && !e.ctrlKey) setTool('dodge');
        if (e.key === 'r' || e.key === 'R') setTool('rectangle');
        if (e.key === 'h' || e.key === 'H') setTool('hand');
        if (e.key === 'z' && !e.ctrlKey) setTool('zoom');
        if (e.key === 'c' && !e.ctrlKey) setTool('crop');
        if (e.key === 's' && !e.ctrlKey) setTool('clone');
      }
      if (e.key === '[') setBrushSize(s => Math.max(1, s - 2));
      if (e.key === ']') setBrushSize(s => Math.min(500, s + 2));
      if (e.key === 'x' || e.key === 'X') { const temp = fgColor; setFgColor(bgColor); setBgColor(temp); }
      if (e.key === 'd' && !e.ctrlKey) { setFgColor('#000000'); setBgColor('#ffffff'); }
      if (e.key === '0') setBrushOpacity(100);
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey) setBrushOpacity(parseInt(e.key) * 10 + 10);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, layers, activeLayerId, selection, fgColor, bgColor, transform, showTextDialog, showFilters, showNewDialog, showResizeDialog]);

  const tools: { id: Tool; label: string; shortcut: string; group?: string }[] = [
    { id: 'move', label: 'Move Tool', shortcut: 'V', group: 'A' },
    { id: 'select', label: 'Rectangular Marquee', shortcut: 'M', group: 'A' },
    { id: 'lasso', label: 'Lasso Tool', shortcut: 'L', group: 'A' },
    { id: 'magic-wand', label: 'Magic Wand', shortcut: 'W', group: 'A' },
    { id: 'crop', label: 'Crop Tool', shortcut: 'C', group: 'A' },
    { id: 'eyedropper', label: 'Eyedropper', shortcut: 'I', group: 'B' },
    { id: 'brush', label: 'Brush Tool', shortcut: 'B', group: 'B' },
    { id: 'clone', label: 'Clone Stamp', shortcut: 'S', group: 'B' },
    { id: 'eraser', label: 'Eraser Tool', shortcut: 'E', group: 'B' },
    { id: 'blur-tool', label: 'Blur Tool', shortcut: '', group: 'B' },
    { id: 'sharpen-tool', label: 'Sharpen Tool', shortcut: '', group: 'B' },
    { id: 'dodge', label: 'Dodge Tool', shortcut: 'O', group: 'B' },
    { id: 'burn', label: 'Burn Tool', shortcut: '', group: 'B' },
    { id: 'smudge', label: 'Smudge Tool', shortcut: '', group: 'B' },
    { id: 'fill', label: 'Paint Bucket', shortcut: 'G', group: 'C' },
    { id: 'gradient', label: 'Gradient Tool', shortcut: '', group: 'C' },
    { id: 'text', label: 'Horizontal Type', shortcut: 'T', group: 'C' },
    { id: 'pen', label: 'Pen Tool', shortcut: 'P', group: 'C' },
    { id: 'line', label: 'Line Tool', shortcut: 'U', group: 'D' },
    { id: 'rectangle', label: 'Rectangle Tool', shortcut: 'R', group: 'D' },
    { id: 'ellipse', label: 'Ellipse Tool', shortcut: '', group: 'D' },
    { id: 'hand', label: 'Hand Tool', shortcut: 'H', group: 'E' },
    { id: 'zoom', label: 'Zoom Tool', shortcut: 'Z', group: 'E' },
  ];



  return (
    <div className="h-screen w-screen flex flex-col bg-[#535353] text-gray-200 overflow-hidden select-none" style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", fontSize: '11px' }}>
      {/* Menu Bar */}
      <div className="h-[26px] bg-[#3c3c3c] border-b border-[#222] flex items-center px-1 text-[11px] shrink-0">
        <div className="flex items-center gap-0">
          <span className="font-bold text-blue-300 mr-3 px-1 text-[11px]">⬡ PhotoEditor Pro</span>
          {[
            { label: 'File', items: [
              { label: 'New...', shortcut: 'Ctrl+N', action: () => setShowNewDialog(true) },
              { label: 'Open...', shortcut: 'Ctrl+O', action: openFile },
              { sep: true },
              { label: 'Save as PNG', shortcut: 'Ctrl+S', action: () => saveFile('png') },
              { label: 'Save as JPEG', action: () => saveFile('jpeg') },
              { label: 'Save as WebP', action: () => saveFile('webp') },
            ]},
            { label: 'Edit', items: [
              { label: 'Undo', shortcut: 'Ctrl+Z', action: undo },
              { label: 'Redo', shortcut: 'Ctrl+Y', action: redo },
              { sep: true },
              { label: 'Copy', shortcut: 'Ctrl+C', action: copySelection },
              { label: 'Paste', shortcut: 'Ctrl+V', action: pasteClipboard },
              { sep: true },
              { label: 'Select All', shortcut: 'Ctrl+A', action: selectAll },
              { label: 'Deselect', shortcut: 'Ctrl+D', action: deselectAll },
              { label: 'Inverse Selection', action: invertSelection },
              { sep: true },
              { label: 'Delete', shortcut: 'Del', action: deleteSelection },
              { label: 'Fill', action: fillSelection },
              { label: 'Stroke', action: strokeSelection },
            ]},
            { label: 'Image', items: [
              { label: 'Canvas Size...', action: () => setShowResizeDialog(true) },
              { sep: true },
              { label: 'Free Transform', shortcut: 'Ctrl+T', action: startTransform },
              { sep: true },
              { label: 'Flatten Image', action: flattenImage },
            ]},
            { label: 'Layer', items: [
              { label: 'New Layer', action: addLayer },
              { label: 'Duplicate Layer', action: () => duplicateLayer(activeLayerId) },
              { label: 'Delete Layer', action: () => deleteLayer(activeLayerId) },
              { sep: true },
              { label: 'Merge Down', action: () => mergeDown(activeLayerId) },
              { label: 'Flatten Image', action: flattenImage },
              { sep: true },
              { label: 'Add Layer Mask', action: addLayerMask },
              { label: 'Remove Layer Mask', action: removeLayerMask },
            ]},
            { label: 'Filter', items: [
              { label: 'Adjustments...', action: () => setShowFilters(true) },
              { sep: true },
              { label: 'Invert', action: () => applyQuickFilter('invert') },
              { label: 'Grayscale', action: () => applyQuickFilter('grayscale') },
              { label: 'Sepia', action: () => applyQuickFilter('sepia') },
              { label: 'Threshold', action: () => applyQuickFilter('threshold') },
              { label: 'Posterize', action: () => applyQuickFilter('posterize') },
              { sep: true },
              { label: 'Noise', action: () => applyQuickFilter('noise') },
              { label: 'Pixelate', action: () => applyQuickFilter('pixelate') },
              { label: 'Emboss', action: () => applyQuickFilter('emboss') },
              { label: 'Vignette', action: () => applyQuickFilter('vignette') },
            ]},
            { label: 'View', items: [
              { label: 'Zoom In', action: () => setZoom(z => Math.min(32, z * 1.5)) },
              { label: 'Zoom Out', action: () => setZoom(z => Math.max(0.1, z / 1.5)) },
              { label: 'Fit on Screen', action: () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); } },
              { label: '100%', action: () => setZoom(1) },
              { sep: true },
              { label: showRulers ? '✓ Rulers' : '  Rulers', action: () => setShowRulers(!showRulers) },
              { label: showNavigator ? '✓ Navigator' : '  Navigator', action: () => setShowNavigator(!showNavigator) },
            ]},
            { label: 'Help', items: [
              { label: 'About PhotoEditor Pro', action: () => setShowAbout(true) },
            ]},
          ].map(menu => (
            <div key={menu.label} className="relative group">
              <button className="px-2 py-0.5 hover:bg-[#505050] rounded-sm">{menu.label}</button>
              <div className="absolute top-full left-0 bg-[#3c3c3c] border border-[#222] rounded shadow-xl hidden group-hover:block z-[100] min-w-[200px] py-1">
                {menu.items.map((item: any, i: number) => item.sep ? (
                  <div key={i} className="border-t border-[#555] my-1"></div>
                ) : (
                  <button key={i} onClick={item.action} className="block w-full text-left px-4 py-[3px] hover:bg-[#4a90d9] flex justify-between items-center">
                    <span>{item.label}</span>
                    {item.shortcut && <span className="text-gray-400 ml-6 text-[10px]">{item.shortcut}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="ml-auto text-gray-400 pr-2 flex items-center gap-3">
          <span>{canvasWidth} × {canvasHeight} px</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Options Bar */}
      <div className="h-[34px] bg-[#444] border-b border-[#222] flex items-center px-3 gap-3 text-[11px] shrink-0">
        <div className="flex items-center gap-1 bg-[#3c3c3c] px-2 py-0.5 rounded-sm">
          {ToolIcons[tool]}
          <span className="ml-1">{tools.find(t => t.id === tool)?.label}</span>
        </div>
        <div className="w-px h-5 bg-[#555]"></div>
        {['brush', 'eraser', 'blur-tool', 'sharpen-tool', 'dodge', 'burn', 'smudge', 'clone'].includes(tool) && (
          <>
            <span className="text-gray-400">Size:</span>
            <input type="number" value={brushSize} onChange={e => setBrushSize(Math.max(1, Math.min(500, Number(e.target.value))))} className="w-12 bg-[#333] border border-[#555] rounded px-1 py-0.5 text-center" />
            <input type="range" min="1" max="200" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-20 accent-blue-500 h-1" />
            <span className="text-gray-400 ml-2">Opacity:</span>
            <input type="number" value={brushOpacity} onChange={e => setBrushOpacity(Math.max(1, Math.min(100, Number(e.target.value))))} className="w-10 bg-[#333] border border-[#555] rounded px-1 py-0.5 text-center" />
            <span>%</span>
          </>
        )}
        {(tool === 'line' || tool === 'rectangle' || tool === 'ellipse') && (
          <>
            <span className="text-gray-400">Stroke:</span>
            <input type="number" value={brushSize} onChange={e => setBrushSize(Math.max(1, Number(e.target.value)))} className="w-12 bg-[#333] border border-[#555] rounded px-1 py-0.5 text-center" />
            <span className="text-gray-400 ml-2">px</span>
            <label className="flex items-center gap-1 ml-2">
              <input type="checkbox" checked={shapeFill} onChange={e => setShapeFill(e.target.checked)} />
              Fill
            </label>
          </>
        )}
        {tool === 'fill' && (
          <>
            <span className="text-gray-400">Tolerance:</span>
            <input type="number" value={tolerance} onChange={e => setTolerance(Number(e.target.value))} className="w-12 bg-[#333] border border-[#555] rounded px-1 py-0.5 text-center" />
          </>
        )}
        {tool === 'magic-wand' && (
          <>
            <span className="text-gray-400">Tolerance:</span>
            <input type="number" value={tolerance} onChange={e => setTolerance(Number(e.target.value))} className="w-12 bg-[#333] border border-[#555] rounded px-1 py-0.5 text-center" />
          </>
        )}
        {tool === 'gradient' && (
          <>
            <select value={gradientType} onChange={e => setGradientType(e.target.value as any)} className="bg-[#333] text-white px-2 py-0.5 rounded border border-[#555]">
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
            </select>
          </>
        )}
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-[38px] bg-[#3c3c3c] border-r border-[#222] flex flex-col items-center py-1 gap-px shrink-0 overflow-y-auto">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`w-[30px] h-[30px] flex items-center justify-center rounded-sm transition-colors relative group/tool ${tool === t.id ? 'bg-[#5a5a5a] text-white shadow-inner' : 'hover:bg-[#4a4a4a] text-gray-300'}`}
              title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
            >
              {ToolIcons[t.id]}
              <div className="absolute left-full ml-2 bg-[#222] text-white px-2 py-1 rounded text-[10px] whitespace-nowrap hidden group-hover/tool:block z-50 pointer-events-none border border-[#555]">
                {t.label}{t.shortcut ? ` (${t.shortcut})` : ''}
              </div>
            </button>
          ))}
          {/* Color swatches */}
          <div className="mt-3 flex flex-col items-center gap-1">
            <div className="relative w-[30px] h-[30px]">
              <div
                className="absolute bottom-0 right-0 w-5 h-5 border border-[#222] rounded-sm cursor-pointer shadow-sm"
                style={{ backgroundColor: bgColor }}
                onClick={() => { const i = document.createElement('input'); i.type = 'color'; i.value = bgColor; i.onchange = () => setBgColor(i.value); i.click(); }}
                title="Background Color"
              />
              <div
                className="absolute top-0 left-0 w-5 h-5 border border-[#222] rounded-sm cursor-pointer z-10 shadow-sm"
                style={{ backgroundColor: fgColor }}
                onClick={() => { const i = document.createElement('input'); i.type = 'color'; i.value = fgColor; i.onchange = () => setFgColor(i.value); i.click(); }}
                title="Foreground Color"
              />
            </div>
            <button onClick={() => { const t = fgColor; setFgColor(bgColor); setBgColor(t); }} className="text-[10px] text-gray-400 hover:text-white" title="Swap (X)">⇄</button>
            <button onClick={() => { setFgColor('#000'); setBgColor('#fff'); }} className="text-[10px] text-gray-400 hover:text-white" title="Default (D)">⬜</button>
          </div>
        </div>

        {/* Canvas Area with Rulers */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left column: corner + left ruler */}
          <div className="flex flex-col">
            {/* Top-left corner */}
            {showRulers && <div className="w-[20px] h-[20px] bg-[#444] border-r border-b border-[#222]"></div>}
            {/* Left ruler */}
            {showRulers && (
              <div className="w-[20px] flex-1 bg-[#444] border-r border-[#222] relative overflow-hidden">
                <canvas ref={leftRulerRef} className="w-full h-full" />
              </div>
            )}
          </div>
          {/* Right column: top ruler + canvas */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top ruler */}
            {showRulers && (
              <div className="h-[20px] bg-[#444] border-b border-[#222] relative overflow-hidden">
                <canvas ref={topRulerRef} className="w-full h-full" />
              </div>
            )}
            {/* Canvas container */}
            <div
              ref={containerRef}
              className="flex-1 overflow-hidden bg-[#535353] relative flex items-center justify-center"
              onWheel={handleWheel}
              onContextMenu={handleContextMenu}
            >
              <div
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                  transformOrigin: 'center',
                }}
                className="relative"
              >
                <canvas
                  ref={mainCanvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  className="shadow-2xl"
                  style={{ imageRendering: zoom > 4 ? 'pixelated' : 'auto', cursor: tool === 'hand' ? 'grab' : tool === 'move' ? 'move' : tool === 'zoom' ? 'zoom-in' : tool === 'text' ? 'text' : tool === 'eyedropper' ? 'crosshair' : 'none' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => { if (isDrawing && !['brush', 'eraser', 'blur-tool', 'sharpen-tool', 'dodge', 'burn', 'smudge'].includes(tool)) { setIsDrawing(false); pushHistory(layers, activeLayerId); } }}
                />
                {/* Cursor overlay */}
                <canvas
                  ref={cursorOverlayRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{ width: canvasWidth, height: canvasHeight }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[260px] bg-[#3c3c3c] border-l border-[#222] flex flex-col shrink-0 overflow-hidden">
          {/* Panel Tabs */}
          <div className="flex border-b border-[#222] bg-[#333]">
            {(['layers', 'color', 'history', 'navigator'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-1 py-1.5 text-[10px] uppercase tracking-wide ${activeTab === tab ? 'bg-[#3c3c3c] text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'color' && (
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 block mb-0.5">Foreground</label>
                    <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)} className="w-full h-7 rounded cursor-pointer border border-[#555]" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 block mb-0.5">Background</label>
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-full h-7 rounded cursor-pointer border border-[#555]" />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setFgColor('#000'); setBgColor('#fff'); }} className="flex-1 text-[10px] bg-[#4a4a4a] hover:bg-[#555] py-0.5 rounded">Default</button>
                  <button onClick={() => { const t = fgColor; setFgColor(bgColor); setBgColor(t); }} className="flex-1 text-[10px] bg-[#4a4a4a] hover:bg-[#555] py-0.5 rounded">Swap</button>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Swatches</label>
                  <div className="grid grid-cols-10 gap-px">
                    {['#000000','#404040','#808080','#c0c0c0','#ffffff','#800000','#ff0000','#ff8000','#ffff00','#808000',
                      '#008000','#00ff00','#008080','#00ffff','#000080','#0000ff','#800080','#ff00ff','#804000','#ff8080',
                      '#ff8000','#ffc000','#ffff80','#80ff80','#80ffff','#8080ff','#ff80ff','#c080ff','#804040','#ff4040'].map(c => (
                      <div key={c} className="w-full aspect-square cursor-pointer border border-[#555] hover:border-white hover:z-10 relative" style={{ backgroundColor: c }}
                        onClick={() => setFgColor(c)} onContextMenu={(e) => { e.preventDefault(); setBgColor(c); }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Hex</label>
                  <input type="text" value={fgColor} onChange={e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) setFgColor(e.target.value); }} className="w-full bg-[#333] border border-[#555] rounded px-1 py-0.5 text-[11px]" />
                </div>
              </div>
            )}

            {activeTab === 'layers' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {getActiveLayer() && (
                  <div className="p-2 border-b border-[#222] space-y-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-12">Blend:</span>
                      <select value={getActiveLayer()!.blendMode} onChange={e => updateLayerProperty(activeLayerId, 'blendMode', e.target.value)} className="flex-1 bg-[#333] text-white text-[10px] px-1 py-0.5 rounded border border-[#555]">
                        {BLEND_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1).replace('-', ' ')}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-12">Opacity:</span>
                      <input type="range" min="0" max="100" value={getActiveLayer()!.opacity} onChange={e => updateLayerProperty(activeLayerId, 'opacity', Number(e.target.value))} className="flex-1 accent-blue-500 h-1" />
                      <input type="number" value={getActiveLayer()!.opacity} onChange={e => updateLayerProperty(activeLayerId, 'opacity', Math.max(0, Math.min(100, Number(e.target.value))))} className="w-9 bg-[#333] border border-[#555] rounded px-0.5 py-0.5 text-[10px] text-center" />
                    </div>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto">
                  {[...layers].reverse().map(layer => (
                    <div key={layer.id} onClick={() => setActiveLayerId(layer.id)} className={`flex items-center gap-1 px-1.5 py-1 border-b border-[#2a2a2a] cursor-pointer ${layer.id === activeLayerId ? 'bg-[#4a90d9]' : 'hover:bg-[#4a4a4a]'}`}>
                      <button onClick={(e) => { e.stopPropagation(); updateLayerProperty(layer.id, 'visible', !layer.visible); }} className="text-[10px] w-4 opacity-70 hover:opacity-100">
                        {layer.visible ? '👁' : ''}
                      </button>
                      <div className="w-8 h-8 bg-[#333] rounded-sm border border-[#555] overflow-hidden shrink-0 relative">
                        <canvas ref={el => { if (el) { const c = el.getContext('2d')!; c.clearRect(0, 0, 32, 32); c.drawImage(layer.canvas, 0, 0, 32, 32); } }} width={32} height={32} className="w-full h-full" />
                        {layer.mask && <div className="absolute inset-0 border-2 border-blue-400 rounded-sm"></div>}
                      </div>
                      <span className="text-[10px] truncate flex-1">{layer.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); updateLayerProperty(layer.id, 'locked', !layer.locked); }} className="text-[10px] opacity-50 hover:opacity-100">
                        {layer.locked ? '🔒' : ''}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-1 border-t border-[#222] flex gap-0.5 flex-wrap">
                  <button onClick={addLayer} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm" title="New Layer">＋</button>
                  <button onClick={() => duplicateLayer(activeLayerId)} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm" title="Duplicate">⧉</button>
                  <button onClick={() => deleteLayer(activeLayerId)} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm" title="Delete">🗑</button>
                  <button onClick={() => moveLayer(activeLayerId, 'up')} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm" title="Move Up">▲</button>
                  <button onClick={() => moveLayer(activeLayerId, 'down')} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm" title="Move Down">▼</button>
                  <button onClick={() => mergeDown(activeLayerId)} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm" title="Merge Down">⤓</button>
                  <button onClick={addLayerMask} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm" title="Add Mask">◐</button>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="flex-1 overflow-y-auto p-1">
                {history.map((h, i) => (
                  <div key={i} onClick={() => { const { layers: rl, activeLayerId: ri } = restoreHistoryState(h, canvasWidth, canvasHeight); setLayers(rl); setActiveLayerId(ri); setHistoryIndex(i); }}
                    className={`px-2 py-1 text-[10px] cursor-pointer rounded-sm mb-px ${i === historyIndex ? 'bg-[#4a90d9] text-white' : i < historyIndex ? 'text-gray-300 hover:bg-[#4a4a4a]' : 'text-gray-500'}`}>
                    <span className="mr-1">{i === 0 ? '📄' : '✏️'}</span>
                    Step {i + 1}{i === historyIndex ? ' ←' : ''}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'navigator' && (
              <div className="p-2 flex flex-col items-center gap-2">
                <canvas ref={navigatorCanvasRef} width={220} height={150} className="border border-[#555] rounded bg-[#222]" />
                <div className="flex items-center gap-1 w-full">
                  <button onClick={() => setZoom(z => Math.max(0.1, z / 1.5))} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm">−</button>
                  <input type="range" min="10" max="3200" value={zoom * 100} onChange={e => setZoom(Number(e.target.value) / 100)} className="flex-1 accent-blue-500 h-1" />
                  <button onClick={() => setZoom(z => Math.min(32, z * 1.5))} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded-sm">+</button>
                </div>
                <span className="text-[10px] text-gray-400">{Math.round(zoom * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-[22px] bg-[#3c3c3c] border-t border-[#222] flex items-center px-2 text-[10px] text-gray-400 shrink-0 gap-3">
        <span>{tools.find(t => t.id === tool)?.label}</span>
        <span className="text-[#555]">|</span>
        <span>X: {cursorPos.x} Y: {cursorPos.y}</span>
        <span className="text-[#555]">|</span>
        <span className="flex items-center gap-1">
          <span>Color:</span>
          <span className="inline-block w-3 h-3 border border-[#555] rounded-sm" style={{ backgroundColor: pixelColor }}></span>
          <span className="uppercase">{pixelColor}</span>
          <span className="text-gray-500">
            ({hexToRgba(pixelColor).r}, {hexToRgba(pixelColor).g}, {hexToRgba(pixelColor).b})
          </span>
        </span>
        <span className="text-[#555]">|</span>
        <span>Layer: {getActiveLayer()?.name || 'None'}</span>
        <span className="ml-auto text-gray-500">Alt+Drag: Pan | Ctrl+Scroll: Zoom | Right-click: Menu</span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed bg-[#3c3c3c] border border-[#555] rounded shadow-xl z-[200] py-1 min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}>
          {[
            { label: 'Cut', action: () => { copySelection(); deleteSelection(); setContextMenu(null); } },
            { label: 'Copy', action: () => { copySelection(); setContextMenu(null); } },
            { label: 'Paste', action: () => { pasteClipboard(); setContextMenu(null); } },
            { sep: true },
            { label: 'Select All', action: () => { selectAll(); setContextMenu(null); } },
            { label: 'Deselect', action: () => { deselectAll(); setContextMenu(null); } },
            { sep: true },
            { label: 'Free Transform', action: () => { startTransform(); setContextMenu(null); } },
            { sep: true },
            { label: 'Fill with FG Color', action: () => { fillSelection(); setContextMenu(null); } },
            { label: 'Stroke', action: () => { strokeSelection(); setContextMenu(null); } },
            { label: 'Delete', action: () => { deleteSelection(); setContextMenu(null); } },
          ].map((item: any, i) => item.sep ? (
            <div key={i} className="border-t border-[#555] my-1"></div>
          ) : (
            <button key={i} onClick={item.action} className="block w-full text-left px-3 py-[3px] text-[11px] hover:bg-[#4a90d9]">{item.label}</button>
          ))}
        </div>
      )}

      {/* Filter Dialog */}
      {showFilters && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFilters(false)}>
          <div className="bg-[#3c3c3c] rounded-lg p-5 w-[380px] border border-[#555] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <span className="text-blue-400">⚙</span> Adjustments
            </h3>
            <div className="space-y-2">
              {[
                { key: 'brightness', label: 'Brightness', min: 0, max: 200, unit: '%' },
                { key: 'contrast', label: 'Contrast', min: 0, max: 200, unit: '%' },
                { key: 'saturation', label: 'Saturation', min: 0, max: 200, unit: '%' },
                { key: 'hue', label: 'Hue Rotate', min: 0, max: 360, unit: '°' },
                { key: 'blur', label: 'Blur', min: 0, max: 20, unit: 'px' },
              ].map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400 w-16">{f.label}</label>
                  <input type="range" min={f.min} max={f.max} value={(filterValues as any)[f.key]} onChange={e => setFilterValues({ ...filterValues, [f.key]: Number(e.target.value) })} className="flex-1 accent-blue-500 h-1" />
                  <span className="text-[10px] w-10 text-right">{(filterValues as any)[f.key]}{f.unit}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setFilterValues({ brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 })} className="px-3 py-1 bg-[#4a4a4a] hover:bg-[#555] rounded text-[11px]">Reset</button>
              <button onClick={() => setShowFilters(false)} className="px-3 py-1 bg-[#4a4a4a] hover:bg-[#555] rounded text-[11px]">Cancel</button>
              <button onClick={applyFilter} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px]">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* New Document Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewDialog(false)}>
          <div className="bg-[#3c3c3c] rounded-lg p-5 w-[320px] border border-[#555] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">New Document</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-400 w-14">Width:</label>
                <input type="number" value={newCanvasSize.width} onChange={e => setNewCanvasSize({ ...newCanvasSize, width: Number(e.target.value) })} className="flex-1 bg-[#333] border border-[#555] rounded px-2 py-1 text-[11px]" />
                <span className="text-[10px] text-gray-400">px</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-400 w-14">Height:</label>
                <input type="number" value={newCanvasSize.height} onChange={e => setNewCanvasSize({ ...newCanvasSize, height: Number(e.target.value) })} className="flex-1 bg-[#333] border border-[#555] rounded px-2 py-1 text-[11px]" />
                <span className="text-[10px] text-gray-400">px</span>
              </div>
              <div className="flex gap-1 flex-wrap pt-1">
                {[{ l: 'HD 720p', w: 1280, h: 720 }, { l: 'FHD 1080p', w: 1920, h: 1080 }, { l: '2K', w: 2560, h: 1440 }, { l: 'Square', w: 1080, h: 1080 }, { l: 'Instagram', w: 1080, h: 1080 }, { l: 'A4 (300dpi)', w: 2480, h: 3508 }, { l: 'Twitter', w: 1600, h: 900 }].map(p => (
                  <button key={p.l} onClick={() => setNewCanvasSize({ width: p.w, height: p.h })} className="text-[10px] bg-[#4a4a4a] hover:bg-[#555] px-1.5 py-0.5 rounded">{p.l}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowNewDialog(false)} className="px-3 py-1 bg-[#4a4a4a] hover:bg-[#555] rounded text-[11px]">Cancel</button>
              <button onClick={newDocument} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px]">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Resize Dialog */}
      {showResizeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowResizeDialog(false)}>
          <div className="bg-[#3c3c3c] rounded-lg p-5 w-[320px] border border-[#555] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">Canvas Size</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-400 w-14">Width:</label>
                <input type="number" value={newCanvasSize.width} onChange={e => setNewCanvasSize({ ...newCanvasSize, width: Number(e.target.value) })} className="flex-1 bg-[#333] border border-[#555] rounded px-2 py-1 text-[11px]" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-400 w-14">Height:</label>
                <input type="number" value={newCanvasSize.height} onChange={e => setNewCanvasSize({ ...newCanvasSize, height: Number(e.target.value) })} className="flex-1 bg-[#333] border border-[#555] rounded px-2 py-1 text-[11px]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowResizeDialog(false)} className="px-3 py-1 bg-[#4a4a4a] hover:bg-[#555] rounded text-[11px]">Cancel</button>
              <button onClick={() => {
                const newW = newCanvasSize.width; const newH = newCanvasSize.height;
                const newLayers = layers.map(l => { const c = createCanvas(newW, newH); c.getContext('2d')!.drawImage(l.canvas, 0, 0); return { ...l, canvas: c }; });
                setCanvasWidth(newW); setCanvasHeight(newH); setLayers(newLayers); pushHistory(newLayers, activeLayerId); setShowResizeDialog(false);
              }} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px]">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Text Dialog */}
      {showTextDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTextDialog(false)}>
          <div className="bg-[#3c3c3c] rounded-lg p-5 w-[400px] border border-[#555] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">Type Tool</h3>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Text</label>
                <textarea value={textOptions.text} onChange={e => setTextOptions({ ...textOptions, text: e.target.value })} className="w-full bg-[#333] border border-[#555] rounded px-2 py-1 text-[11px] h-16 resize-none" placeholder="Enter text..." />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 block mb-0.5">Font</label>
                  <select value={textOptions.font} onChange={e => setTextOptions({ ...textOptions, font: e.target.value })} className="w-full bg-[#333] border border-[#555] rounded px-1 py-0.5 text-[11px]">
                    {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </div>
                <div className="w-16">
                  <label className="text-[10px] text-gray-400 block mb-0.5">Size</label>
                  <input type="number" value={textOptions.size} onChange={e => setTextOptions({ ...textOptions, size: Number(e.target.value) })} className="w-full bg-[#333] border border-[#555] rounded px-1 py-0.5 text-[11px]" />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-[10px] text-gray-400">Color:</label>
                <input type="color" value={textOptions.color} onChange={e => setTextOptions({ ...textOptions, color: e.target.value })} className="h-6 w-10 rounded cursor-pointer border border-[#555]" />
                <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={textOptions.bold} onChange={e => setTextOptions({ ...textOptions, bold: e.target.checked })} /> <b>B</b></label>
                <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={textOptions.italic} onChange={e => setTextOptions({ ...textOptions, italic: e.target.checked })} /> <i>I</i></label>
                <select value={textOptions.align} onChange={e => setTextOptions({ ...textOptions, align: e.target.value as CanvasTextAlign })} className="bg-[#333] border border-[#555] rounded px-1 py-0.5 text-[10px]">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowTextDialog(false)} className="px-3 py-1 bg-[#4a4a4a] hover:bg-[#555] rounded text-[11px]">Cancel</button>
              <button onClick={applyText} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px]">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* About Dialog */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAbout(false)}>
          <div className="bg-[#3c3c3c] rounded-lg p-6 w-[360px] border border-[#555] shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-2">⬡</div>
            <h3 className="text-lg font-bold mb-1">PhotoEditor Pro</h3>
            <p className="text-[11px] text-gray-400 mb-3">Browser-based Image Editor</p>
            <p className="text-[10px] text-gray-500 mb-4">A full-featured Photoshop clone built with React, TypeScript, and Canvas API.</p>
            <div className="text-[10px] text-gray-400 text-left bg-[#333] rounded p-2 mb-4">
              <p className="font-bold mb-1">Keyboard Shortcuts:</p>
              <p>B - Brush | E - Eraser | G - Fill | I - Eyedropper</p>
              <p>V - Move | M - Select | W - Magic Wand | T - Text</p>
              <p>U - Line | R - Rectangle | H - Hand | Z - Zoom</p>
              <p>[ ] - Brush Size | X - Swap Colors | D - Default Colors</p>
              <p>Ctrl+Z/Y - Undo/Redo | Ctrl+T - Free Transform</p>
              <p>Ctrl+C/V - Copy/Paste | Del - Delete Selection</p>
            </div>
            <button onClick={() => setShowAbout(false)} className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px]">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
