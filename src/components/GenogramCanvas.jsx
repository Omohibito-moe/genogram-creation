import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { computeLayout, NODE_SIZE, NODE_R } from '../lib/layout';

const SELF_PAD = 6;
const LABEL_OFFSET = 16;
const DRAG_THRESHOLD = 3;
const CANVAS_PAD = 80;

// ── coord helper ────────────────────────────────────────────────────────────

function getSVGCoords(e, svg) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// ── geometry helpers ─────────────────────────────────────────────────────────

function shortenToEdge(x1, y1, x2, y2, pad = NODE_R + 2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { x1, y1, x2, y2 };
  return {
    x1: x1 + (dx / len) * pad, y1: y1 + (dy / len) * pad,
    x2: x2 - (dx / len) * pad, y2: y2 - (dy / len) * pad,
  };
}

function perp(x1, y1, x2, y2, d) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { px: 0, py: 0 };
  return { px: (-dy / len) * d, py: (dx / len) * d };
}

// ── SVG primitives ───────────────────────────────────────────────────────────

function DoubleParallelLine({ x1, y1, x2, y2, count = 2, color = 'black' }) {
  const { px, py } = perp(x1, y1, x2, y2, 4);
  const offsets = count === 2 ? [-1, 1] : [-1, 0, 1];
  return (
    <g>
      {offsets.map((o, i) => (
        <line key={i} x1={x1 + px * o} y1={y1 + py * o} x2={x2 + px * o} y2={y2 + py * o}
          stroke={color} strokeWidth="2" />
      ))}
    </g>
  );
}

function ZigzagLine({ x1, y1, x2, y2, color = 'black' }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const { px, py } = perp(x1, y1, x2, y2, 8);
  const segCount = Math.max(4, Math.floor(len / 14));
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i < segCount; i++) {
    const t = i / segCount;
    const side = i % 2 === 0 ? 1 : -1;
    d += ` L ${x1 + dx * t + px * side} ${y1 + dy * t + py * side}`;
  }
  d += ` L ${x2} ${y2}`;
  return <path d={d} fill="none" stroke={color} strokeWidth="2" />;
}

function CutoffLine({ x1, y1, x2, y2, color = 'black' }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const gapHalf = 12 / len;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x1 + dx * (0.5 - gapHalf)} y2={y1 + dy * (0.5 - gapHalf)} stroke={color} strokeWidth="2" />
      <line x1={x1 + dx * (0.5 + gapHalf)} y1={y1 + dy * (0.5 + gapHalf)} x2={x2} y2={y2} stroke={color} strokeWidth="2" />
    </g>
  );
}

// ── Node shape ────────────────────────────────────────────────────────────────

