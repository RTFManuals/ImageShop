import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, Layer, HistoryState, BLEND_MODES } from './types';

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
  return { ...layer, canvas: newCanvas };
}

function saveHistoryState(layers: Layer[], activeLayerId: string): HistoryState {
  return {
    layers: layers.map(l => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      imageData: l.canvas.getContext('2d')!.getImageData(0, 0, l.canvas.width, l.canvas.height),
      blendMode: l.blendMode,
      locked: l.locked,
    })),
    activeLayerId,
  };
}

function restoreHistoryState(state: HistoryState, canvasWidth: number, canvasHeight: number): { layers: Layer[]; activeLayerId: string } {
  const layers: Layer[] = state.layers.map(ls => {
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(ls.imageData, 0, 0);
    return {
      id: ls.id,
      name: ls.name,
      visible: ls.visible,
      opacity: ls.opacity,
      canvas,
      blendMode: ls.blendMode,
      locked: ls.locked,
    };
  });
  return { layers, activeLayerId: state.activeLayerId };
}

// Flood fill algorithm
function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string, tolerance: number = 32) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const startIdx = (startY * width + startX) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

  const fill = hexToRgba(fillColor);
  if (startR === fill.r && startG === fill.g && startB === fill.b && startA === fill.a) return;

  const stack: [number, number][] = [[startX, startY]];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = (y * width + x) * 4;
    const dr = Math.abs(data[idx] - startR);
    const dg = Math.abs(data[idx + 1] - startG);
    const db = Math.abs(data[idx + 2] - startB);
    const da = Math.abs(data[idx + 3] - startA);

    if (dr + dg + db + da > tolerance * 4) continue;

    visited.add(key);
    data[idx] = fill.r;
    data[idx + 1] = fill.g;
    data[idx + 2] = fill.b;
    data[idx + 3] = fill.a;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgba(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 255 };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

function rgbaToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(10);
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
  const [textOptions, setTextOptions] = useState({ text: '', font: 'Arial', size: 24, color: '#000000', bold: false, italic: false });
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [showGradientDialog, setShowGradientDialog] = useState(false);
  const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
  const [gradientStart, setGradientStart] = useState<{ x: number; y: number } | null>(null);
  const [newCanvasSize, setNewCanvasSize] = useState({ width: 1200, height: 800 });
  const [filterValues, setFilterValues] = useState({ brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sharpen: 0 });
  const [activeTab, setActiveTab] = useState<'layers' | 'history' | 'color'>('layers');

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Initialize
  useEffect(() => {
    const initialLayer: Layer = {
      id: generateId(),
      name: 'Background',
      visible: true,
      opacity: 100,
      canvas: createCanvas(canvasWidth, canvasHeight),
      blendMode: 'normal',
      locked: false,
    };
    const ctx = initialLayer.canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    setLayers([initialLayer]);
    setActiveLayerId(initialLayer.id);
    pushHistory([initialLayer], initialLayer.id);
  }, []);

  // Render composite
  const renderComposite = useCallback(() => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw checkerboard for transparency
    const size = 10;
    for (let y = 0; y < canvasHeight; y += size) {
      for (let x = 0; x < canvasWidth; x += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#cccccc' : '#ffffff';
        ctx.fillRect(x, y, size, size);
      }
    }

    // Draw layers
    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      ctx.drawImage(layer.canvas, 0, 0);
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Draw selection
    if (selection) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
      ctx.strokeStyle = '#fff';
      ctx.lineDashOffset = 5;
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
  }, [layers, canvasWidth, canvasHeight, selection]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  const pushHistory = (currentLayers: Layer[], currentActiveId: string) => {
    const state = saveHistoryState(currentLayers, currentActiveId);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const state = history[newIndex];
    const { layers: restoredLayers, activeLayerId: restoredId } = restoreHistoryState(state, canvasWidth, canvasHeight);
    setLayers(restoredLayers);
    setActiveLayerId(restoredId);
    setHistoryIndex(newIndex);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const state = history[newIndex];
    const { layers: restoredLayers, activeLayerId: restoredId } = restoreHistoryState(state, canvasWidth, canvasHeight);
    setLayers(restoredLayers);
    setActiveLayerId(restoredId);
    setHistoryIndex(newIndex);
  };

  const getActiveLayer = () => layers.find(l => l.id === activeLayerId);

  const getCanvasCoords = (e: React.MouseEvent) => {
    const mainCanvas = mainCanvasRef.current!;
    const rect = mainCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const drawLine = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, size: number, color: string, opacity: number, isEraser: boolean) => {
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
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      return;
    }

    const pos = getCanvasCoords(e);
    const activeLayer = getActiveLayer();
    if (!activeLayer || activeLayer.locked) return;

    const ctx = activeLayer.canvas.getContext('2d')!;

    switch (tool) {
      case 'brush':
      case 'eraser':
        setIsDrawing(true);
        setLastPos(pos);
        drawLine(ctx, pos, pos, brushSize, tool === 'eraser' ? '#000' : fgColor, brushOpacity, tool === 'eraser');
        renderComposite();
        break;

      case 'fill':
        floodFill(ctx, pos.x, pos.y, fgColor);
        renderComposite();
        pushHistory(layers, activeLayerId);
        break;

      case 'eyedropper': {
        const mainCanvas = mainCanvasRef.current!;
        const mainCtx = mainCanvas.getContext('2d')!;
        const pixel = mainCtx.getImageData(pos.x, pos.y, 1, 1).data;
        setFgColor(rgbaToHex(pixel[0], pixel[1], pixel[2]));
        break;
      }

      case 'select':
        setSelectionStart(pos);
        setSelection(null);
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
        if (e.shiftKey) {
          setZoom(z => Math.max(0.1, z - 0.25));
        } else {
          setZoom(z => Math.min(10, z + 0.25));
        }
        break;

      case 'blur-tool':
      case 'sharpen-tool':
        setIsDrawing(true);
        setLastPos(pos);
        applyBlurSharpen(ctx, pos, tool === 'blur-tool');
        renderComposite();
        break;

      case 'clone':
        setIsDrawing(true);
        setLastPos(pos);
        break;
    }
  };

  const applyBlurSharpen = (ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, isBlur: boolean) => {
    const radius = Math.floor(brushSize / 2);
    const x = Math.max(0, pos.x - radius);
    const y = Math.max(0, pos.y - radius);
    const w = Math.min(brushSize, ctx.canvas.width - x);
    const h = Math.min(brushSize, ctx.canvas.height - y);

    if (w <= 0 || h <= 0) return;

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }

    if (!isDrawing) return;
    const pos = getCanvasCoords(e);
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;

    switch (tool) {
      case 'brush':
      case 'eraser':
        if (lastPos) {
          drawLine(ctx, lastPos, pos, brushSize, tool === 'eraser' ? '#000' : fgColor, brushOpacity, tool === 'eraser');
          setLastPos(pos);
          renderComposite();
        }
        break;

      case 'select':
        if (selectionStart) {
          setSelection({
            x: Math.min(selectionStart.x, pos.x),
            y: Math.min(selectionStart.y, pos.y),
            w: Math.abs(pos.x - selectionStart.x),
            h: Math.abs(pos.y - selectionStart.y),
          });
          renderComposite();
        }
        break;

      case 'blur-tool':
      case 'sharpen-tool':
        applyBlurSharpen(ctx, pos, tool === 'blur-tool');
        setLastPos(pos);
        renderComposite();
        break;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }

    if (!isDrawing) return;
    const pos = getCanvasCoords(e);
    const activeLayer = getActiveLayer();
    if (!activeLayer) { setIsDrawing(false); return; }
    const ctx = activeLayer.canvas.getContext('2d')!;

    if ((tool === 'line' || tool === 'rectangle' || tool === 'ellipse') && gradientStart) {
      ctx.strokeStyle = fgColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';

      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(gradientStart.x, gradientStart.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'rectangle') {
        ctx.strokeRect(gradientStart.x, gradientStart.y, pos.x - gradientStart.x, pos.y - gradientStart.y);
      } else if (tool === 'ellipse') {
        const cx = (gradientStart.x + pos.x) / 2;
        const cy = (gradientStart.y + pos.y) / 2;
        const rx = Math.abs(pos.x - gradientStart.x) / 2;
        const ry = Math.abs(pos.y - gradientStart.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
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

      if (selection) {
        ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
      } else {
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
      renderComposite();
    }

    setIsDrawing(false);
    setLastPos(null);
    setGradientStart(null);
    setSelectionStart(null);
    pushHistory(layers, activeLayerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.max(0.1, Math.min(10, z + delta)));
    }
  };

  // Layer operations
  const addLayer = () => {
    const newLayer: Layer = {
      id: generateId(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 100,
      canvas: createCanvas(canvasWidth, canvasHeight),
      blendMode: 'normal',
      locked: false,
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
    if (activeLayerId === id) {
      setActiveLayerId(newLayers[newLayers.length - 1].id);
    }
    pushHistory(newLayers, activeLayerId === id ? newLayers[newLayers.length - 1].id : activeLayerId);
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
      id: generateId(),
      name: 'Background',
      visible: true,
      opacity: 100,
      canvas: flatCanvas,
      blendMode: 'normal',
      locked: false,
    };

    setLayers([flatLayer]);
    setActiveLayerId(flatLayer.id);
    pushHistory([flatLayer], flatLayer.id);
  };

  // File operations
  const newDocument = () => {
    const w = newCanvasSize.width;
    const h = newCanvasSize.height;
    setCanvasWidth(w);
    setCanvasHeight(h);

    const bgLayer: Layer = {
      id: generateId(),
      name: 'Background',
      visible: true,
      opacity: 100,
      canvas: createCanvas(w, h),
      blendMode: 'normal',
      locked: false,
    };
    const ctx = bgLayer.canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    setLayers([bgLayer]);
    setActiveLayerId(bgLayer.id);
    setHistory([]);
    setHistoryIndex(-1);
    setTimeout(() => pushHistory([bgLayer], bgLayer.id), 0);
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
          id: generateId(),
          name: file.name,
          visible: true,
          opacity: 100,
          canvas: createCanvas(img.width, img.height),
          blendMode: 'normal',
          locked: false,
        };
        const ctx = layer.canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        setLayers([layer]);
        setActiveLayerId(layer.id);
        setHistory([]);
        setHistoryIndex(-1);
        setTimeout(() => pushHistory([layer], layer.id), 0);
      };
      img.src = URL.createObjectURL(file);
    };
    input.click();
  };

  const saveFile = (format: 'png' | 'jpeg') => {
    const exportCanvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = exportCanvas.getContext('2d')!;
    if (format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      ctx.drawImage(layer.canvas, 0, 0);
    });
    const link = document.createElement('a');
    link.download = `image.${format}`;
    link.href = exportCanvas.toDataURL(`image/${format}`);
    link.click();
  };

  // Filters
  const applyFilter = () => {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;

    // Brightness/Contrast
    const brightnessFactor = filterValues.brightness / 100;
    const contrastFactor = filterValues.contrast / 100;
    const satFactor = filterValues.saturation / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];

      // Brightness
      r *= brightnessFactor;
      g *= brightnessFactor;
      b *= brightnessFactor;

      // Contrast
      r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
      g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
      b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;

      // Saturation
      const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
      r = gray + satFactor * (r - gray);
      g = gray + satFactor * (g - gray);
      b = gray + satFactor * (b - gray);

      // Hue rotation
      if (filterValues.hue !== 0) {
        const angle = filterValues.hue * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
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

    // Blur
    if (filterValues.blur > 0) {
      ctx.filter = `blur(${filterValues.blur}px)`;
      const tempCanvas = createCanvas(canvasWidth, canvasHeight);
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(activeLayer.canvas, 0, 0);
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
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        break;
      case 'grayscale':
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        break;
      case 'sepia':
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
          data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
          data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
        break;
      case 'threshold':
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = gray > 128 ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = val;
        }
        break;
      case 'posterize':
        const levels = 4;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.round(data[i] / 255 * levels) / levels * 255;
          data[i + 1] = Math.round(data[i + 1] / 255 * levels) / levels * 255;
          data[i + 2] = Math.round(data[i + 2] / 255 * levels) / levels * 255;
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
    ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    renderComposite();
    pushHistory(layers, activeLayerId);
  };

  const fillSelection = () => {
    if (!selection) return;
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    ctx.fillStyle = fgColor;
    ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
    renderComposite();
    pushHistory(layers, activeLayerId);
  };

  const selectAll = () => {
    setSelection({ x: 0, y: 0, w: canvasWidth, h: canvasHeight });
    renderComposite();
  };

  const deselectAll = () => {
    setSelection(null);
    renderComposite();
  };

  // Text
  const applyText = () => {
    const activeLayer = getActiveLayer();
    if (!activeLayer || !textOptions.text) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    let fontStr = '';
    if (textOptions.italic) fontStr += 'italic ';
    if (textOptions.bold) fontStr += 'bold ';
    fontStr += `${textOptions.size}px ${textOptions.font}`;
    ctx.font = fontStr;
    ctx.fillStyle = textOptions.color;
    ctx.fillText(textOptions.text, textPosition.x, textPosition.y);
    renderComposite();
    pushHistory(layers, activeLayerId);
    setShowTextDialog(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); selectAll(); }
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); deselectAll(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveFile('png'); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); openFile(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setShowNewDialog(true); }
      if (e.key === 'Delete' && selection) { deleteSelection(); }
      if (e.key === 'b') setTool('brush');
      if (e.key === 'e') setTool('eraser');
      if (e.key === 'g') setTool('fill');
      if (e.key === 'i') setTool('eyedropper');
      if (e.key === 't') setTool('text');
      if (e.key === 'v') setTool('move');
      if (e.key === 'm') setTool('select');
      if (e.key === 'u') setTool('line');
      if (e.key === 'z' && !e.ctrlKey) setTool('zoom');
      if (e.key === '[') setBrushSize(s => Math.max(1, s - 2));
      if (e.key === ']') setBrushSize(s => Math.min(200, s + 2));
      if (e.key === 'x') { const temp = fgColor; setFgColor(bgColor); setBgColor(temp); }
      if (e.key === 'd') { setFgColor('#000000'); setBgColor('#ffffff'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, layers, activeLayerId, selection, fgColor, bgColor]);

  const tools: { id: Tool; icon: string; label: string; shortcut: string }[] = [
    { id: 'move', icon: '✥', label: 'Move', shortcut: 'V' },
    { id: 'select', icon: '⬚', label: 'Rectangular Select', shortcut: 'M' },
    { id: 'brush', icon: '🖌', label: 'Brush', shortcut: 'B' },
    { id: 'eraser', icon: '◻', label: 'Eraser', shortcut: 'E' },
    { id: 'fill', icon: '🪣', label: 'Paint Bucket', shortcut: 'G' },
    { id: 'eyedropper', icon: '💧', label: 'Eyedropper', shortcut: 'I' },
    { id: 'text', icon: 'T', label: 'Text', shortcut: 'T' },
    { id: 'gradient', icon: '🌈', label: 'Gradient', shortcut: '' },
    { id: 'line', icon: '╱', label: 'Line', shortcut: 'U' },
    { id: 'rectangle', icon: '▭', label: 'Rectangle', shortcut: '' },
    { id: 'ellipse', icon: '◯', label: 'Ellipse', shortcut: '' },
    { id: 'blur-tool', icon: '💨', label: 'Blur', shortcut: '' },
    { id: 'sharpen-tool', icon: '△', label: 'Sharpen', shortcut: '' },
    { id: 'crop', icon: '⬒', label: 'Crop', shortcut: 'C' },
    { id: 'zoom', icon: '🔍', label: 'Zoom', shortcut: 'Z' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-gray-200 overflow-hidden select-none">
      {/* Menu Bar */}
      <div className="h-8 bg-[#2d2d2d] border-b border-[#3d3d3d] flex items-center px-2 text-xs gap-1 shrink-0">
        <div className="flex items-center gap-1">
          <span className="font-bold text-blue-400 mr-2">PhotoEditor Pro</span>
        </div>
        <div className="relative group">
          <button className="px-2 py-1 hover:bg-[#3d3d3d] rounded">File</button>
          <div className="absolute top-full left-0 bg-[#2d2d2d] border border-[#3d3d3d] rounded shadow-lg hidden group-hover:block z-50 min-w-[180px]">
            <button onClick={() => setShowNewDialog(true)} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">New... <span className="text-gray-500 float-right">Ctrl+N</span></button>
            <button onClick={openFile} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Open... <span className="text-gray-500 float-right">Ctrl+O</span></button>
            <div className="border-t border-[#3d3d3d] my-1"></div>
            <button onClick={() => saveFile('png')} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Save as PNG <span className="text-gray-500 float-right">Ctrl+S</span></button>
            <button onClick={() => saveFile('jpeg')} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Save as JPEG</button>
          </div>
        </div>
        <div className="relative group">
          <button className="px-2 py-1 hover:bg-[#3d3d3d] rounded">Edit</button>
          <div className="absolute top-full left-0 bg-[#2d2d2d] border border-[#3d3d3d] rounded shadow-lg hidden group-hover:block z-50 min-w-[180px]">
            <button onClick={undo} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Undo <span className="text-gray-500 float-right">Ctrl+Z</span></button>
            <button onClick={redo} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Redo <span className="text-gray-500 float-right">Ctrl+Y</span></button>
            <div className="border-t border-[#3d3d3d] my-1"></div>
            <button onClick={selectAll} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Select All <span className="text-gray-500 float-right">Ctrl+A</span></button>
            <button onClick={deselectAll} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Deselect <span className="text-gray-500 float-right">Ctrl+D</span></button>
            <button onClick={deleteSelection} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Delete Selection <span className="text-gray-500 float-right">Del</span></button>
            <button onClick={fillSelection} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Fill Selection</button>
          </div>
        </div>
        <div className="relative group">
          <button className="px-2 py-1 hover:bg-[#3d3d3d] rounded">Image</button>
          <div className="absolute top-full left-0 bg-[#2d2d2d] border border-[#3d3d3d] rounded shadow-lg hidden group-hover:block z-50 min-w-[180px]">
            <button onClick={() => setShowResizeDialog(true)} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Canvas Size...</button>
            <button onClick={flattenImage} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Flatten Image</button>
          </div>
        </div>
        <div className="relative group">
          <button className="px-2 py-1 hover:bg-[#3d3d3d] rounded">Filter</button>
          <div className="absolute top-full left-0 bg-[#2d2d2d] border border-[#3d3d3d] rounded shadow-lg hidden group-hover:block z-50 min-w-[200px]">
            <button onClick={() => setShowFilters(true)} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Adjustments...</button>
            <div className="border-t border-[#3d3d3d] my-1"></div>
            <button onClick={() => applyQuickFilter('invert')} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Invert</button>
            <button onClick={() => applyQuickFilter('grayscale')} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Grayscale</button>
            <button onClick={() => applyQuickFilter('sepia')} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Sepia</button>
            <button onClick={() => applyQuickFilter('threshold')} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Threshold</button>
            <button onClick={() => applyQuickFilter('posterize')} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Posterize</button>
          </div>
        </div>
        <div className="relative group">
          <button className="px-2 py-1 hover:bg-[#3d3d3d] rounded">View</button>
          <div className="absolute top-full left-0 bg-[#2d2d2d] border border-[#3d3d3d] rounded shadow-lg hidden group-hover:block z-50 min-w-[150px]">
            <button onClick={() => setZoom(1)} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">100%</button>
            <button onClick={() => setZoom(z => Math.min(10, z + 0.25))} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Zoom In</button>
            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.25))} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Zoom Out</button>
            <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="block w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d]">Fit to Screen</button>
          </div>
        </div>
        <div className="ml-auto text-gray-400">
          {canvasWidth} × {canvasHeight} px | {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Options Bar */}
      <div className="h-10 bg-[#2a2a2a] border-b border-[#3d3d3d] flex items-center px-3 gap-4 text-xs shrink-0">
        <span className="text-gray-400">Size:</span>
        <input type="range" min="1" max="200" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-24 accent-blue-500" />
        <span className="w-8">{brushSize}</span>
        <span className="text-gray-400">Opacity:</span>
        <input type="range" min="1" max="100" value={brushOpacity} onChange={e => setBrushOpacity(Number(e.target.value))} className="w-20 accent-blue-500" />
        <span className="w-8">{brushOpacity}%</span>
        {(tool === 'brush' || tool === 'eraser') && (
          <>
            <span className="text-gray-400">Hardness:</span>
            <input type="range" min="0" max="100" value={brushHardness} onChange={e => setBrushHardness(Number(e.target.value))} className="w-20 accent-blue-500" />
            <span className="w-8">{brushHardness}%</span>
          </>
        )}
        {tool === 'gradient' && (
          <>
            <span className="text-gray-400">Type:</span>
            <select value={gradientType} onChange={e => setGradientType(e.target.value as any)} className="bg-[#3d3d3d] text-white px-2 py-0.5 rounded border border-[#555]">
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
            </select>
          </>
        )}
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-12 bg-[#2d2d2d] border-r border-[#3d3d3d] flex flex-col items-center py-2 gap-0.5 shrink-0 overflow-y-auto">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`w-9 h-9 flex items-center justify-center rounded text-base transition-colors ${tool === t.id ? 'bg-[#4a90d9] text-white' : 'hover:bg-[#3d3d3d] text-gray-300'}`}
              title={`${t.label} (${t.shortcut})`}
            >
              {t.icon}
            </button>
          ))}
          <div className="mt-4 flex flex-col items-center gap-1">
            <div className="relative w-8 h-8">
              <div
                className="absolute bottom-0 right-0 w-6 h-6 border-2 border-[#555] rounded-sm cursor-pointer"
                style={{ backgroundColor: bgColor }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'color';
                  input.value = bgColor;
                  input.onchange = () => setBgColor(input.value);
                  input.click();
                }}
                title="Background Color"
              />
              <div
                className="absolute top-0 left-0 w-6 h-6 border-2 border-[#555] rounded-sm cursor-pointer z-10"
                style={{ backgroundColor: fgColor }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'color';
                  input.value = fgColor;
                  input.onchange = () => setFgColor(input.value);
                  input.click();
                }}
                title="Foreground Color"
              />
            </div>
            <button
              onClick={() => { const t = fgColor; setFgColor(bgColor); setBgColor(t); }}
              className="text-xs text-gray-400 hover:text-white"
              title="Swap Colors (X)"
            >⇄</button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden bg-[#1a1a1a] relative flex items-center justify-center"
          onWheel={handleWheel}
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
              className="shadow-2xl cursor-crosshair"
              style={{ imageRendering: zoom > 2 ? 'pixelated' : 'auto' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => { if (isDrawing) { setIsDrawing(false); pushHistory(layers, activeLayerId); } }}
            />
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-64 bg-[#2d2d2d] border-l border-[#3d3d3d] flex flex-col shrink-0 overflow-hidden">
          {/* Panel Tabs */}
          <div className="flex border-b border-[#3d3d3d]">
            <button onClick={() => setActiveTab('color')} className={`flex-1 px-2 py-1.5 text-xs ${activeTab === 'color' ? 'bg-[#3d3d3d] text-white' : 'text-gray-400 hover:text-white'}`}>Color</button>
            <button onClick={() => setActiveTab('layers')} className={`flex-1 px-2 py-1.5 text-xs ${activeTab === 'layers' ? 'bg-[#3d3d3d] text-white' : 'text-gray-400 hover:text-white'}`}>Layers</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 px-2 py-1.5 text-xs ${activeTab === 'history' ? 'bg-[#3d3d3d] text-white' : 'text-gray-400 hover:text-white'}`}>History</button>
          </div>

          {activeTab === 'color' && (
            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Foreground</label>
                <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Background</label>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
              </div>
              <button onClick={() => { setFgColor('#000000'); setBgColor('#ffffff'); }} className="w-full text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] py-1 rounded">Default Colors (D)</button>
              <button onClick={() => { const t = fgColor; setFgColor(bgColor); setBgColor(t); }} className="w-full text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] py-1 rounded">Swap (X)</button>
              <div className="mt-4">
                <label className="text-xs text-gray-400 block mb-1">Quick Colors</label>
                <div className="grid grid-cols-8 gap-0.5">
                  {['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff',
                    '#800000','#808000','#008000','#800080','#008080','#000080','#ff8000','#808080',
                    '#c0c0c0','#ff4444','#44ff44','#4444ff','#ffaa00','#aa00ff','#00aaaa','#ff66aa'].map(c => (
                    <div key={c} className="w-5 h-5 rounded-sm cursor-pointer border border-[#555] hover:border-white" style={{ backgroundColor: c }} onClick={() => setFgColor(c)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'layers' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Active layer properties */}
              {getActiveLayer() && (
                <div className="p-2 border-b border-[#3d3d3d] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Blend:</span>
                    <select
                      value={getActiveLayer()!.blendMode}
                      onChange={e => updateLayerProperty(activeLayerId, 'blendMode', e.target.value)}
                      className="flex-1 bg-[#3d3d3d] text-white text-xs px-1 py-0.5 rounded border border-[#555]"
                    >
                      {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Opacity:</span>
                    <input type="range" min="0" max="100" value={getActiveLayer()!.opacity} onChange={e => updateLayerProperty(activeLayerId, 'opacity', Number(e.target.value))} className="flex-1 accent-blue-500" />
                    <span className="text-xs w-8">{getActiveLayer()!.opacity}%</span>
                  </div>
                </div>
              )}

              {/* Layer list */}
              <div className="flex-1 overflow-y-auto">
                {[...layers].reverse().map(layer => (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayerId(layer.id)}
                    className={`flex items-center gap-1 px-2 py-1.5 border-b border-[#3d3d3d] cursor-pointer ${layer.id === activeLayerId ? 'bg-[#4a90d9]' : 'hover:bg-[#3d3d3d]'}`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); updateLayerProperty(layer.id, 'visible', !layer.visible); }}
                      className="text-sm w-5"
                    >
                      {layer.visible ? '👁' : '—'}
                    </button>
                    <div className="w-8 h-8 bg-[#444] rounded border border-[#555] overflow-hidden shrink-0">
                      <canvas
                        ref={el => {
                          if (el) {
                            const ctx = el.getContext('2d')!;
                            ctx.clearRect(0, 0, 32, 32);
                            ctx.drawImage(layer.canvas, 0, 0, 32, 32);
                          }
                        }}
                        width={32}
                        height={32}
                        className="w-full h-full"
                      />
                    </div>
                    <span className="text-xs truncate flex-1">{layer.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateLayerProperty(layer.id, 'locked', !layer.locked); }}
                      className="text-xs"
                      title={layer.locked ? 'Unlock' : 'Lock'}
                    >
                      {layer.locked ? '🔒' : '🔓'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Layer actions */}
              <div className="p-2 border-t border-[#3d3d3d] flex gap-1 flex-wrap">
                <button onClick={addLayer} className="flex-1 text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] py-1 rounded" title="New Layer">+ New</button>
                <button onClick={() => duplicateLayer(activeLayerId)} className="flex-1 text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] py-1 rounded" title="Duplicate">⧉ Dup</button>
                <button onClick={() => deleteLayer(activeLayerId)} className="flex-1 text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] py-1 rounded" title="Delete">🗑 Del</button>
                <button onClick={() => moveLayer(activeLayerId, 'up')} className="text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] px-2 py-1 rounded" title="Move Up">↑</button>
                <button onClick={() => moveLayer(activeLayerId, 'down')} className="text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] px-2 py-1 rounded" title="Move Down">↓</button>
                <button onClick={() => mergeDown(activeLayerId)} className="text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] px-2 py-1 rounded" title="Merge Down">⤓</button>
                <button onClick={flattenImage} className="text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] px-2 py-1 rounded" title="Flatten">⊟</button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-2">
              {history.map((h, i) => (
                <div
                  key={i}
                  onClick={() => {
                    const state = h;
                    const { layers: restoredLayers, activeLayerId: restoredId } = restoreHistoryState(state, canvasWidth, canvasHeight);
                    setLayers(restoredLayers);
                    setActiveLayerId(restoredId);
                    setHistoryIndex(i);
                  }}
                  className={`px-2 py-1 text-xs cursor-pointer rounded mb-0.5 ${i === historyIndex ? 'bg-[#4a90d9]' : 'hover:bg-[#3d3d3d]'}`}
                >
                  Step {i + 1}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-[#2d2d2d] border-t border-[#3d3d3d] flex items-center px-3 text-xs text-gray-400 shrink-0">
        <span>Tool: {tools.find(t => t.id === tool)?.label}</span>
        <span className="mx-4">|</span>
        <span>Layer: {getActiveLayer()?.name || 'None'}</span>
        <span className="mx-4">|</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span className="ml-auto">Alt+Drag to pan | Ctrl+Scroll to zoom</span>
      </div>

      {/* Filter Dialog */}
      {showFilters && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2d2d2d] rounded-lg p-6 w-96 border border-[#555]">
            <h3 className="text-lg font-bold mb-4">Adjustments</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 flex justify-between"><span>Brightness</span><span>{filterValues.brightness}%</span></label>
                <input type="range" min="0" max="200" value={filterValues.brightness} onChange={e => setFilterValues({ ...filterValues, brightness: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 flex justify-between"><span>Contrast</span><span>{filterValues.contrast}%</span></label>
                <input type="range" min="0" max="200" value={filterValues.contrast} onChange={e => setFilterValues({ ...filterValues, contrast: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 flex justify-between"><span>Saturation</span><span>{filterValues.saturation}%</span></label>
                <input type="range" min="0" max="200" value={filterValues.saturation} onChange={e => setFilterValues({ ...filterValues, saturation: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 flex justify-between"><span>Hue Rotate</span><span>{filterValues.hue}°</span></label>
                <input type="range" min="0" max="360" value={filterValues.hue} onChange={e => setFilterValues({ ...filterValues, hue: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 flex justify-between"><span>Blur</span><span>{filterValues.blur}px</span></label>
                <input type="range" min="0" max="20" value={filterValues.blur} onChange={e => setFilterValues({ ...filterValues, blur: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowFilters(false)} className="px-4 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] rounded text-sm">Cancel</button>
              <button onClick={applyFilter} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* New Document Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2d2d2d] rounded-lg p-6 w-80 border border-[#555]">
            <h3 className="text-lg font-bold mb-4">New Document</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Width (px)</label>
                <input type="number" value={newCanvasSize.width} onChange={e => setNewCanvasSize({ ...newCanvasSize, width: Number(e.target.value) })} className="w-full bg-[#1e1e1e] border border-[#555] rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Height (px)</label>
                <input type="number" value={newCanvasSize.height} onChange={e => setNewCanvasSize({ ...newCanvasSize, height: Number(e.target.value) })} className="w-full bg-[#1e1e1e] border border-[#555] rounded px-2 py-1 text-sm" />
              </div>
              <div className="flex gap-2">
                {[{ l: 'HD', w: 1280, h: 720 }, { l: 'FHD', w: 1920, h: 1080 }, { l: 'Square', w: 1024, h: 1024 }, { l: 'A4', w: 2480, h: 3508 }].map(p => (
                  <button key={p.l} onClick={() => setNewCanvasSize({ width: p.w, height: p.h })} className="flex-1 text-xs bg-[#3d3d3d] hover:bg-[#4d4d4d] py-1 rounded">{p.l}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowNewDialog(false)} className="px-4 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] rounded text-sm">Cancel</button>
              <button onClick={newDocument} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Resize Dialog */}
      {showResizeDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2d2d2d] rounded-lg p-6 w-80 border border-[#555]">
            <h3 className="text-lg font-bold mb-4">Canvas Size</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Width (px)</label>
                <input type="number" value={newCanvasSize.width} onChange={e => setNewCanvasSize({ ...newCanvasSize, width: Number(e.target.value) })} className="w-full bg-[#1e1e1e] border border-[#555] rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Height (px)</label>
                <input type="number" value={newCanvasSize.height} onChange={e => setNewCanvasSize({ ...newCanvasSize, height: Number(e.target.value) })} className="w-full bg-[#1e1e1e] border border-[#555] rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowResizeDialog(false)} className="px-4 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] rounded text-sm">Cancel</button>
              <button onClick={() => {
                const newW = newCanvasSize.width;
                const newH = newCanvasSize.height;
                const newLayers = layers.map(l => {
                  const newCanvas = createCanvas(newW, newH);
                  const ctx = newCanvas.getContext('2d')!;
                  ctx.drawImage(l.canvas, 0, 0);
                  return { ...l, canvas: newCanvas };
                });
                setCanvasWidth(newW);
                setCanvasHeight(newH);
                setLayers(newLayers);
                pushHistory(newLayers, activeLayerId);
                setShowResizeDialog(false);
              }} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Text Dialog */}
      {showTextDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2d2d2d] rounded-lg p-6 w-96 border border-[#555]">
            <h3 className="text-lg font-bold mb-4">Add Text</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Text</label>
                <input type="text" value={textOptions.text} onChange={e => setTextOptions({ ...textOptions, text: e.target.value })} className="w-full bg-[#1e1e1e] border border-[#555] rounded px-2 py-1 text-sm" placeholder="Enter text..." />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Font</label>
                  <select value={textOptions.font} onChange={e => setTextOptions({ ...textOptions, font: e.target.value })} className="w-full bg-[#1e1e1e] border border-[#555] rounded px-2 py-1 text-sm">
                    <option>Arial</option>
                    <option>Times New Roman</option>
                    <option>Courier New</option>
                    <option>Georgia</option>
                    <option>Verdana</option>
                    <option>Impact</option>
                    <option>Comic Sans MS</option>
                  </select>
                </div>
                <div className="w-20">
                  <label className="text-xs text-gray-400 block mb-1">Size</label>
                  <input type="number" value={textOptions.size} onChange={e => setTextOptions({ ...textOptions, size: Number(e.target.value) })} className="w-full bg-[#1e1e1e] border border-[#555] rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-xs text-gray-400">Color:</label>
                <input type="color" value={textOptions.color} onChange={e => setTextOptions({ ...textOptions, color: e.target.value })} className="h-7 w-12 rounded cursor-pointer" />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={textOptions.bold} onChange={e => setTextOptions({ ...textOptions, bold: e.target.checked })} /> Bold
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={textOptions.italic} onChange={e => setTextOptions({ ...textOptions, italic: e.target.checked })} /> Italic
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowTextDialog(false)} className="px-4 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] rounded text-sm">Cancel</button>
              <button onClick={applyText} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">Add Text</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
