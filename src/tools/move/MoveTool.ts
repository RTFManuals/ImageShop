import { BaseTool, EditorPointerEvent, ToolContext } from '../../core/tools/Tool';

export class MoveTool extends BaseTool {
  readonly id = 'move';
  readonly name = 'Move Tool';
  readonly cursor = 'move';

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private layerStartX = 0;
  private layerStartY = 0;

  onPointerDown(event: EditorPointerEvent, context: ToolContext): void {
    const activeLayer = context.getActiveLayer();
    if (!activeLayer || activeLayer.locked) {
      return;
    }

    this.isDragging = true;
    this.startX = event.x;
    this.startY = event.y;
    
    // Получаем начальную позицию слоя
    const transform = activeLayer.transform;
    this.layerStartX = transform?.x || 0;
    this.layerStartY = transform?.y || 0;
  }

  onPointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDragging) {
      return;
    }

    const activeLayer = context.getActiveLayer();
    if (!activeLayer) {
      return;
    }

    // Вычисляем смещение
    const dx = event.x - this.startX;
    const dy = event.y - this.startY;

    // Обновляем позицию слоя
    const newTransform = {
      ...(activeLayer.transform || {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        skewY: 0,
      }),
      x: this.layerStartX + dx,
      y: this.layerStartY + dy,
    };

    // Обновляем документ
    const document = context.getDocument();
    const updatedDocument = document.updateLayer(activeLayer.id, {
      transform: newTransform,
    });

    context.setDocument(updatedDocument);
    context.requestRender();
  }

  onPointerUp(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.isDragging) {
      return;
    }

    this.isDragging = false;

    // Создаём команду для undo
    const activeLayer = context.getActiveLayer();
    if (!activeLayer) {
      return;
    }

    // TODO: Создать MoveLayerCommand и добавить в историю
    // context.executeCommand(new MoveLayerCommand(...));
  }

  deactivate(context: ToolContext): void {
    this.isDragging = false;
  }
}
