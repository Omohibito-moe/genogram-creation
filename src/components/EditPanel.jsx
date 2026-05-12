const REL_TYPES = [
  { value: 'marriage', label: '婚姻' },
  { value: 'divorce', label: '離婚' },
  { value: 'parent', label: '親子（↓子へ）' },
  { value: 'sibling', label: '兄弟' },
  { value: 'close', label: '親密' },
  { value: 'enmesh', label: '密着・共依存' },
  { value: 'conflict', label: '葛藤・対立' },
  { value: 'cutoff', label: '疎遠・断絶' },
  { value: 'arrow', label: '矢印（一方向）' },
];

const REL_TYPE_LABELS = Object.fromEntries(REL_TYPES.map((t) => [t.value, t.label]));

function Field({ label, children }) {
  return (
    <div className="ep-field">
      <label className="ep-label">{label}</label>
      {children}
    </div>
  );
}

function NodePanel({ node, nodes, relations, onUpdate, onDelete, onDeleteRelation }) {
  const nodeRels = relations
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.from === node.id || r.to === node.id);

  return (
    <div className="edit-panel">
      <div className="ep-title">ノード編集</div>

      <Field label="続柄・名前">
        <input
          className="ep-input"
          type="text"
          value={node.label || ''}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
        />
      </Field>

      <div className="ep-row">
        <Field label="年齢">
          <input
            className="ep-input ep-input-sm"
            type="number"
            min={0}
            max={120}
            value={node.age ?? ''}
            placeholder="不明"
            onChange={(e) =>
              onUpdate(node.id, { age: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </Field>
        <Field label="性別">
          <div className="sex-toggle">
            <button
              className={`sex-btn${node.sex === 'M' ? ' active' : ''}`}
              onClick={() => onUpdate(node.id, { sex: 'M' })}
            >
              □ 男
            </button>
            <button
              className={`sex-btn${node.sex === 'F' ? ' active' : ''}`}
              onClick={() => onUpdate(node.id, { sex: 'F' })}
            >
              ○ 女
            </button>
          </div>
        </Field>
      </div>

      <div className="ep-row ep-checks">
        <label className="ep-check">
          <input
            type="checkbox"
            checked={!!node.dead}
            onChange={(e) => onUpdate(node.id, { dead: e.target.checked })}
          />
          死去
        </label>
        <label className="ep-check">
          <input
            type="checkbox"
            checked={!!node.self}
            onChange={(e) => onUpdate(node.id, { self: e.target.checked })}
          />
          本人
        </label>
      </div>

      <div className="ep-row">
        <Field label="世代">
          <input
            className="ep-input ep-input-sm"
            type="number"
            value={node.generation ?? 0}
            onChange={(e) => onUpdate(node.id, { generation: Number(e.target.value) })}
            title="-2=祖父母 / -1=親 / 0=本人 / 1=子"
          />
        </Field>
        <Field label="表示順">
          <input
            className="ep-input ep-input-sm"
            type="number"
            min={0}
            value={node.sibling_order ?? 0}
            onChange={(e) => onUpdate(node.id, { sibling_order: Number(e.target.value) })}
          />
        </Field>
      </div>

      {nodeRels.length > 0 && (
        <div className="ep-section">
          <div className="ep-section-title">関係線</div>
          {nodeRels.map(({ r, i }) => {
            const otherId = r.from === node.id ? r.to : r.from;
            const other = nodes.find((n) => n.id === otherId);
            const dir = r.from === node.id ? '→' : '←';
            return (
              <div key={i} className="rel-item">
                <span className="rel-item-text">
                  {dir} {other?.label ?? otherId}
                  <span className="rel-item-type">（{REL_TYPE_LABELS[r.type] ?? r.type}）</span>
                </span>
                <button className="btn-icon-danger" onClick={() => onDeleteRelation(i)}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn btn-danger" onClick={() => onDelete(node.id)}>
        このノードを削除
      </button>
    </div>
  );
}

function RelationPanel({ relation, relIndex, nodes, onUpdate, onDelete }) {
  const from = nodes.find((n) => n.id === relation.from);
  const to = nodes.find((n) => n.id === relation.to);
  return (
    <div className="edit-panel">
      <div className="ep-title">関係線編集</div>
      <div className="ep-rel-desc">
        {from?.label ?? relation.from} → {to?.label ?? relation.to}
      </div>

      <Field label="種類">
        <select
          className="ep-input"
          value={relation.type}
          onChange={(e) => onUpdate(relIndex, { type: e.target.value })}
        >
          {REL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="メモ">
        <input
          className="ep-input"
          type="text"
          value={relation.note || ''}
          placeholder="任意"
          onChange={(e) => onUpdate(relIndex, { note: e.target.value })}
        />
      </Field>

      <button className="btn btn-danger" onClick={() => onDelete(relIndex)}>
        この関係線を削除
      </button>
    </div>
  );
}

export default function EditPanel({
  selectedNodeId,
  selectedRelIndex,
  nodes,
  relations,
  onUpdateNode,
  onUpdateRelation,
  onDeleteNode,
  onDeleteRelation,
}) {
  const node = nodes.find((n) => n.id === selectedNodeId);
  const relation = selectedRelIndex !== null ? relations[selectedRelIndex] : null;

  if (node) {
    return (
      <NodePanel
        node={node}
        nodes={nodes}
        relations={relations}
        onUpdate={onUpdateNode}
        onDelete={onDeleteNode}
        onDeleteRelation={onDeleteRelation}
      />
    );
  }

  if (relation) {
    return (
      <RelationPanel
        relation={relation}
        relIndex={selectedRelIndex}
        nodes={nodes}
        onUpdate={onUpdateRelation}
        onDelete={onDeleteRelation}
      />
    );
  }

  return (
    <div className="edit-panel edit-panel-empty">
      <div className="ep-hint">
        <p>ノードをクリックして選択</p>
        <p>ドラッグして移動できます</p>
        <p>関係線をクリックして編集</p>
      </div>
    </div>
  );
}