function NodeShape({ node, x, y, isSelected, isSource }) {
  const labelY = y + NODE_R + (node.self ? SELF_PAD : 0) + LABEL_OFFSET;
  const xm = NODE_R * 0.68;
  const selColor = '#2563eb';
  const srcColor = '#16a34a';
  const selWidth = 2.5;

  const commonText = (
    <>
      {node.age != null && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fontSize="14" fontWeight="bold" pointerEvents="none">
          {node.age}
        </text>
      )}
      <text x={x} y={labelY} textAnchor="middle" fontSize="12" pointerEvents="none">
        {node.label}
      </text>
    </>
  );

  const deadMark = node.dead && (
    <>
      <line x1={x - xm} y1={y - xm} x2={x + xm} y2={y + xm} stroke="black" strokeWidth="2" pointerEvents="none" />
      <line x1={x + xm} y1={y - xm} x2={x - xm} y2={y + xm} stroke="black" strokeWidth="2" pointerEvents="none" />
    </>
  );

  if (node.sex === 'F') {
    const outerR = NODE_R + SELF_PAD;
    return (
      <g style={{ cursor: 'grab' }}>
        {node.self && <circle cx={x} cy={y} r={outerR} fill="white" stroke="black" strokeWidth="2" />}
        <circle cx={x} cy={y} r={NODE_R} fill="white" stroke="black" strokeWidth="2" />
        {deadMark}
        {isSelected && <circle cx={x} cy={y} r={NODE_R + (node.self ? SELF_PAD + 4 : 4)} fill="none" stroke={selColor} strokeWidth={selWidth} strokeDasharray="0" />}
        {isSource && <circle cx={x} cy={y} r={NODE_R + (node.self ? SELF_PAD + 4 : 4)} fill="none" stroke={srcColor} strokeWidth={selWidth} strokeDasharray="6,3" />}
        {commonText}
      </g>
    );
  }

  const outerPad = NODE_R + SELF_PAD;
  return (
    <g style={{ cursor: 'grab' }}>
      {node.self && (
        <rect x={x - outerPad} y={y - outerPad} width={outerPad * 2} height={outerPad * 2}
          fill="white" stroke="black" strokeWidth="2" />
      )}
      <rect x={x - NODE_R} y={y - NODE_R} width={NODE_SIZE} height={NODE_SIZE}
        fill="white" stroke="black" strokeWidth="2" />
      {deadMark}
      {isSelected && (
        <rect x={x - NODE_R - (node.self ? SELF_PAD + 4 : 4)} y={y - NODE_R - (node.self ? SELF_PAD + 4 : 4)}
          width={(NODE_R + (node.self ? SELF_PAD + 4 : 4)) * 2} height={(NODE_R + (node.self ? SELF_PAD + 4 : 4)) * 2}
          fill="none" stroke={selColor} strokeWidth={selWidth} />
      )}
      {isSource && (
        <rect x={x - NODE_R - (node.self ? SELF_PAD + 4 : 4)} y={y - NODE_R - (node.self ? SELF_PAD + 4 : 4)}
          width={(NODE_R + (node.self ? SELF_PAD + 4 : 4)) * 2} height={(NODE_R + (node.self ? SELF_PAD + 4 : 4)) * 2}
          fill="none" stroke={srcColor} strokeWidth={selWidth} strokeDasharray="6,3" />
      )}
      {commonText}
    </g>
  );
}

// ── Marriage line ─────────────────────────────────────────────────────────────

function MarriageLine({ rel, relIndex, positions, isSelected, onRelClick }) {
  const p1 = positions[rel.from], p2 = positions[rel.to];
  if (!p1 || !p2) return null;
  const left = p1.x <= p2.x ? p1 : p2;
  const right = p1.x <= p2.x ? p2 : p1;
  const y = (p1.y + p2.y) / 2;
  const lx = left.x + NODE_R, rx = right.x - NODE_R;
  const color = isSelected ? '#2563eb' : 'black';

  const hitArea = (
    <line x1={lx} y1={y} x2={rx} y2={y}
      stroke="transparent" strokeWidth="12"
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onRelClick(relIndex); }} />
  );

  if (rel.type === 'divorce') {
    const mid = (lx + rx) / 2;
    return (
      <g>
        <line x1={lx} y1={y} x2={rx} y2={y} stroke={color} strokeWidth="2" />
        <line x1={mid - 9} y1={y - 8} x2={mid - 4} y2={y + 8} stroke={color} strokeWidth="2" />
        <line x1={mid + 4} y1={y - 8} x2={mid + 9} y2={y + 8} stroke={color} strokeWidth="2" />
        {hitArea}
      </g>
    );
  }
  return (
    <g>
      <line x1={lx} y1={y} x2={rx} y2={y} stroke={color} strokeWidth="2" />
      {hitArea}
    </g>
  );
}

// ── Family unit ───────────────────────────────────────────────────────────────

