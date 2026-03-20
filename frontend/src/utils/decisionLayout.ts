import dagre from '@dagrejs/dagre'
import type { Node, Edge } from 'reactflow'

const NODE_WIDTH = 260
const NODE_BASE_HEIGHT = 116 // header + question
const BRANCH_ROW_HEIGHT = 22

const ENCOUNTER_WIDTH = 200
const ENCOUNTER_HEIGHT = 88

export function getNodeHeight(branchCount: number) {
  return NODE_BASE_HEIGHT + branchCount * BRANCH_ROW_HEIGHT
}

function getNodeDimensions(node: Node) {
  if (node.type === 'encounter') return { width: ENCOUNTER_WIDTH, height: ENCOUNTER_HEIGHT }
  return { width: NODE_WIDTH, height: getNodeHeight(node.data.branches?.length ?? 0) }
}

export function layoutDecisionGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 32, edgesep: 20 })

  for (const node of nodes) {
    const { width, height } = getNodeDimensions(node)
    g.setNode(node.id, { width, height })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  // Offset for floating nodes (no edges) — stack below the main graph
  let floatY = 0
  let floatX = 0

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id)
    const { width, height } = getNodeDimensions(node)
    const x = dagreNode?.x
    const y = dagreNode?.y

    if (x == null || isNaN(x) || y == null || isNaN(y)) {
      // Disconnected node — place in a row below the graph
      const pos = { x: floatX, y: -200 + floatY }
      floatX += width + 32
      if (floatX > 1200) { floatX = 0; floatY -= height + 32 }
      return { ...node, position: pos }
    }

    return { ...node, position: { x: x - width / 2, y: y - height / 2 } }
  })

  return { nodes: layoutedNodes, edges }
}
