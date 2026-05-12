export const NODE_SIZE = 50;
export const NODE_R = NODE_SIZE / 2;

const HORIZONTAL_GAP = 140; // px, center-to-center
const GENERATION_GAP = 160; // px, center-to-center
const TOP_PADDING = 80;

export function computeLayout(nodes, _relations) {
  if (!nodes || nodes.length === 0) return {};

  // Group nodes by generation
  const byGeneration = {};
  nodes.forEach((node) => {
    const gen = node.generation ?? 0;
    if (!byGeneration[gen]) byGeneration[gen] = [];
    byGeneration[gen].push(node);
  });

  // Sort each generation by sibling_order
  Object.values(byGeneration).forEach((group) => {
    group.sort((a, b) => (a.sibling_order ?? 0) - (b.sibling_order ?? 0));
  });

  const generations = Object.keys(byGeneration).map(Number).sort((a, b) => a - b);
  const minGen = generations[0];

  // Canvas width based on the widest generation
  const maxGroupSize = Math.max(...Object.values(byGeneration).map((g) => g.length));
  const canvasWidth = Math.max(800, maxGroupSize * HORIZONTAL_GAP + HORIZONTAL_GAP);

  const positions = {};

  generations.forEach((gen) => {
    const group = byGeneration[gen];
    const y = (gen - minGen) * GENERATION_GAP + TOP_PADDING;
    const totalSpan = (group.length - 1) * HORIZONTAL_GAP;
    const startX = canvasWidth / 2 - totalSpan / 2;

    group.forEach((node, i) => {
      if (node.x != null && node.y != null) {
        positions[node.id] = { x: node.x, y: node.y };
      } else {
        positions[node.id] = { x: startX + i * HORIZONTAL_GAP, y };
      }
    });
  });

  return positions;
}
