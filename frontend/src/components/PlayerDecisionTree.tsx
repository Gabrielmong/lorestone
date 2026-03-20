import { useMemo, useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  type NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Box, Typography, Dialog, DialogTitle, DialogContent,
  IconButton, Chip, Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import LockIcon from '@mui/icons-material/Lock'
import DecisionTreeNode from './DecisionTreeNode'
import EncounterTreeNode from './EncounterTreeNode'
import ChapterLaneNode from './ChapterLaneNode'
import { layoutDecisionGraph } from '../utils/decisionLayout'

const nodeTypes = {
  decision: DecisionTreeNode,
  encounter: EncounterTreeNode,
  chapterLane: ChapterLaneNode,
}

const TEXT_COLOR: Record<string, string> = {
  GOOD: '#62a870',
  BAD: '#b84848',
  NEUTRAL: '#786c5c',
  VARIABLE: '#c8a44a',
}

export interface PlayerDecision {
  id: string
  question: string
  chosenLabel: string
  missionName?: string | null
  chapterName?: string | null
  branches: Array<{ id: string; label: string; outcomeType: string }>
  chosenBranchId: string
  incomingLinks: Array<{ fromDecisionId: string; fromBranchId?: string | null }>
}

export interface PlayerEncounter {
  id: string
  name: string
  status: string
  outcomeType?: string | null
  participantCount: number
  linkedDecisionId?: string | null
  outcomeDecisionId?: string | null
}

const OUTCOME_COLOR: Record<string, string> = {
  GOOD: '#62a870',
  BAD: '#b84848',
  NEUTRAL: 'rgba(120,108,92,0.6)',
  VARIABLE: '#c8a44a',
}

function buildPlayerGraph(
  decisions: PlayerDecision[],
  missedDecisions: PlayerDecision[],
  encounters: PlayerEncounter[],
) {
  const resolvedIds = new Set(decisions.map((d) => d.id))
  const allDecisionIds = new Set([...resolvedIds, ...missedDecisions.map((d) => d.id)])

  const chapterColorMap = new Map<string, number>()
  for (const d of [...decisions, ...missedDecisions]) {
    const key = d.chapterName ?? ''
    if (key && !chapterColorMap.has(key)) {
      chapterColorMap.set(key, chapterColorMap.size)
    }
  }

  const decisionNodes = decisions.map((d) => ({
    id: d.id,
    type: 'decision' as const,
    position: { x: 0, y: 0 },
    data: {
      id: d.id,
      question: d.question,
      status: 'RESOLVED',
      missionName: d.missionName,
      chapterName: d.chapterName,
      chapterColorIndex: d.chapterName ? (chapterColorMap.get(d.chapterName) ?? -1) : -1,
      isRoot: !(d.incomingLinks ?? []).some((l) => resolvedIds.has(l.fromDecisionId)),
      isLocked: false,
      branches: d.branches.map((b) => ({
        id: b.id,
        label: b.label,
        outcomeType: b.outcomeType,
        isChosen: b.id === d.chosenBranchId,
      })),
    },
  }))

  const missedNodes = missedDecisions.map((d) => ({
    id: d.id,
    type: 'decision' as const,
    position: { x: 0, y: 0 },
    data: {
      id: d.id,
      question: d.question,
      status: 'SKIPPED',
      missionName: d.missionName,
      chapterName: d.chapterName,
      chapterColorIndex: d.chapterName ? (chapterColorMap.get(d.chapterName) ?? -1) : -1,
      isRoot: false,
      isLocked: true,
      branches: d.branches.map((b) => ({
        id: b.id,
        label: b.label,
        outcomeType: b.outcomeType,
        isChosen: false,
      })),
    },
  }))

  const encounterNodes = encounters.map((e) => ({
    id: `enc-${e.id}`,
    type: 'encounter' as const,
    position: { x: 0, y: 0 },
    data: {
      id: e.id,
      name: e.name,
      status: e.status,
      round: 0,
      outcomeType: e.outcomeType ?? null,
      participantCount: e.participantCount,
    },
  }))

  const nodes = [...decisionNodes, ...encounterNodes]

  // Edges between resolved decisions
  const decisionMap = new Map(decisions.map((d) => [d.id, d]))
  const resolvedEdges = decisions.flatMap((d) =>
    (d.incomingLinks ?? [])
      .filter((l) => resolvedIds.has(l.fromDecisionId))
      .map((l) => {
        const parent = decisionMap.get(l.fromDecisionId)
        const branch = parent?.branches.find((b) => b.id === l.fromBranchId)
        const outcomeType = branch?.outcomeType ?? 'NEUTRAL'
        const color = OUTCOME_COLOR[outcomeType] ?? '#62a870'
        return {
          id: `pl-${l.fromDecisionId}-${d.id}`,
          source: l.fromDecisionId,
          target: d.id,
          label: branch?.label ?? '',
          animated: true,
          labelStyle: { fill: color, fontSize: 10, fontFamily: '"Cinzel", serif' },
          labelBgStyle: { fill: '#0b0906', fillOpacity: 0.85 },
          labelBgPadding: [4, 6] as [number, number],
          labelBgBorderRadius: 3,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        }
      })
  )

  // Encounter edges (only to/from resolved decisions)
  const encounterEdges = encounters.flatMap((e) => {
    const encNodeId = `enc-${e.id}`
    const edgeList = []
    if (e.linkedDecisionId && resolvedIds.has(e.linkedDecisionId)) {
      edgeList.push({
        id: `enc-in-${e.id}`,
        source: e.linkedDecisionId,
        target: encNodeId,
        animated: false,
        style: { stroke: 'rgba(180,72,72,0.5)', strokeWidth: 1.5, strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(180,72,72,0.5)', width: 12, height: 12 },
      })
    }
    if (e.outcomeDecisionId && resolvedIds.has(e.outcomeDecisionId)) {
      edgeList.push({
        id: `enc-out-${e.id}`,
        source: encNodeId,
        target: e.outcomeDecisionId,
        animated: false,
        style: { stroke: 'rgba(180,72,72,0.5)', strokeWidth: 1.5, strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(180,72,72,0.5)', width: 12, height: 12 },
      })
    }
    return edgeList
  })

  const edges = [...resolvedEdges, ...encounterEdges]

  return { nodes, edges }
}

export interface PlayerChapterLane {
  name: string
  colorIndex: number
}

interface Props {
  decisions: PlayerDecision[]
  missedDecisions: PlayerDecision[]
  encounters: PlayerEncounter[]
  chapterLanes: PlayerChapterLane[]
  shareToken: string
}

const ENCOUNTER_OUTCOME_COLOR: Record<string, string> = {
  WIN: '#62a870',
  LOSS: '#b84848',
  FLEE: '#c8a44a',
  DRAW: '#786c5c',
}

export default function PlayerDecisionTree({ decisions, missedDecisions, encounters, chapterLanes, shareToken: _shareToken }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEncId, setSelectedEncId] = useState<string | null>(null)
  const [selectedMissedId, setSelectedMissedId] = useState<string | null>(null)

  const selected = useMemo(
    () => decisions.find((d) => d.id === selectedId) ?? null,
    [decisions, selectedId]
  )
  const selectedEnc = useMemo(
    () => encounters.find((e) => e.id === selectedEncId) ?? null,
    [encounters, selectedEncId]
  )
  const selectedMissed = useMemo(
    () => missedDecisions.find((d) => d.id === selectedMissedId) ?? null,
    [missedDecisions, selectedMissedId]
  )

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!decisions.length) return { nodes: [], edges: [] }
    const { nodes, edges } = buildPlayerGraph(decisions, missedDecisions, encounters)
    const laid = layoutDecisionGraph(nodes, edges)

    // Chapter lane nodes (read-only, no toggle) — based on resolved decisions only
    if (chapterLanes.length > 0) {
      const nodeById = new Map(laid.nodes.map((n) => [n.id, n]))
      const chapterMinX = new Map<string, number>()
      const chapterMaxX = new Map<string, number>()
      for (const lane of chapterLanes) {
        let minX = Infinity, maxX = -Infinity
        for (const d of decisions.filter((x) => x.chapterName === lane.name)) {
          const n = nodeById.get(d.id)
          if (n) { minX = Math.min(minX, n.position.x); maxX = Math.max(maxX, n.position.x + 260) }
        }
        if (isFinite(minX)) { chapterMinX.set(lane.name, minX); chapterMaxX.set(lane.name, maxX) }
      }
      let minY = Infinity, maxY = -Infinity
      for (const n of laid.nodes) { minY = Math.min(minY, n.position.y); maxY = Math.max(maxY, n.position.y + 200) }
      if (isFinite(minY)) {
        const laneTop = minY - 56
        const laneHeight = maxY - laneTop + 60
        const laneNodes = chapterLanes
          .filter((l) => chapterMinX.has(l.name))
          .map((lane, i) => {
            const x = chapterMinX.get(lane.name)! - 20
            const nextLane = chapterLanes[i + 1]
            const nextX = nextLane && chapterMinX.has(nextLane.name)
              ? chapterMinX.get(nextLane.name)! - 20
              : chapterMaxX.get(lane.name)! + 20
            return {
              id: `lane-${lane.name}`,
              type: 'chapterLane' as const,
              position: { x, y: laneTop },
              draggable: false,
              selectable: false,
              style: { pointerEvents: 'none' as const },
              data: { label: lane.name, colorIndex: lane.colorIndex, height: laneHeight, width: Math.max(nextX - x, 40) },
            }
          })
        laid.nodes = [...laneNodes, ...laid.nodes]
      }
    }

    return laid
  }, [decisions, missedDecisions, encounters, chapterLanes])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => {
    if (node.type === 'encounter') {
      // node id is `enc-${encounter.id}`
      setSelectedEncId(node.id.replace(/^enc-/, ''))
    } else if (node.type === 'decision') {
      if (node.data?.status === 'SKIPPED') {
        setSelectedMissedId(node.id)
      } else {
        setSelectedId(node.id)
      }
    }
  }, [])

  if (!decisions.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography sx={{ color: '#786c5c', fontStyle: 'italic' }}>
          No decisions have been resolved yet.
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <Box sx={{
        width: '100%', height: 'calc(100vh - 260px)', minHeight: 480,
        borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(120,108,92,0.3)',
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#0b0906' }}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          minZoom={0.2}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(120,108,92,0.15)" />
          <Controls style={{ background: 'transparent' }} />
          <MiniMap
            nodeColor={(n) => {
              if (n.id.startsWith('lane-')) return 'transparent'
              return n.type === 'encounter' ? '#b84848' : '#62a870'
            }}
            nodeStrokeColor={(n) => n.id.startsWith('lane-') ? 'transparent' : 'transparent'}
            maskColor="rgba(11,9,6,0.7)"
            style={{ background: '#111009', border: '1px solid rgba(120,108,92,0.3)' }}
          />
        </ReactFlow>
      </Box>

      {/* Read-only detail modal */}
      <Dialog
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(120,108,92,0.3)' } }}
      >
        {selected && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                    {selected.chapterName && (
                      <Chip label={selected.chapterName} size="small"
                        sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#1a160f', color: '#786c5c' }} />
                    )}
                    {selected.missionName && (
                      <Typography sx={{ fontSize: '0.7rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>
                        {selected.missionName}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem', lineHeight: 1.4 }}>
                    {selected.question}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setSelectedId(null)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#e6d8c0' }, flexShrink: 0 }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </DialogTitle>

            <DialogContent sx={{ pt: 0 }}>
              <Box sx={{ mb: 1, p: 1.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(200,164,74,0.25)' }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', mb: 0.25, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Your party chose
                </Typography>
                <Typography sx={{ color: '#c8a44a', fontSize: '0.95rem', fontWeight: 600 }}>
                  → {selected.chosenLabel}
                </Typography>
              </Box>

              <Box sx={{ mt: 1.5 }}>
                {selected.branches.map((b) => (
                  <Box key={b.id} sx={{
                    p: 0.75, mb: 0.5, borderRadius: 1,
                    border: `1px solid ${b.id === selected.chosenBranchId ? `${TEXT_COLOR[b.outcomeType]}50` : 'rgba(120,108,92,0.15)'}`,
                    bgcolor: b.id === selected.chosenBranchId ? `${TEXT_COLOR[b.outcomeType]}12` : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}>
                    <Box sx={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      bgcolor: b.id === selected.chosenBranchId ? TEXT_COLOR[b.outcomeType] : 'transparent',
                      border: `1.5px solid ${TEXT_COLOR[b.outcomeType] ?? '#786c5c'}`,
                    }} />
                    <Typography sx={{
                      fontSize: '0.82rem',
                      color: b.id === selected.chosenBranchId ? TEXT_COLOR[b.outcomeType] : '#786c5c',
                      fontWeight: b.id === selected.chosenBranchId ? 600 : 400,
                    }}>
                      {b.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Encounter detail modal */}
      <Dialog
        open={!!selectedEncId}
        onClose={() => setSelectedEncId(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(180,72,72,0.3)' } }}
      >
        {selectedEnc && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalFireDepartmentIcon sx={{ fontSize: 16, color: '#b84848' }} />
                  <Typography sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem' }}>
                    {selectedEnc.name}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setSelectedEncId(null)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#e6d8c0' }, flexShrink: 0 }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                <Chip label={selectedEnc.status} size="small"
                  sx={{ fontSize: '0.65rem', height: 18, bgcolor: 'rgba(180,72,72,0.15)', color: '#b84848', fontFamily: '"JetBrains Mono"' }} />
                {selectedEnc.outcomeType && (
                  <Chip
                    label={selectedEnc.outcomeType}
                    size="small"
                    sx={{
                      fontSize: '0.65rem', height: 18, fontFamily: '"JetBrains Mono"',
                      bgcolor: `${ENCOUNTER_OUTCOME_COLOR[selectedEnc.outcomeType] ?? '#786c5c'}20`,
                      color: ENCOUNTER_OUTCOME_COLOR[selectedEnc.outcomeType] ?? '#786c5c',
                    }}
                  />
                )}
              </Box>
              <Typography sx={{ fontSize: '0.82rem', color: '#786c5c' }}>
                {selectedEnc.participantCount} combatant{selectedEnc.participantCount !== 1 ? 's' : ''} participated in this encounter.
              </Typography>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Missed path detail modal */}
      <Dialog
        open={!!selectedMissedId}
        onClose={() => setSelectedMissedId(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(120,108,92,0.25)' } }}
      >
        {selectedMissed && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LockIcon sx={{ fontSize: 12, color: '#786c5c' }} />
                      <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase' }}>
                        Path not taken
                      </Typography>
                    </Box>
                    {selectedMissed.missionName && (
                      <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                        {selectedMissed.missionName}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ color: '#786c5c', fontFamily: '"Cinzel", serif', fontSize: '0.95rem', lineHeight: 1.4 }}>
                    {selectedMissed.question}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setSelectedMissedId(null)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#e6d8c0' }, flexShrink: 0 }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#786c5c', fontStyle: 'italic', mb: 1.5 }}>
                Your party's choices led down a different path. These events did not come to pass.
              </Typography>
              <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)', mb: 1.5 }} />
              <Box>
                {selectedMissed.branches.map((b) => (
                  <Box key={b.id} sx={{
                    p: 0.75, mb: 0.5, borderRadius: 1,
                    border: '1px solid rgba(120,108,92,0.12)',
                    display: 'flex', alignItems: 'center', gap: 1,
                    opacity: 0.6,
                  }}>
                    <Box sx={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      bgcolor: 'transparent',
                      border: '1.5px solid rgba(120,108,92,0.4)',
                    }} />
                    <Typography sx={{ fontSize: '0.82rem', color: '#786c5c' }}>
                      {b.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  )
}
