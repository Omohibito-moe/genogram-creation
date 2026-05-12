import { useMemo, useRef } from 'react';
import { computeLayout, NODE_SIZE, NODE_R } from '../lib/layout';

const SELF_PAD = 6;
const LABEL_OFFSET = 16;
const CANVAS_PADDING = 80;

// ── helpers ──────────────────────────────────────────────────────────────────

function shortenToEdge(x1, y1, x2, y2, pad = NODE_R + 2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { x1, y1, x2, y2 };
  return {
    x1: x1 + (dx / len) * pad,
    y1: y1 + (dy / len) * pad,
    x2: x2 - (dx / len) * pad,
    y2: y2 - (dy / len) * pad,
  };
}

function perp(x1, y1, x2, y2, d) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { px: 0, py: 0 };
  return { px: (-dy / len) * d, py: (dx / len) * d };
}

// ── SVG primitives ────────────────────────────────────────────────────────────

function DoubleParallelLine({ x1, y1, x2, y2, count = 2 }) {
  const { px, py } = perp(x1, y1, x2, y2, 4);
  const offsets = count === 2 ? [-1, 1] : [-1, 0, 1];
  return (
    <g>
      {offsets.map((o, i) => (
        <line
          key={i}
          x1={x1 + px * o} y1={y1 + py * o}
          x2={x2 + px * o} y2={y2 + py * o}
          stroke="black" strokeWidth="2"
        />
      ))}
    </g>
  );
}

function ZigzagLine({ x1, y1, x2, y2 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const { px, py } = perp(x1, y1, x2, y2, 8);
  const segCount = Math.max(4, Math.floor(len / 14));
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i < segCount; i++) {
    const t = i / segCount;
    const mx = x1 + dx * t;
    const my = y1 + dy * t;
    const side = i % 2 === 0 ? 1 : -1;
    d += ` L ${mx + px * side} ${my + py * side}`;
  }
  d += ` L ${x2} ${y2}`;
  return <path d={d} fill="none" stroke="black" strokeWidth="2" />;
}

function CutoffLine({ x1, y1, x2, y2 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const gapHalf = 12 / len;
  const g0s = 0.5 - gapHalf;
  const g0e = 0.5 + gapHalf;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x1 + dx * g0s} y2={y1 + dy * g0s} stroke="black" strokeWidth="2" />
      <line x1={x1 + dx * g0e} y1={y1 + dy * g0e} x2={x2} y2={y2} stroke="black" strokeWidth="2" />
    </g>
  );
}

// ── Node shape ────────────────────────────────────────────────────────────────

function NodeShape({ node, x, y }) {
  const selfOuter = NODE_R + SELF_PAD;
  const labelY = y + NODE_R + (node.self ? SELF_PAD : 0) + LABEL_OFFSET;
  const xMark = NODE_R * 0.68;

  if (node.sex === 'F') {
    return (
      <g>
        {node.self && (
          <circle cx={x} cy={y} r={selfOuter} fill="white" stroke="black" strokeWidth="2" />
        )}
        <circle cx={x} cy={y} r={NODE_R} fill="white" stroke="black" strokeWidth="2" />
        {node.dead && (
          <>
            <line x1={x - xMark} y1={y - xMark} x2={x + xMark} y2={y + xMark} stroke="black" strokeWidth="2" />
            <line x1={x + xMark} y1={y - xMark} x2={x - xMark} y2={y + xMark} stroke="black" strokeWidth="2" />
          </>
        )}
        {node.age != null && (
          <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold" pointerEvents="none">
            {node.age}
          </text>
        )}
        <text x={x} y={labelY} textAnchor="middle" fontSize="12" pointerEvents="none">
          {node.label}
        </text>
      </g>
    );
  }

  // Male or unknown → square
  return (
    <g>
      {node.self && (
        <rect
          x={x - selfOuter} y={y - selfOuter}
          width={(selfOuter) * 2} height={(selfOuter) * 2}
          fill="white" stroke="black" strokeWidth="2"
        />
      )}
      <rect x={x - NODE_R} y={y - NODE_R} width={NODE_SIZE} height={NODE_SIZE} fill="white" stroke="black" strokeWidth="2" />
      {node.dead && (
        <>
          <line x1={x - NODE_R} y1={y - NODE_R} x2={x + NODE_R} y2={y + NODE_R} stroke="black" strokeWidth="2" />
          <line x1={x + NODE_R} y1={y - NODE_R} x2={x - NODE_R} y2={y + NODE_R} stroke="black" strokeWidth="2" />
        </>
      )}
      {node.age != null && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold" pointerEvents="none">
          {node.age}
        </text>
      )}
      <text x={x} y={labelY} textAnchor="middle" fontSize="12" pointerEvents="none">
        {node.label}
      </text>
    </g>
  );
}

