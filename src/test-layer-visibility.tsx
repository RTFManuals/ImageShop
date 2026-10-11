import React, { useState, useEffect, useCallback, useRef } from 'react';

interface TestLayer {
  id: string;
  name: string;
  visible: boolean;
}

export default function TestLayerVisibility() {
  const [layers, setLayers] = useState<TestLayer[]>([
    { id: '1', name: 'Layer 1', visible: true },
    { id: '2', name: 'Layer 2', visible: true },
  ]);
  
  const renderCount = useRef(0);
  const lastLayersRef = useRef(layers);
  
  renderCount.current += 1;
  
  const renderComposite = useCallback(() => {
    console.log('🎨 renderComposite вызвана');
    console.log('  layers:', layers.map(l => ({ id: l.id, visible: l.visible })));
    console.log('  Render count:', renderCount.current);
  }, [layers]);
  
  useEffect(() => {
    console.log('📊 useEffect сработал');
    console.log('  layers изменились:', lastLayersRef.current !== layers);
    console.log('  Текущие layers:', layers.map(l => ({ id: l.id, visible: l.visible })));
    lastLayersRef.current = layers;
    renderComposite();
  }, [renderComposite]);
  
  const updateLayerProperty = (id: string, prop: keyof TestLayer, value: any) => {
    console.log('🔄 updateLayerProperty вызвана');
    console.log('  id:', id, 'prop:', prop, 'value:', value);
    setLayers(prev => {
      const newLayers = prev.map(l => l.id === id ? { ...l, [prop]: value } : l);
      console.log('  Новые layers:', newLayers.map(l => ({ id: l.id, visible: l.visible })));
      return newLayers;
    });
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Тест переключения видимости слоёв</h2>
      <p>Render count: {renderCount.current}</p>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Слои:</h3>
        {[...layers].reverse().map(layer => (
          <div key={layer.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc' }}>
            <button 
              onClick={() => {
                console.log('👆 Клик на глаз для слоя:', layer.id);
                console.log('  Текущее visible:', layer.visible);
                console.log('  Новое visible:', !layer.visible);
                updateLayerProperty(layer.id, 'visible', !layer.visible);
              }}
              style={{ marginRight: '10px' }}
            >
              {layer.visible ? '👁' : '—'}
            </button>
            <span>{layer.name}</span>
            <span style={{ marginLeft: '10px', color: layer.visible ? 'green' : 'red' }}>
              ({layer.visible ? 'видимый' : 'скрытый'})
            </span>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
        <h3>Canvas (симуляция):</h3>
        {layers.filter(l => l.visible).map(layer => (
          <div key={layer.id} style={{ padding: '5px', background: '#ddd', margin: '5px 0' }}>
            {layer.name} отображается на canvas
          </div>
        ))}
        {layers.filter(l => l.visible).length === 0 && (
          <div style={{ color: 'red' }}>Ничего не отображается</div>
        )}
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Отладочная информация:</h3>
        <pre style={{ background: '#000', color: '#0f0', padding: '10px', fontSize: '11px' }}>
          {JSON.stringify({
            layers: layers.map(l => ({ id: l.id, visible: l.visible })),
            renderCount: renderCount.current,
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
