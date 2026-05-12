import { useState } from 'react';
import InputPanel from './components/InputPanel';
import JsonEditor from './components/JsonEditor';
import GenogramCanvas from './components/GenogramCanvas';
import './App.css';

const EMPTY_DATA = { nodes: [], relations: [] };

export default function App() {
  const [genogramData, setGenogramData] = useState(EMPTY_DATA);
  const [jsonText, setJsonText] = useState(JSON.stringify(EMPTY_DATA, null, 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jsonError, setJsonError] = useState('');

  const handleAnalyze = async (text) => {
    setLoading(true);
    setError('');
    setJsonError('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'APIエラーが発生しました');
      setGenogramData(body);
      setJsonText(JSON.stringify(body, null, 2));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJsonApply = () => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.relations)) {
        throw new Error('nodes と relations の配列が必要です');
      }
      setGenogramData(parsed);
    } catch (e) {
      setJsonError('JSON形式エラー: ' + e.message);
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'genogram.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setJsonText(text);
      setJsonError('');
      try {
        const parsed = JSON.parse(text);
        setGenogramData(parsed);
      } catch {
        setJsonError('読み込んだファイルのJSON形式が不正です');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">ジェノグラム自動描画ツール</h1>
        <div className="warning-banner">
          ⚠️ 入力内容はClaude API（Anthropic）に送信されます。<strong>実在する個人の氏名・生年月日等の個人情報は入力しないでください。</strong>仮名・仮データのみ使用してください。
        </div>
      </header>

      <main className="app-main">
        {/* Input section */}
        <section className="section">
          <InputPanel onAnalyze={handleAnalyze} loading={loading} />
          {error && <div className="error-msg">{error}</div>}
        </section>

        {/* Canvas section */}
        <section className="section">
          <h2 className="section-title">ジェノグラム</h2>
          <GenogramCanvas data={genogramData} />
        </section>

        {/* JSON editor section */}
        <section className="section">
          <JsonEditor value={jsonText} onChange={setJsonText} onApply={handleJsonApply} />
          {jsonError && <div className="error-msg">{jsonError}</div>}
          <div className="export-row">
            <button className="btn" onClick={handleExportJSON}>
              JSONを保存
            </button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              JSONを読み込む
              <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
            </label>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <small>個人試作ツール — データはサーバに保存されません</small>
      </footer>
    </div>
  );
}