// ── Marriage line (handles divorce too) ───────────────────────────────────────

function MarriageLine({ rel, positions }) {
  const p1 = positions[rel.from];
  const p2 = positions[rel.to];
  if (!p1 || !p2) return null;

  const left = p1.x <= p2.x ? p1 : p2;
  const right = p1.x <= p2.x ? p2 : p1;
  const y = (p1.y + p2.y) / 2;
  const lx = left.x + NODE_R;
  const rx = right.x - NODE_R;

  if (rel.type === 'divorce') {
    const mid = (lx + rx) / 2;
    return (
      <g>
        <line x1={lx} y1={y} x2={rx} y2={y} stroke="black" strokeWidth="2" />
        <line x1={mid - 9} y1={y - 8} x2={mid - 4} y2={y + 8} stroke="black" strokeWidth="2" />
        <line x1={mid + 4} y1={y - 8} x2={mid + 9} y2={y + 8} stroke="black" strokeWidth="2" />
      </g>
    );
  }

  return <line x1={lx} y1={y} x2={rx} y2={y} stroke="black" strokeWidth="2" />;
}

// ── Family unit (parent → children with sibship line) ────────────────────────

function FamilyUnit({ unit, positions, relations }) {
  const { parentIds, childIds } = unit;
  const parentPos = parentIds.map((id) => positions[id]).filter(Boolean);
  const childEntries = childIds
    .map((id) => ({ id, pos: positions[id] }))
    .filter((e) => e.pos);

  if (parentPos.length === 0 || childEntries.length === 0) return null;

  const isCoupled =
    parentPos.length === 2 &&
    relations.some(
      (r) =>
        ['marriage', 'divorce'].includes(r.type) &&
        ((r.from === parentIds[0] && r.to === parentIds[1]) ||
          (r.from === parentIds[1] && r.to === parentIds[0]))
    );

  let dropX, dropStartY;
  if (isCoupled) {
    dropX = (parentPos[0].x + parentPos[1].x) / 2;
    dropStartY = (parentPos[0].y + parentPos[1].y) / 2;
  } else {
    dropX = parentPos[0].x;
    dropStartY = parentPos[0].y + NODE_R;
  }

  const sorted = [...childEntries].sort((a, b) => a.pos.x - b.pos.x);
  const minChildY = Math.min(...sorted.map((e) => e.pos.y));
  const sibshipY = minChildY - NODE_R - 18;

  if (sorted.length === 1) {
    const cp = sorted[0].pos;
    return (
      <line
        x1={dropX} y1={dropStartY}
        x2={cp.x} y2={cp.y - NODE_R}
        stroke="black" strokeWidth="2"
      />
    );
  }

  const leftX = Math.min(sorted[0].pos.x, dropX);
  const rightX = Math.max(sorted[sorted.length - 1].pos.x, dropX);

  return (
    <g>
      <line x1={dropX} y1={dropStartY} x2={dropX} y2={sibshipY} stroke="black" strokeWidth="2" />
      <line x1={leftX} y1={sibshipY} x2={rightX} y2={sibshipY} stroke="black" strokeWidth="2" />
      {sorted.map(({ id, pos }) => (
        <line key={id} x1={pos.x} y1={sibshipY} x2={pos.x} y2={pos.y - NODE_R} stroke="black" strokeWidth="2" />
      ))}
    </g>
  );
}

// ── Other relation lines ──────────────────────────────────────────────────────