function FamilyUnit({ unit, positions, relations }) {
  const { parentIds, childIds } = unit;
  const parentPos = parentIds.map((id) => positions[id]).filter(Boolean);
  const childEntries = childIds.map((id) => ({ id, pos: positions[id] })).filter((e) => e.pos);
  if (!parentPos.length || !childEntries.length) return null;

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
    return (
      <line x1={dropX} y1={dropStartY} x2={sorted[0].pos.x} y2={sorted[0].pos.y - NODE_R}
        stroke="black" strokeWidth="2" />
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

function RelationLine({ rel, relIndex, positions, isSelected, onRelClick }) {
  const p1 = positions[rel.from], p2 = positions[rel.to];
  if (!p1 || !p2) return null;
  const { x1, y1, x2, y2 } = shortenToEdge(p1.x, p1.y, p2.x, p2.y);
  const color = isSelected ? '#2563eb' : 'black';

  const hitArea = (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="transparent" strokeWidth="14"
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onRelClick(relIndex); }} />
  );

  let visual;
  switch (rel.type) {
    case 'close':
      visual = <DoubleParallelLine x1={x1} y1={y1} x2={x2} y2={y2} count={2} color={color} />;
      break;
    case 'enmesh':
      visual = <DoubleParallelLine x1={x1} y1={y1} x2={x2} y2={y2} count={3} color={color} />;
      break;
    case 'conflict':
      visual = <ZigzagLine x1={x1} y1={y1} x2={x2} y2={y2} color={color} />;
      break;
    case 'cutoff':
      visual = <CutoffLine x1={x1} y1={y1} x2={x2} y2={y2} color={color} />;
      break;
    case 'arrow':
      visual = <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" markerEnd="url(#arrowhead)" />;
      break;
    case 'sibling': {
      const { px, py } = perp(x1, y1, x2, y2, 6);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      visual = (
        <g>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" />
          <line x1={mx - px} y1={my - py} x2={mx + px} y2={my + py} stroke="white" strokeWidth="4" />
        </g>
      );
      break;
    }
    default:
      visual = <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#888" strokeWidth="1.5" strokeDasharray="4,4" />;
  }

  return (
    <g>
      {visual}
      {hitArea}
    </g>
  );
}

// ── Main canvas component ─────────────────────────────────────────────────────

export default function GenogramCanvas({
  data,
  selectedNodeId,
  onNodeClick,
  selectedRelIndex,
  onRelClick,
  onCanvasClick,
  mode,
  connectSource,
  onConnectStep,
  onNodeMove,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);   // { nodeId, startX, startY, origX, origY, moved }
  const overridePosRef = useRef({});
  const justDraggedRef = useRef(false);
  const [overridePos, setOverridePos] = useState({});

  const { nodes = [], relations = [] } = data;
  const positions = useMemo(() => computeLayout(nodes, relations), [nodes, relations]);
  const displayPositions = useMemo(() => ({ ...positions, ...overridePos }), [positions, overridePos]);

  const { svgWidth, svgHeight } = useMemo(() => {
    if (!nodes.length) return { svgWidth: 800, svgHeight: 400 };
    const vals = Object.values(positions);
    if (!vals.length) return { svgWidth: 800, svgHeight: 400 };
    return {
      svgWidth: Math.max(800, Math.max(...vals.map((p) => p.x)) + CANVAS_PAD + NODE_R + 60),
      svgHeight: Math.max(400, Math.max(...vals.map((p) => p.y)) + CANVAS_PAD + NODE_R + 40),
    };
  }, [nodes, positions]);

  // ── drag handlers ──────────────────────────────────────────────────────────

  const handleNodeMouseDown = useCallback(
    (e, nodeId) => {
      e.stopPropagation();
      if (!svgRef.current) return;
      const { x, y } = getSVGCoords(e, svgRef.current);
      const pos = displayPositions[nodeId] || { x: 0, y: 0 };
      dragRef.current = { nodeId, startX: x, startY: y, origX: pos.x, origY: pos.y, moved: false };
    },
    [displayPositions]
  );

  const handleSVGMouseMove = useCallback(
    (e) => {
      if (!dragRef.current || !svgRef.current) return;
      const { x, y } = getSVGCoords(e, svgRef.current);
      const dx = x - dragRef.current.startX;
      const dy = y - dragRef.current.startY;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) dragRef.current.moved = true;
      if (dragRef.current.moved) {
        const { nodeId, origX, origY } = dragRef.current;
        const newPos = { x: origX + dx, y: origY + dy };
        overridePosRef.current = { ...overridePosRef.current, [nodeId]: newPos };
        setOverridePos({ ...overridePosRef.current });
      }
    },
    []
  );

  const commitDrag = useCallback(() => {
    if (!dragRef.current) return;
    const { nodeId, moved } = dragRef.current;
    dragRef.current = null;

    if (!moved) {
      if (mode === 'connect') {
        onConnectStep(nodeId);
      } else {
        onNodeClick(nodeId);
      }
    } else {
      justDraggedRef.current = true;
      const finalPos = overridePosRef.current[nodeId];
      if (finalPos) onNodeMove(nodeId, Math.round(finalPos.x), Math.round(finalPos.y));
      const next = { ...overridePosRef.current };
      delete next[nodeId];
      overridePosRef.current = next;
      setOverridePos(next);
      setTimeout(() => { justDraggedRef.current = false; }, 100);
    }
  }, [mode, onNodeClick, onConnectStep, onNodeMove]);

  // commit drag when mouse released anywhere on window
  useEffect(() => {
    window.addEventListener('mouseup', commitDrag);
    return () => window.removeEventListener('mouseup', commitDrag);
  }, [commitDrag]);

  const handleSVGClick = useCallback((e) => {
    // Only deselect when clicking the SVG background, not nodes or relation lines
    // (node/relation clicks call e.stopPropagation() so they won't reach here)
    if (justDraggedRef.current) return;
    if (e.target === svgRef.current || e.target.dataset?.bg === '1') {
      onCanvasClick();
    }
  }, [onCanvasClick]);

  // ── derived data ───────────────────────────────────────────────────────────

  const marriageRels = useMemo(
    () => relations.map((r, i) => ({ r, i })).filter(({ r }) => ['marriage', 'divorce'].includes(r.type)),
    [relations]
  );

  const familyUnits = useMemo(() => {
    const childToParents = {};
    relations.filter((r) => r.type === 'parent').forEach((r) => {
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

  const otherRels = useMemo(
    () => relations.map((r, i) => ({ r, i })).filter(({ r }) => !['marriage', 'divorce', 'parent'].includes(r.type)),
    [relations]
  );

  const svgCursor = mode === 'connect' ? 'crosshair' : 'default';

  // ── export PNG (exposed via ref would be cleaner, but prop callback is fine) ──

  return (
    <div className="canvas-wrapper">
      {mode === 'connect' && (
        <div className="connect-hint">
          {connectSource
            ? '接続先ノードをクリックしてください（緑枠が接続元）'
            : '接続元ノードをクリックしてください'}
        </div>
      )}
      <div className="svg-scroll">
        <svg
          ref={svgRef}
          id="genogram-svg"
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block', background: 'white', cursor: svgCursor }}
          onMouseMove={handleSVGMouseMove}
          onClick={handleSVGClick}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="black" />
            </marker>
          </defs>

          {/* Marriage / divorce lines */}
          {marriageRels.map(({ r, i }) => (
            <MarriageLine key={i} rel={r} relIndex={i} positions={displayPositions}
              isSelected={selectedRelIndex === i} onRelClick={onRelClick} />
          ))}

          {/* Parent-child structures */}
          {familyUnits.map((unit, i) => (
            <FamilyUnit key={i} unit={unit} positions={displayPositions} relations={relations} />
          ))}

          {/* Other relation lines */}
          {otherRels.map(({ r, i }) => (
            <RelationLine key={i} rel={r} relIndex={i} positions={displayPositions}
              isSelected={selectedRelIndex === i} onRelClick={onRelClick} />
          ))}

          {/* Nodes (on top) */}
          {nodes.map((node) => {
            const pos = displayPositions[node.id];
            if (!pos) return null;
            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => e.stopPropagation()}
              >
                <NodeShape
                  node={node}
                  x={pos.x}
                  y={pos.y}
                  isSelected={selectedNodeId === node.id}
                  isSource={connectSource === node.id}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
