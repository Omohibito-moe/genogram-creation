import { useState } from 'react';

const EXAMPLE_TEXT =
  '本人は55歳男性、要介護2。妻52歳、長女17歳高校生、長男は3年前に48歳で他界。父は80歳で要介護3、母は75歳で5年前死去。本人と末弟（45歳）は疎遠。長女は本人にとても懐いている。';

export default function InputPanel({ onAnalyze, loading }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) onAnalyze(text);
  };

  return (
    <form onSubmit={handleSubmit} className="input-panel">
      <label htmlFor="family-text" className="input-label">
        家族構成を自然文で入力してください
      </label>
      <textarea
        id="family-text"
        className="input-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE_TEXT}
        rows={6}
        disabled={loading}
      />
      <div className="input-row">
        <button type="submit" className="btn btn-primary" disabled={loading || !text.trim()}>
          {loading ? '解析中…' : '解析してジェノグラムを生成'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setText(EXAMPLE_TEXT)}
          disabled={loading}
        >
          サンプルを入力
        </button>
      </div>
    </form>
  );
}
