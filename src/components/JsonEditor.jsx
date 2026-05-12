export default function JsonEditor({ value, onChange, onApply }) {
  return (
    <div className="json-editor">
      <div className="json-editor-header">
        <span>解析結果 JSON（手動編集可能）</span>
        <span className="json-hint">LLMの誤りはここで直接修正できます</span>
      </div>
      <textarea
        className="json-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        rows={16}
      />
      <div className="json-buttons">
        <button className="btn btn-primary" onClick={onApply}>
          反映（再描画）
        </button>
      </div>
    </div>
  );
}
