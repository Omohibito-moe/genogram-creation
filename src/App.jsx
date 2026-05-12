import { useState, useCallback, useRef } from 'react';
import InputPanel from './components/InputPanel';
import GenogramCanvas from './components/GenogramCanvas';
import EditPanel from './components/EditPanel';
import './App.css';

const EMPTY_DATA = { nodes: [], relations: [] };

function nextNodeId(nodes) {
  const nums = nodes.map((n) => parseInt(n.id.slice(1))).filter(Number.isFinite);
  return `n${nums.length > 0 ? Math.max(...nums) + 1 : 1}`;
}

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputOpen, setInputOpen] = useState(true);

  // Selection
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedRelIndex, setSelectedRelIndex] = useState(null);

  // Connect mode
  const [mode, setMode] = useState('select'); // 'select' | 'connect'
  const [connectSource, setConnectSource] = useState(null);

  const svgRef = useRef(null);

  // ── core data helpers ──────────────────────────────────────────────────────

  const updateData = useCallback((newData) => setData(newData), []);

  const updateNode = useCallback(
    (id, changes) =>
      updateData({ ...data, nodes: data.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n)) }),
    [data, updateData]
  );

  const addNode = useCallback(() => {
    const id = nextNodeId(data.nodes);
    const gen0Count = data.nodes.filter((n) => (n.generation ?? 0) === 0).length;
    const newNode = {
      id, sex: 'M', age: null, label: '新規', dead: false, self: false,
      generation: 0, sibling_order: gen0Count,
    };
    updateData({ ...data, nodes: [...data.nodes, newNode] });
    setSelectedNodeId(id);
    setSelectedRelIndex(null);
  }, [data, updateData]);

  const deleteNode = useCallback(
    (id) => {
      updateData({
        nodes: data.nodes.filter((n) => n.id !== id),
        relations: data.relations.filter((r) => r.from !== id && r.to !== id),
      });
      setSelectedNodeId(null);
    },
    [data, updateData]
  );

  const updateRelation = useCallback(
    (index, changes) =>
      updateData({
        ...data,
        relations: data.relations.map((r, i) => (i === index ? { ...r, ...changes } : r)),
      }),
    [data, updateData]
  );

  const addRelation = useCallback(
    (fromId, toId) => {
      const newRel = { from: fromId, to: toId, type: 'close', note: '' };
      const newIndex = data.relations.length;
      updateData({ ...data, relations: [...data.relations, newRel] });
      setSelectedRelIndex(newIndex);
      setSelectedNodeId(null);
    },
    [data, updateData]
  );

  const deleteRelation = useCallback(
    (index) => {
      updateData({ ...data, relations: data.relations.filter((_, i) => i !== index) });
      setSelectedRelIndex(null);
    },
    [data, updateData]
  );

  const handleNodeMove = useCallback(
    (id, x, y) => updateNode(id, { x, y }),
    [updateNode]
  );

  // ── connect mode ───────────────────────────────────────────────────────────

  const handleConnectStep = useCallback(
    (nodeId) => {
      if (!connectSource) {
        setConnectSource(nodeId);
      } else if (connectSource === nodeId) {
        setConnectSource(null);
      } else {
        addRelation(connectSource, nodeId);
        setConnectSource(null);
        setMode('select');
      }
    },
    [connectSource, addRelation]
  );

  const startConnect = () => {
    setMode('connect');
    setConnectSource(null);
    setSelectedNodeId(null);
    setSelectedRelIndex(null);
  };

  const cancelConnect = () => {
    setMode('select');
    setConnectSource(null);
  };

  // ── canvas selection ───────────────────────────────────────────────────────

  const handleNodeClick = useCallback((id) => {
    setSelectedNodeId(id);
    setSelectedRelIndex(null);
  }, []);

  const handleRelClick = useCallback((index) => {
    setSelectedRelIndex(index);
    setSelectedNodeId(null);
  }, []);

  const handleCanvasClick = useCallback(() => {
    if (mode === 'select') {
      setSelectedNodeId(null);
      setSelectedRelIndex(null);
    }
  }, [mode]);

  // ── analyze ───────────────────────────────────────────────────────────────

  const handleAnalyze = async (text) => {
    setLoading(true);
    setError('');
    setSelectedNodeId(null);
    setSelectedRelIndex(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'APIエラーが発生しました');
      updateData(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── export ─────────────────────────────────────────────────────────────────

  const exportPNG = () => {
    const svg = document.getElementById('genogram-svg');
    if (!svg) return;
    const w = svg.getAttribute('width');
    const h = svg.getAttribute('height');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = 'genogram.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      URL.revokeObjectURL(img.src);
    };
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(blob);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'genogram.json';
    a.click();
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        updateData(parsed);
        setSelectedNodeId(null);
        setSelectedRelIndex(null);
      } catch {
        setError('JSONファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── delete shortcut ────────────────────────────────────────────────────────

  const canDelete = selectedNodeId !== null || selectedRelIndex !== null;
  const handleDelete = () => {
    if (selectedNodeId) deleteNode(selectedNodeId);
    else if (selectedRelIndex !== null) deleteRelation(selectedRelIndex);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">ジェノグラム自動描画ツール</h1>
        <div className="warning-banner">
          ⚠️ 入力内容はClaude API（Anthropic）に送信されます。
          <strong>実在する個人の氏名・生年月日等の個人情報は入力しないでください。</strong>
          仮名・仮データのみ使用してください。
        </div>
      </header>

      <main className="app-main">
        {/* Collapsible input */}
        <section className="section">
          <button className="collapse-toggle" onClick={() => setInputOpen((o) => !o)}>
            {inputOpen ? '▲' : '▼'} 自然文から解析（Claude API）
          </button>
          {inputOpen && (
            <>
              <InputPanel onAnalyze={handleAnalyze} loading={loading} />
              {error && <div className="error-msg">{error}</div>}
            </>
          )}
        </section>

        {/* Toolbar */}
        <div className="toolbar">
          <button className="btn" onClick={addNode}>＋ ノード追加</button>
          {mode === 'select' ? (
            <button className="btn" onClick={startConnect}>🔗 接続</button>
          ) : (
            <button className="btn btn-active" onClick={cancelConnect}>✕ キャンセル</button>
          )}
          <button className="btn btn-danger-outline" onClick={handleDelete} disabled={!canDelete}>
            🗑 削除
          </button>
          <div className="toolbar-spacer" />
          <button className="btn" onClick={exportPNG}>PNG書き出し</button>
          <button className="btn" onClick={exportJSON}>JSON保存</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            JSON読込
            <input type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Canvas + Edit Panel */}
        <div className="canvas-edit-row">
          <div className="canvas-col">
            <GenogramCanvas
              ref={svgRef}
              data={data}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              selectedRelIndex={selectedRelIndex}
              onRelClick={handleRelClick}
              onCanvasClick={handleCanvasClick}
              mode={mode}
              connectSource={connectSource}
              onConnectStep={handleConnectStep}
              onNodeMove={handleNodeMove}
            />
          </div>
          <div className="edit-col">
            <EditPanel
              selectedNodeId={selectedNodeId}
              selectedRelIndex={selectedRelIndex}
              nodes={data.nodes}
              relations={data.relations}
              onUpdateNode={updateNode}
              onUpdateRelation={updateRelation}
              onDeleteNode={deleteNode}
              onDeleteRelation={deleteRelation}
            />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <small>個人試作ツール — データはサーバに保存されません</small>
      </footer>
    </div>
  );
}