function RelationLine({ rel, positions }) {
  const p1 = positions[rel.from];
  const p2 = positions[rel.to];
  if (!p1 || !p2) return null;
  const { x1, y1, x2, y2 } = shortenToEdge(p1.x, p1.y, p2.x, p2.y);

  switch (rel.type) {
    case 'close':
      return <DoubleParallelLine x1={x1} y1={y1} x2={x2} y2={y2} count={2} />;
    case 'enmesh':
      return <DoubleParallelLine x1={x1} y1={y1} x2={x2} y2={y2} count={3} />;
    case 'conflict':
      return <ZigzagLine x1={x1} y1={y1} x2={x2} y2={y2} />;
    case 'cutoff':
      return <CutoffLine x1={x1} y1={y1} x2={x2} y2={y2} />;
    case 'arrow':
      return (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="black" strokeWidth="2" markerEnd="url(#arrowhead)" />
      );
    case 'sibling': {
      // Sibling line without known parent: simple connecting line
      const { px, py } = perp(x1, y1, x2, y2, 6);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      return (
        <g>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="black" strokeWidth="2" />
          <line x1={mx - px} y1={my - py} x2={mx + px} y2={my + py} stroke="white" strokeWidth="4" />
        </g>
      );
    }
    default:
      return (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#888" strokeWidth="1.5" strokeDasharray="4,4" />
      );
  }
}

// ── Main canvas component ─────────────────────────────────────────────────────

export default function GenogramCanvas({ data }) {
  const svgRef = useRef(null);
  const { nodes = [], relations = [] } = data;

  const positions = useMemo(() => computeLayout(nodes, relations), [nodes, relations]);

  const { width, height } = useMemo(() => {
    if (nodes.length === 0) return { width: 800, height: 400 };
    const xs = nodes.map((n) => positions[n.id]?.x ?? 0);
    const ys = nodes.map((n) => positions[n.id]?.y ?? 0);
    return {
      width: Math.max(800, Math.max(...xs) + CANVAS_PADDING + NODE_R + 10),
      height: Math.max(400, Math.max(...ys) + CANVAS_PADDING + NODE_R + 30),
    };
  }, [nodes, positions]);

  // Family units: group children by their set of parents
  const familyUnits = useMemo(() => {
    const childToParents = {};
    relations
      .filter((r) => r.type === 'parent')
      .forEach((r) => {
        if (!childToParents[r.to]) childToParents[r.to] = [];
        if (!childToParents[r.to].includes(r.from)) childToParents[r.to].push(r.from);
      });

    const units = {};
    Object.entries(childToParents).forEach(([childId, parentIds]) => {
      const key = [...parentIds].sort().join(',');
      if (!units[key]) units[key] = { parentIds, childIds: [] };
      units[key].childIds.push(childId);
    });
    return Object.values(units);
  }, [relations]);

  const marriageRelations = useMemo(
    () => relations.filter((r) => r.type === 'marriage' || r.type === 'divorce'),
    [relations]
  );

  const otherRelations = useMemo(
    () => relations.filter((r) => !['marriage', 'divorce', 'parent'].includes(r.type)),
    [relations]
  );

  const exportPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = 'genogram.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      URL.revokeObjectURL(img.src);
    };
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(blob);
  };

  return (
    <div className="canvas-wrapper">
      <div className="svg-scroll">
        <svg
          ref={svgRef}
          id="genogram-svg"
          width={width}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          style={{ background: 'white', display: 'block' }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="black" />
            </marker>
          </defs>

          {/* Marriage / divorce lines first (behind nodes) */}
          {marriageRelations.map((rel, i) => (
            <MarriageLine key={i} rel={rel} positions={positions} />
          ))}

          {/* Parent-child family units */}
          {familyUnits.map((unit, i) => (
            <FamilyUnit key={i} unit={unit} positions={positions} relations={relations} />
          ))}

          {/* Emotional / other relation lines */}
          {otherRelations.map((rel, i) => (
            <RelationLine key={i} rel={rel} positions={positions} />
          ))}

          {/* Nodes rendered last (on top) */}
          {nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            return <NodeShape key={node.id} node={node} x={pos.x} y={pos.y} />;
          })}
        </svg>
      </div>
      <button className="btn" onClick={exportPNG} style={{ marginTop: 8 }}>
        PNG書き出し
      </button>
    </div>
  );
}
