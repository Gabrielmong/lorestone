import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fadeIn, slideUp, staggerContainer } from '../utils/motion'
import {
  Box, Typography, Button, Grid, Chip, LinearProgress,
  Paper, Divider,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import GroupsIcon from '@mui/icons-material/Groups'
import SwordIcon from '@mui/icons-material/Gavel'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import CasinoIcon from '@mui/icons-material/Casino'
import ShareIcon from '@mui/icons-material/Share'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import SettingsIcon from '@mui/icons-material/Settings'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ReactFlow, {
  Background, BackgroundVariant, MarkerType,
  useNodesState, useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import DecisionTreeNode from '../components/DecisionTreeNode'

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_CHARACTERS = [
  { name: 'Seraphine Voss', role: 'PLAYER', status: 'ACTIVE', hp: 28, hpMax: 34, corruption: 1, corruptionMax: 5, printed: true },
  { name: 'Malachar the Grey', role: 'VILLAIN', status: 'ACTIVE', hp: 0, hpMax: 0, corruption: 4, corruptionMax: 5, printed: false },
  { name: 'Brother Aldric', role: 'NPC', status: 'DEAD', hp: 0, hpMax: 18, corruption: 0, corruptionMax: 0, printed: true },
  { name: 'Zara Dawnwhisper', role: 'ALLY', status: 'ACTIVE', hp: 22, hpMax: 26, corruption: 0, corruptionMax: 3, printed: false },
]

const MOCK_DECISIONS = [
  { id: 'a', question: 'Spare the assassin or turn him over to the city guard?', status: 'RESOLVED', chosen: 'Spare him — he knows too much', chapter: 'Ch. 3 · Shadows of Valdris' },
  { id: 'b', question: 'Accept the witch\'s bargain in exchange for the relic?', status: 'RESOLVED', chosen: 'Refuse — seek another path', chapter: 'Ch. 4 · The Hollow Covenant' },
  { id: 'c', question: 'Who should carry the corrupted blade into the final vault?', status: 'PENDING', chosen: null, chapter: 'Ch. 5 · Into the Abyss' },
]

const MOCK_FACTIONS = [
  { name: 'The Conclave', rep: 2, repMin: -3, repMax: 3, color: '#62a870' },
  { name: 'Order of the Ashen Flame', rep: -1, repMin: -3, repMax: 3, color: '#b84848' },
  { name: 'The Merchant Lords', rep: 1, repMin: -3, repMax: 3, color: '#c8a44a' },
]

const MOCK_STATS = [
  { label: 'Sessions', value: '14' },
  { label: 'Decisions', value: '31' },
  { label: 'Encounters', value: '22' },
  { label: 'Hours Played', value: '~47' },
]

const FEATURES = [
  { icon: <GroupsIcon />, title: 'Character Tracker', desc: 'Track HP, corruption, conditions, and narrative notes for every NPC, player, and creature in your campaign.' },
  { icon: <AccountTreeIcon />, title: 'Decision Trees', desc: 'Map every branching choice as a visual graph. Link decisions across chapters and trace the consequences.' },
  { icon: <MenuBookIcon />, title: 'Session Log', desc: 'Record session events, DM notes, and player summaries. Never lose track of what happened.' },
  { icon: <SwordIcon />, title: 'Encounter Tracker', desc: 'Run combat with initiative order, HP tracking, and conditions — all in one place.' },
  { icon: <EmojiEventsIcon />, title: 'Faction Reputation', desc: 'Track player standing with every faction. See at a glance who likes them and who doesn\'t.' },
  { icon: <PrintIcon />, title: 'Mini Manager', desc: 'Flag which characters have printed minis, track STL sources, and mark what still needs printing.' },
  { icon: <AutoStoriesIcon />, title: 'Campaign Wiki', desc: 'A Notion-style wiki built into your campaign. Write lore, map factions, document locations — with nested pages, rich text, and Notion import.' },
  { icon: <CasinoIcon />, title: '3D Dice Roller', desc: 'Roll animated 3D dice with full sound. Customize your set — metal, crystal, stone — and save your favorites.' },
  { icon: <ShareIcon />, title: 'Shareable Player View', desc: 'Send players a link to their character sheet. They get their own dice roller too — no account needed.' },
]

const GRAPH_NODE_TYPES = { decision: DecisionTreeNode }

const INITIAL_NODES = [
  {
    id: 'n1',
    type: 'decision',
    position: { x: 30, y: 120 },
    data: {
      id: 'n1', question: 'Who should carry the map to the Sunken Vault?', status: 'RESOLVED',
      missionName: 'The Sunken Vault', chapterColorIndex: 0, isRoot: true, isLocked: false,
      branches: [
        { id: 'b1a', label: 'Give it to Brother Aldric', outcomeType: 'GOOD', isChosen: true },
        { id: 'b1b', label: 'Keep it ourselves', outcomeType: 'NEUTRAL', isChosen: false },
      ],
    },
  },
  {
    id: 'n2',
    type: 'decision',
    position: { x: 370, y: 20 },
    data: {
      id: 'n2', question: 'Confront the Order checkpoint or slip past undetected?', status: 'RESOLVED',
      missionName: 'The Hollow Covenant', chapterColorIndex: 1, isRoot: false, isLocked: false,
      branches: [
        { id: 'b2a', label: 'Confront them openly', outcomeType: 'BAD', isChosen: false },
        { id: 'b2b', label: 'Bribe the guards and slip by', outcomeType: 'NEUTRAL', isChosen: true },
      ],
    },
  },
  {
    id: 'n3',
    type: 'decision',
    position: { x: 370, y: 230 },
    data: {
      id: 'n3', question: 'Save the captured merchant or pursue the assassin?', status: 'RESOLVED',
      missionName: 'The Hollow Covenant', chapterColorIndex: 1, isRoot: false, isLocked: false,
      branches: [
        { id: 'b3a', label: 'Rescue the merchant', outcomeType: 'GOOD', isChosen: false },
        { id: 'b3b', label: 'Chase the assassin', outcomeType: 'VARIABLE', isChosen: true },
      ],
    },
  },
  {
    id: 'n4',
    type: 'decision',
    position: { x: 710, y: 120 },
    data: {
      id: 'n4', question: 'Break the Seal before the convergence, or wait for the ritual?', status: 'PENDING',
      missionName: 'Into the Abyss', chapterColorIndex: 2, isRoot: false, isLocked: false,
      branches: [
        { id: 'b4a', label: 'Break it now — too dangerous to wait', outcomeType: 'VARIABLE', isChosen: false },
        { id: 'b4b', label: 'Wait and prepare the ritual', outcomeType: 'NEUTRAL', isChosen: false },
        { id: 'b4c', label: 'Destroy the Seal entirely', outcomeType: 'BAD', isChosen: false },
      ],
    },
  },
]

const EDGE_STYLE = { stroke: 'rgba(120,108,92,0.5)', strokeWidth: 1.5 }
const CHOSEN_EDGE_STYLE = { stroke: '#62a870', strokeWidth: 2 }

const INITIAL_EDGES = [
  { id: 'e1-2', source: 'n1', target: 'n2', style: CHOSEN_EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: '#62a870' } },
  { id: 'e1-3', source: 'n1', target: 'n3', style: CHOSEN_EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: '#62a870' } },
  { id: 'e2-4', source: 'n2', target: 'n4', style: EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(120,108,92,0.5)' } },
  { id: 'e3-4', source: 'n3', target: 'n4', style: EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(120,108,92,0.5)' } },
]

function MockDecisionGraph() {
  const [nodes] = useNodesState(INITIAL_NODES)
  const [edges] = useEdgesState(INITIAL_EDGES)

  return (
    <Box sx={{ width: '100%', height: 400, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(120,108,92,0.25)', bgcolor: '#0d0b08' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={GRAPH_NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnDrag={false}
        panOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2a231a" gap={24} size={1} variant={BackgroundVariant.Dots} />
      </ReactFlow>
    </Box>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function hpColor(pct: number) {
  if (pct > 0.5) return '#62a870'
  if (pct > 0.25) return '#c8a44a'
  return '#b84848'
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#3d6b4a', color: '#62a870' },
  DEAD:     { bg: '#6e3030', color: '#b84848' },
  PENDING:  { bg: '#305868', color: '#5090b0' },
  RESOLVED: { bg: '#3a2e14', color: '#c8a44a' },
  NPC:      { bg: '#305868', color: '#5090b0' },
  VILLAIN:  { bg: '#6e3030', color: '#b84848' },
  PLAYER:   { bg: '#3a2e14', color: '#c8a44a' },
  ALLY:     { bg: '#3d6b4a', color: '#62a870' },
}

function Badge({ label }: { label: string }) {
  const c = STATUS_COLORS[label?.toUpperCase()] ?? STATUS_COLORS['NPC']
  return (
    <Chip
      label={label.toLowerCase()}
      size="small"
      sx={{
        bgcolor: c.bg, color: c.color,
        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', fontWeight: 600,
        height: 20, border: `1px solid ${c.color}40`,
      }}
    />
  )
}

function MockCharacterCard({ char }: { char: typeof MOCK_CHARACTERS[0] }) {
  const hpPct = char.hpMax > 0 ? char.hp / char.hpMax : null
  return (
    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.25)', borderRadius: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.88rem', color: '#e6d8c0', fontWeight: 600 }}>
          {char.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {char.printed && <PrintIcon sx={{ fontSize: 13, color: '#62a870' }} />}
          <Badge label={char.status} />
        </Box>
      </Box>
      <Box sx={{ mb: 0.75 }}>
        <Badge label={char.role} />
      </Box>
      {hpPct !== null && (
        <Box sx={{ mb: 0.5 }}>
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: hpColor(hpPct), mb: 0.25 }}>
            HP {char.hp}/{char.hpMax}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={hpPct * 100}
            sx={{ height: 3, bgcolor: '#2a231a', '& .MuiLinearProgress-bar': { bgcolor: hpColor(hpPct) } }}
          />
        </Box>
      )}
      {char.corruptionMax > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
          {Array.from({ length: char.corruptionMax }, (_, i) => (
            <Box key={i} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: i < char.corruption ? '#b84848' : '#3a332a', border: '1px solid #6e303060' }} />
          ))}
        </Box>
      )}
    </Paper>
  )
}

function MockDecisionNode({ decision }: { decision: typeof MOCK_DECISIONS[0] }) {
  const isPending = decision.status === 'PENDING'
  return (
    <Paper elevation={0} sx={{
      p: 1.5, bgcolor: '#111009',
      border: `1px solid ${isPending ? 'rgba(80,144,176,0.4)' : 'rgba(200,164,74,0.25)'}`,
      borderRadius: 1.5, position: 'relative',
    }}>
      <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono", monospace', mb: 0.5 }}>
        {decision.chapter}
      </Typography>
      <Typography sx={{ fontSize: '0.82rem', color: '#e6d8c0', lineHeight: 1.4, mb: 0.75 }}>
        {decision.question}
      </Typography>
      {decision.chosen ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#62a870', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.72rem', color: '#62a870', fontStyle: 'italic' }}>{decision.chosen}</Typography>
        </Box>
      ) : (
        <Badge label="PENDING" />
      )}
    </Paper>
  )
}

function repLabel(rep: number) {
  if (rep >= 3) return 'Honored'
  if (rep >= 2) return 'Friendly'
  if (rep >= 1) return 'Cordial'
  if (rep === 0) return 'Neutral'
  if (rep >= -1) return 'Wary'
  if (rep >= -2) return 'Hostile'
  return 'Enemy'
}

function MockFactionBar({ faction }: { faction: typeof MOCK_FACTIONS[0] }) {
  const steps = Array.from({ length: faction.repMax - faction.repMin + 1 }, (_, i) => faction.repMin + i)
  const segColor = (val: number) => {
    if (val < 0 && val <= faction.rep) return '#b84848'
    if (val > 0 && val <= faction.rep) return '#62a870'
    if (val === 0) return faction.rep === 0 ? '#786c5c' : '#3a332a'
    return '#3a332a'
  }
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.85rem', color: '#b4a48a' }}>{faction.name}</Typography>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: '#786c5c' }}>
          {repLabel(faction.rep)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
        {steps.map((val) => (
          <Box key={val} sx={{
            width: 20, height: 20, borderRadius: 0.5,
            backgroundColor: segColor(val),
            border: val === 0 ? '1px solid #786c5c60' : '1px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {val === 0 && <Box sx={{ width: 4, height: 4, bgcolor: '#786c5c', borderRadius: '50%' }} />}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ── Wiki showcase ──────────────────────────────────────────────────────────────

const WIKI_TREE = [
  { icon: '🌍', title: 'World Lore', depth: 0, active: false },
  { icon: '🏔️', title: 'Geography', depth: 1, active: false },
  { icon: '🏰', title: 'Factions', depth: 1, active: true },
  { icon: '🧙', title: 'Characters', depth: 0, active: false },
  { icon: '⚔️', title: 'Encounters', depth: 0, active: false },
  { icon: '📜', title: 'Session Notes', depth: 0, active: false },
]

function MockWikiShowcase() {
  return (
    <Box sx={{ px: { xs: 2, md: 6 }, py: 8, bgcolor: '#0b0906', borderTop: '1px solid rgba(120,108,92,0.12)', borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: { xs: '1.3rem', md: '1.6rem' }, mb: 0.5 }}>
              Campaign Wiki
            </Typography>
            <Typography sx={{ color: '#786c5c', fontSize: '0.88rem', maxWidth: 420 }}>
              A Notion-style wiki built into every campaign. Write lore, map factions, document locations — with nested pages, rich text, and direct Notion import.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: 'Nested pages', color: '#c8a44a' },
              { label: 'Rich text editor', color: '#5090b0' },
              { label: 'Notion import', color: '#62a870' },
              { label: 'Drag & drop', color: '#a06db5' },
            ].map((t) => (
              <Box key={t.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: t.color }} />
                <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono", monospace' }}>{t.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Wiki shell */}
        <Box sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(120,108,92,0.25)', display: 'flex', height: 380 }}>

          {/* Sidebar */}
          <Box sx={{ width: { xs: 150, md: 210 }, flexShrink: 0, bgcolor: '#0d0b08', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Sidebar header */}
            <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid rgba(120,108,92,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono", monospace' }}>
                Wiki
              </Typography>
              <AddIcon sx={{ fontSize: 16, color: '#786c5c' }} />
            </Box>
            {/* Tree rows */}
            <Box sx={{ pt: 0.75, flex: 1 }}>
              {WIKI_TREE.map((p, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  pl: `${8 + p.depth * 16}px`, pr: 0.5, py: 0.6,
                  borderRadius: 1, mx: 0.5,
                  bgcolor: p.active ? 'rgba(200,164,74,0.1)' : 'transparent',
                }}>
                  <Box sx={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.depth === 0 && WIKI_TREE.some((t, j) => j > i && t.depth > 0)
                      ? <ExpandMoreIcon sx={{ fontSize: 14, color: '#786c5c' }} />
                      : p.depth === 0
                        ? <ChevronRightIcon sx={{ fontSize: 14, color: 'rgba(120,108,92,0.3)' }} />
                        : null}
                  </Box>
                  <Typography sx={{ fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 }}>{p.icon}</Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: p.active ? '#c8a44a' : '#b4a48a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {p.title}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Content area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#0f0d0a', overflow: 'hidden', minWidth: 0 }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', gap: 0.25, px: 2, py: 0.75, alignItems: 'center', borderBottom: '1px solid rgba(120,108,92,0.15)', bgcolor: '#0f0d0a', flexShrink: 0 }}>
              {(['H1', 'H2', 'H3'] as const).map((h) => (
                <Box key={h} sx={{ px: 0.5, py: 0.4, borderRadius: 0.5 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: '#786c5c', lineHeight: 1 }}>{h}</Typography>
                </Box>
              ))}
              <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16 }} />
              <Box sx={{ p: 0.4, borderRadius: 0.5 }}><FormatBoldIcon sx={{ fontSize: 16, color: '#786c5c' }} /></Box>
              <Box sx={{ p: 0.4, borderRadius: 0.5 }}><FormatItalicIcon sx={{ fontSize: 16, color: '#786c5c' }} /></Box>
              <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16 }} />
              <Box sx={{ p: 0.4, borderRadius: 0.5 }}><FormatListBulletedIcon sx={{ fontSize: 16, color: '#786c5c' }} /></Box>
              <Box sx={{ p: 0.4, borderRadius: 0.5 }}><FormatQuoteIcon sx={{ fontSize: 16, color: '#786c5c' }} /></Box>
              <Typography sx={{ ml: 'auto', fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono", monospace' }}>Saved</Typography>
            </Box>

            {/* Page content */}
            <Box sx={{ flex: 1, overflow: 'hidden', px: { xs: 2, md: 5 }, pt: 3 }}>
              <Typography sx={{ fontSize: '2.5rem', lineHeight: 1, mb: 1 }}>🏰</Typography>
              <Typography sx={{ fontSize: '2rem', fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontWeight: 700, mb: 2, lineHeight: 1.1 }}>
                Factions
              </Typography>
              <Typography sx={{ fontFamily: '"Crimson Pro", serif', fontSize: '1rem', color: '#c8b89a', lineHeight: 1.75, mb: 1.5 }}>
                The major powers of Valdris have shaped the continent's politics for centuries.
              </Typography>
              {[
                { name: 'The Conclave', note: 'Scholarly order; cautious allies', color: '#62a870' },
                { name: 'Order of the Ashen Flame', note: 'Militant inquisitors; hostile', color: '#b84848' },
                { name: 'The Merchant Lords', note: 'Neutral; motivated by profit', color: '#c8a44a' },
              ].map((f) => (
                <Box key={f.name} sx={{ display: 'flex', gap: 1.25, mb: 0.5, alignItems: 'flex-start', pl: 2 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: f.color, mt: '0.45rem', flexShrink: 0 }} />
                  <Typography sx={{ fontFamily: '"Crimson Pro", serif', fontSize: '1rem', color: '#c8b89a', lineHeight: 1.75 }}>
                    <strong style={{ color: '#e6d8c0' }}>{f.name}</strong>{' — '}{f.note}
                  </Typography>
                </Box>
              ))}
              <Box sx={{ mt: 1.5, pl: 2, borderLeft: '3px solid rgba(200,164,74,0.4)', ml: 0 }}>
                <Typography sx={{ fontFamily: '"Crimson Pro", serif', fontSize: '1rem', color: '#786c5c', fontStyle: 'italic', lineHeight: 1.75 }}>
                  "The Merchant Lords will deal with anyone…"
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// ── Dice showcase ──────────────────────────────────────────────────────────────


function DieIcon({ sides, size, color }: { sides: number; size: number; color: string }) {
  const s = size
  if (sides === 20) return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={color}>
      <path d="M217.5 56.4L77.9 140.2l61.4 44.7L217.5 56.4zM64 169.6V320.3l59.2-107.6L64 169.6zM104.8 388L240 469.1V398.8L104.8 388zM272 469.1L407.2 388 272 398.8v70.3zM448 320.3V169.6l-59.2 43L448 320.3zM434.1 140.2L294.5 56.4l78.2 128.4 61.4-44.7zM243.7 3.4c7.6-4.6 17.1-4.6 24.7 0l200 120c7.2 4.3 11.7 12.1 11.7 20.6V368c0 8.4-4.4 16.2-11.7 20.6l-200 120c-7.6 4.6-17.1 4.6-24.7 0l-200-120C36.4 384.2 32 376.4 32 368V144c0-8.4 4.4-16.2 11.7-20.6l200-120zM225.3 365.5L145 239.4 81.9 354l143.3 11.5zM338.9 224H173.1L256 354.2 338.9 224zM256 54.8L172.5 192H339.5L256 54.8zm30.7 310.7L430.1 354 367 239.4 286.7 365.5z" />
    </svg>
  )
  if (sides === 12) return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={color}>
      <path d="M200.3 32c-2.8 0-5.6 .7-8 2.1L128.7 70.9 256 111.2 383.3 70.9 319.7 34.1c-2.4-1.4-5.2-2.1-8-2.1L200.3 32zM92 92.8c-.8 .9-1.6 1.9-2.2 2.9L34.2 192.2c.6 .5 1.2 1 1.7 1.6l95.8 106.4L240 246.1V139.7L92 92.8zM32 237.3l0 74.4c0 2.8 .7 5.6 2.1 8l55.7 96.5c1.4 2.4 3.4 4.5 5.9 5.9l62.7 36.2-44.5-130L32 237.3zM199.7 480c.2 0 .4 0 .6 0H311.7c.7 0 1.4 0 2.1-.1l50.6-151.8L256 273.9 147.7 328.1l52 151.9zM355 457.5l61.2-35.4c2.4-1.4 4.5-3.4 5.9-5.9l55.7-96.5c1.4-2.4 2.1-5.2 2.1-8V237.3l-81.9 90.9L355 457.5zM477.8 192.2L422.1 95.7c-.6-1.1-1.3-2-2.2-2.9L272 139.7V246.1l108.3 54.1 95.8-106.4c.5-.6 1.1-1.1 1.7-1.6zM176.3 6.4c7.3-4.2 15.6-6.4 24-6.4H311.7c8.4 0 16.7 2.2 24 6.4l96.5 55.7c7.3 4.2 13.4 10.3 17.6 17.6l55.7 96.5c4.2 7.3 6.4 15.6 6.4 24V311.7c0 8.4-2.2 16.7-6.4 24l-55.7 96.5c-4.2 7.3-10.3 13.4-17.6 17.6l-96.5 55.7c-7.3 4.2-15.6 6.4-24 6.4H200.3c-8.4 0-16.7-2.2-24-6.4L79.7 449.8c-7.3-4.2-13.4-10.3-17.6-17.6L6.4 335.7c-4.2-7.3-6.4-15.6-6.4-24V200.3c0-8.4 2.2-16.7 6.4-24L62.2 79.7c4.2-7.3 10.3-13.4 17.6-17.6L176.3 6.4z" />
    </svg>
  )
  if (sides === 100) return (
    <svg width={s} height={s} viewBox="0 0 45 33" fill={color}>
      <path fillRule="evenodd" clipRule="evenodd" d="M17.1406 0.554688C16.8281 0.179688 16.3906 -0.0078125 16.0156 -0.0078125C15.5781 -0.0078125 15.1406 0.179688 14.8906 0.554688L0.390625 17.0547C0.078125 17.3047 -0.046875 17.7422 0.015625 18.1172C0.015625 18.4922 0.203125 18.8672 0.515625 19.1797L15.0156 31.6797C15.5781 32.1172 16.3906 32.1172 16.9531 31.6797L31.4531 19.1797C31.7656 18.8672 31.9531 18.5547 31.9531 18.1172C32.0156 17.7422 31.8906 17.3047 31.6406 17.0547L17.1406 0.554688ZM3.45312 16.5547L13.3281 5.30469L9.26562 15.1797L3.45312 16.5547ZM15.0156 28.9922L3.01562 18.6797L9.76562 17.1172L15.0156 20.5547V28.9922ZM28.9531 18.6797L17.0156 28.9922V20.5547L22.2031 17.1172L28.9531 18.6797ZM18.6406 5.30469L28.5156 16.5547L22.7031 15.1797L18.6406 5.30469ZM20.7656 15.6172L16.0156 18.8047L11.2031 15.6172L16.0156 4.11719L20.7656 15.6172Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M35.1712 17.125L33.9668 17.9231C33.9651 17.2348 33.7494 16.506 33.2934 15.9205L33.7337 15.625L28.9837 4.125L27.0316 8.78987L25.5563 7.1111L26.2962 5.3125L25.1366 6.63355L23.8301 5.1468L27.8587 0.5625C28.1087 0.1875 28.5462 0 28.9837 0C29.3587 0 29.7962 0.1875 30.1087 0.5625L44.6087 17.0625C44.8587 17.3125 44.9837 17.75 44.9212 18.125C44.9212 18.5625 44.7337 18.875 44.4212 19.1875L29.9212 31.6875C29.3587 32.125 28.5462 32.125 27.9837 31.6875L23.9991 28.2525L25.5541 26.912L27.9837 29V24.8175L29.9837 23.0933V29L41.9212 18.6875L35.1712 17.125ZM41.4837 16.5625L31.6087 5.3125L35.6712 15.1875L41.4837 16.5625Z" />
    </svg>
  )
  if (sides === 10) return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={color}>
      <path d="M213.8 84.1L55.6 264.1l92.7-21.8L213.8 84.1zM48.6 298.6L240 463.6V328.6l-83.1-55.4L48.6 298.6zM272 463.6l191.4-165L355.1 273.2 272 328.6V463.6zM456.4 264.1L298.2 84.1l65.4 158.2 92.7 21.8zM256 0c6.9 0 13.5 3 18 8.2l232 264c4.2 4.8 6.4 11.1 5.9 17.5s-3.4 12.3-8.3 16.5l-232 200c-9 7.8-22.3 7.8-31.3 0l-232-200C3.5 302 .5 296 .1 289.7S1.7 277 6 272.2L238 8.2C242.5 3 249.1 0 256 0zm0 300.8L332.2 250 256 65.8 179.8 250 256 300.8z" />
    </svg>
  )
  if (sides === 8) return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={color}>
      <path d="M240 51.3L44.3 247.1l195.7 81V51.3zM72.8 293.5L240 460.7v-98L72.8 293.5zM272 460.7L439.2 293.5 272 362.7v98zM467.8 247.1L272 51.3V328.1l195.8-81zM239 7c9.4-9.4 24.6-9.4 33.9 0L505 239c9.4 9.4 9.4 24.6 0 33.9L273 505c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L239 7z" />
    </svg>
  )
  if (sides === 6) return (
    <svg width={s} height={s} viewBox="0 0 448 512" fill={color}>
      <path d="M220.1 35.6L47.9 136.2l176 101.2L400 133l-172-97.5 11.6-20.4L228.1 35.5c-2.5-1.4-5.5-1.4-8 .1zM32 164V366.6c0 2.9 1.6 5.6 4.1 7L208 469.9V265.3L32 164zM240 469.9l171.9-96.3c2.5-1.4 4.1-4.1 4.1-7V160.8L240 265.1V469.9zM203.9 7.9c12.3-7.2 27.5-7.3 39.9-.3L427.7 112c12.5 7.1 20.3 20.4 20.3 34.8V366.6c0 14.5-7.8 27.8-20.5 34.9l-184 103c-12.1 6.8-26.9 6.8-39.1 0l-184-103C7.8 394.4 0 381.1 0 366.6V150.1c0-14.2 7.5-27.4 19.8-34.5L203.9 7.9z" />
    </svg>
  )
  // d4
  return (
    <svg width={s} height={s} viewBox="0 0 512 512" fill={color}>
      <path d="M240.1 56.5L35.4 310.6 240.1 465.9V56.5zm32 409.2L476.6 310.6 272.1 56.7V465.8zM256 0c7.3 0 14.1 3.3 18.7 8.9l232 288c4.1 5.1 5.9 11.5 5.1 18s-4.1 12.3-9.3 16.2l-232 176c-8.6 6.5-20.4 6.5-29 0l-232-176c-5.2-3.9-8.5-9.8-9.3-16.2s1.1-12.9 5.1-18l232-288C241.9 3.3 248.7 0 256 0z" />
    </svg>
  )
}

const MOCK_DIE_TYPES = [
  { sides: 20, label: 'd20', count: 1 },
  { sides: 12, label: 'd12', count: 0 },
  { sides: 10, label: 'd10', count: 0 },
  { sides: 8,  label: 'd8',  count: 0 },
  { sides: 6,  label: 'd6',  count: 0 },
  { sides: 4,  label: 'd4',  count: 0 },
  { sides: 100, label: 'd%', count: 0 },
]

function MockDiceShowcase() {
  return (
    <Box sx={{ px: { xs: 2, md: 6 }, py: 8, bgcolor: '#0d0b08', borderTop: '1px solid rgba(120,108,92,0.12)', borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: { xs: '1.3rem', md: '1.6rem' }, mb: 0.5 }}>
              3D Dice Roller
            </Typography>
            <Typography sx={{ color: '#786c5c', fontSize: '0.88rem', maxWidth: 420 }}>
              Roll any combination of dice with full 3D physics and sound. Customize your set — colors, material, surface — and save your favorites.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: 'Classic', color: '#786c5c' },
              { label: 'Dragon', color: '#b84848' },
              { label: 'Arcane', color: '#5090b0' },
            ].map((m) => (
              <Box key={m.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: m.color }} />
                <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono", monospace' }}>{m.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Dice roller shell */}
        <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(120,108,92,0.25)', bgcolor: '#0b0906', display: 'flex', flexDirection: 'column' }}>

          {/* Top bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CasinoIcon sx={{ color: '#c8a44a', fontSize: 20 }} />
              <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', fontSize: '1rem' }}>Dice Roller</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <SettingsIcon sx={{ fontSize: 18, color: '#786c5c' }} />
              <Typography sx={{ fontSize: '1rem', color: '#786c5c', lineHeight: 1.2, ml: 0.5 }}>×</Typography>
            </Box>
          </Box>

          {/* Dice set chips */}
          <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {[
              { name: 'Classic', active: true },
              { name: 'Dragon', active: false },
              { name: 'Arcane', active: false },
            ].map((s) => (
              <Chip key={s.name} label={s.name} size="small" sx={{
                height: 22, fontSize: '0.7rem',
                bgcolor: s.active ? 'rgba(200,164,74,0.2)' : 'rgba(120,108,92,0.1)',
                color: s.active ? '#c8a44a' : '#786c5c',
                border: s.active ? '1px solid rgba(200,164,74,0.4)' : '1px solid rgba(120,108,92,0.2)',
              }} />
            ))}
          </Box>

          {/* Result */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, py: 3 }}>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.85rem', color: '#786c5c' }}>1d20</Typography>
            <Typography sx={{
              fontFamily: '"Cinzel", serif', fontSize: '3.5rem', color: '#f0d060', lineHeight: 1,
              textShadow: '0 0 40px rgba(240,208,96,0.8)',
            }}>20</Typography>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1.1rem', color: '#f0d060', textShadow: '0 0 24px rgba(240,208,96,0.7)', letterSpacing: 1 }}>
              ✦ Critical Success!
            </Typography>
          </Box>

          {/* Bottom control panel */}
          <Box sx={{ bgcolor: 'rgba(17,16,9,0.92)', borderTop: '1px solid rgba(120,108,92,0.3)', px: 2, pt: 2, pb: 3 }}>
            {/* Die picker */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 0.75, sm: 1.5 }, mb: 2, flexWrap: 'wrap' }}>
              {MOCK_DIE_TYPES.map((die) => (
                <Box key={die.sides} sx={{
                  position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                  p: 1, borderRadius: 1.5,
                  bgcolor: die.count > 0 ? 'rgba(200,164,74,0.12)' : 'rgba(120,108,92,0.06)',
                  border: die.count > 0 ? '1px solid rgba(200,164,74,0.4)' : '1px solid rgba(120,108,92,0.2)',
                }}>
                  {die.count > 0 && (
                    <Box sx={{
                      position: 'absolute', top: -8, right: -8,
                      width: 20, height: 20, borderRadius: '50%',
                      bgcolor: '#c8a44a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#0b0906', lineHeight: 1 }}>{die.count}</Typography>
                    </Box>
                  )}
                  <DieIcon sides={die.sides} size={44} color={die.count > 0 ? '#c8a44a' : '#786c5c'} />
                  <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', color: die.count > 0 ? '#c8a44a' : '#786c5c' }}>
                    {die.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* ADV / DIS */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1.5 }}>
              {[{ label: 'ADV', color: '#62a870', bg: 'rgba(98,168,112,0.15)', border: 'rgba(98,168,112,0.5)' }, { label: 'DIS', color: '#b84848', bg: 'rgba(184,72,72,0.15)', border: 'rgba(184,72,72,0.5)' }].map((m) => (
                <Box key={m.label} sx={{ px: 1.5, py: 0.4, borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)', color: '#786c5c', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem' }}>
                  {m.label}
                </Box>
              ))}
            </Box>

            {/* Modifier */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ color: '#786c5c', fontSize: '0.8rem' }}>MOD</Typography>
                <Box sx={{ width: 24, height: 24, border: '1px solid rgba(120,108,92,0.3)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: '#786c5c', fontSize: '1rem', lineHeight: 1 }}>−</Typography>
                </Box>
                <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.95rem', minWidth: 32, textAlign: 'center', color: '#786c5c' }}>+0</Typography>
                <Box sx={{ width: 24, height: 24, border: '1px solid rgba(120,108,92,0.3)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: '#786c5c', fontSize: '1rem', lineHeight: 1 }}>+</Typography>
                </Box>
              </Box>
            </Box>

            <Typography sx={{ textAlign: 'center', color: '#3a3020', fontSize: '0.62rem', mb: 1.5 }}>
              right-click a die to remove one
            </Typography>

            {/* Roll / Reset */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Box sx={{ px: 3, py: 0.75, border: '1px solid rgba(120,108,92,0.4)', borderRadius: 1, color: '#786c5c', fontFamily: '"Cinzel", serif', fontSize: '0.85rem', fontWeight: 600 }}>
                Reset
              </Box>
              <Box sx={{ px: 4, py: 0.75, bgcolor: '#c8a44a', borderRadius: 1, color: '#0b0906', fontFamily: '"Cinzel", serif', fontSize: '0.95rem', fontWeight: 700 }}>
                Roll
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

const MOCK_PLAYER_STATS = [
  { label: 'Play Time', value: '47h' },
  { label: 'Sessions', value: '14' },
  { label: 'Decisions', value: '31' },
  { label: 'Enemies Slain', value: '88' },
  { label: 'Items Held', value: '12' },
  { label: 'Missions Done', value: '8' },
]

const MOCK_ITEMS = [
  { name: 'Shadowstep Cloak', type: 'MAGIC' },
  { name: 'The Ashen Sigil', type: 'QUEST' },
  { name: 'Vial of Void Essence', type: 'CONSUMABLE' },
]

const ITEM_CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  MAGIC:      { bg: '#305868', color: '#5090b0' },
  QUEST:      { bg: '#3a2e14', color: '#c8a44a' },
  CONSUMABLE: { bg: '#3d3320', color: '#8a7830' },
}

function MockPlayerView() {
  return (
    <Box sx={{ px: { xs: 2, md: 6 }, py: 8, bgcolor: '#0b0906', borderTop: '1px solid rgba(120,108,92,0.12)', borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: { xs: '1.3rem', md: '1.6rem' }, mb: 0.5 }}>
              Shareable Player View
            </Typography>
            <Typography sx={{ color: '#786c5c', fontSize: '0.88rem', maxWidth: 420 }}>
              Share a private link with each player. They get a live campaign journal — items, factions, story choices, session notes — plus their own dice roller. No account needed.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: 'Live campaign data', color: '#62a870' },
              { label: 'No login needed', color: '#c8a44a' },
              { label: 'Dice roller included', color: '#786c5c' },
              { label: 'Mobile friendly', color: '#5090b0' },
            ].map((t) => (
              <Box key={t.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: t.color }} />
                <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono", monospace' }}>{t.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Player view shell */}
        <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(120,108,92,0.25)', bgcolor: '#0d0b08', p: { xs: 2, md: 4 } }}>

          {/* Campaign header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', fontSize: { xs: '1.4rem', md: '1.8rem' }, fontWeight: 700, mb: 0.75 }}>
              The Shadowrift Chronicles
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Chip label="D&D 5e" size="small" sx={{ bgcolor: '#1a160f', color: '#b4a48a', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem' }} />
              <Chip label="Year 843 of the Third Age" size="small" sx={{ bgcolor: '#1a160f', color: '#786c5c', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem' }} />
            </Box>
          </Box>

          {/* Stats bar */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {MOCK_PLAYER_STATS.map((t) => (
              <Box key={t.label} sx={{ flex: '1 1 0', minWidth: 80, px: 1.5, py: 1.25, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)', textAlign: 'center' }}>
                <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.25rem', color: '#c8a44a', lineHeight: 1.2 }}>{t.value}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', mt: 0.25, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.label}</Typography>
              </Box>
            ))}
          </Box>

          {/* Content columns */}
          <Grid container spacing={2.5}>
            {/* Items */}
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AutoAwesomeIcon sx={{ color: '#c8a44a', fontSize: 20 }} />
                <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: '1rem' }}>Items in Possession</Typography>
              </Box>
              {MOCK_ITEMS.map((item) => {
                const c = ITEM_CHIP_COLORS[item.type] ?? ITEM_CHIP_COLORS['CONSUMABLE']
                return (
                  <Box key={item.name} sx={{ mb: 1, p: 1.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(200,164,74,0.15)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.9rem', color: '#c8a44a', flex: 1 }}>{item.name}</Typography>
                    <Chip label={item.type.toLowerCase()} size="small" sx={{ bgcolor: c.bg, color: c.color, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem', height: 18, border: `1px solid ${c.color}40` }} />
                  </Box>
                )
              })}
            </Grid>

            {/* Factions */}
            <Grid item xs={12} md={7}>
              <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: '1rem', mb: 1.5 }}>Faction Standing</Typography>
              <Paper elevation={0} sx={{ p: 2 }}>
                {MOCK_FACTIONS.map((f) => (
                  <MockFactionBar key={f.name} faction={f} />
                ))}
              </Paper>
            </Grid>
          </Grid>

          {/* Share link */}
          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, p: 1.25, bgcolor: '#111009', borderRadius: 1, border: '1px dashed rgba(200,164,74,0.2)' }}>
            <ShareIcon sx={{ fontSize: 14, color: '#786c5c', flexShrink: 0 }} />
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem', color: '#786c5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              companion.app/play/a3f8c2e1…
            </Typography>
            <Chip label="Copy Link" size="small" sx={{ ml: 'auto', flexShrink: 0, bgcolor: 'transparent', color: '#c8a44a', border: '1px solid rgba(200,164,74,0.3)', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.62rem' }} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b0906', color: '#e6d8c0', overflowX: 'hidden' }}>
      {/* Nav */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: { xs: 3, md: 6 }, py: 2.5, borderBottom: '1px solid rgba(120,108,92,0.15)' }}>
        <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.04em' }}>
          The Companion
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="text" size="small" onClick={() => navigate('/login')} sx={{ color: '#786c5c', '&:hover': { color: '#e6d8c0' } }}>
            Sign In
          </Button>
          <Button variant="contained" size="small" onClick={() => navigate('/register')} sx={{ px: 2 }}>
            Get Started
          </Button>
        </Box>
      </Box>

      {/* Hero */}
      <Box
        component={motion.div}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        sx={{ textAlign: 'center', px: { xs: 3, md: 6 }, pt: { xs: 6, md: 10 }, pb: { xs: 4, md: 6 } }}
      >
        <Chip
          label="Built for Dungeon Masters"
          size="small"
          sx={{ mb: 3, bgcolor: '#1a160f', color: '#c8a44a', border: '1px solid rgba(200,164,74,0.3)', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem' }}
        />
        <Typography
          variant="h1"
          sx={{ fontFamily: '"Cinzel", serif', fontSize: { xs: '2.2rem', md: '3.5rem' }, fontWeight: 700, color: '#e6d8c0', lineHeight: 1.2, mb: 2.5, maxWidth: 700, mx: 'auto' }}
        >
          Your Campaign,{' '}
          <Box component="span" sx={{ color: '#c8a44a' }}>
            Fully in Hand
          </Box>
        </Typography>
        <Typography sx={{ color: '#786c5c', fontSize: { xs: '0.95rem', md: '1.05rem' }, maxWidth: 560, mx: 'auto', lineHeight: 1.7, mb: 4 }}>
          Track characters, decisions, factions, and sessions. Roll 3D animated dice. Share live character sheets with your players — all in one dark, focused tool.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" size="large" onClick={() => navigate('/register')} sx={{ px: 4, fontFamily: '"Cinzel", serif', letterSpacing: '0.05em' }}>
            Start for Free
          </Button>
          <Button variant="outlined" size="large" onClick={() => navigate('/login')} sx={{ px: 4, borderColor: 'rgba(120,108,92,0.4)', color: '#786c5c', '&:hover': { borderColor: '#c8a44a', color: '#c8a44a' } }}>
            Sign In
          </Button>
        </Box>
      </Box>

      {/* Preview mocks */}
      <Box sx={{ px: { xs: 2, md: 6 }, pb: 8, overflow: 'hidden' }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Grid container spacing={{ xs: 2, md: 3 }}>

          {/* Characters column */}
          <Grid item xs={12} md={4}>
            <Box
              component={motion.div}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#786c5c', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5 }}>
                Characters
              </Typography>
              <Box component={motion.div} variants={staggerContainer} initial="hidden" animate="visible" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {MOCK_CHARACTERS.map((c) => (
                  <motion.div key={c.name} variants={slideUp}>
                    <MockCharacterCard char={c} />
                  </motion.div>
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Decisions column */}
          <Grid item xs={12} md={4}>
            <Box
              component={motion.div}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#786c5c', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5 }}>
                Decisions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {/* Simple graph line connecting decisions */}
                {MOCK_DECISIONS.map((d, i) => (
                  <Box key={d.id}>
                    <motion.div variants={slideUp}>
                      <MockDecisionNode decision={d} />
                    </motion.div>
                    {i < MOCK_DECISIONS.length - 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', my: 0.25 }}>
                        <Box sx={{ width: '1px', height: 20, bgcolor: 'rgba(120,108,92,0.25)' }} />
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Stats + Factions column */}
          <Grid item xs={12} md={4}>
            <Box
              component={motion.div}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {/* Stats */}
              <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#786c5c', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5 }}>
                Campaign Stats
              </Typography>
              <motion.div variants={slideUp}>
                <Paper elevation={0} sx={{ p: 2, mb: 2.5, bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.25)', borderRadius: 1.5 }}>
                  <Grid container spacing={1.5}>
                    {MOCK_STATS.map((s) => (
                      <Grid item xs={6} key={s.label}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1.4rem', color: '#c8a44a', fontWeight: 700 }}>
                            {s.value}
                          </Typography>
                          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem', color: '#786c5c', textTransform: 'uppercase' }}>
                            {s.label}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </motion.div>

              {/* Factions */}
              <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#786c5c', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5 }}>
                Faction Reputation
              </Typography>
              <motion.div variants={slideUp}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.25)', borderRadius: 1.5 }}>
                  {MOCK_FACTIONS.map((f) => (
                    <MockFactionBar key={f.name} faction={f} />
                  ))}
                </Paper>
              </motion.div>
            </Box>
          </Grid>
        </Grid>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)', maxWidth: 1100, mx: 'auto' }} />

      {/* Decision graph section */}
      <Box sx={{ px: { xs: 2, md: 6 }, py: 8, bgcolor: '#0d0b08', borderTop: '1px solid rgba(120,108,92,0.12)', borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h4" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: { xs: '1.3rem', md: '1.6rem' }, mb: 0.5 }}>
                Visual Decision Trees
              </Typography>
              <Typography sx={{ color: '#786c5c', fontSize: '0.88rem', maxWidth: 420 }}>
                Map every branching choice your players face. Trace consequences across chapters, link encounters, and see the full story at a glance.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {[{ label: 'Ch. 3 · Sunken Vault', color: '#4a8fb5' }, { label: 'Ch. 4 · Hollow Covenant', color: '#a06db5' }, { label: 'Ch. 5 · Into the Abyss', color: '#b5734a' }].map((c) => (
                <Box key={c.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: c.color }} />
                  <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono", monospace' }}>{c.label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <MockDecisionGraph />
        </Box>
      </Box>

      {/* Wiki showcase */}
      <MockWikiShowcase />

      {/* Dice roller showcase */}
      <MockDiceShowcase />

      {/* Player view showcase */}
      <MockPlayerView />

      {/* Features grid */}
      <Box sx={{ px: { xs: 3, md: 6 }, py: 8, overflow: 'hidden' }}>
        <Typography variant="h4" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', textAlign: 'center', mb: 1, fontSize: { xs: '1.4rem', md: '1.8rem' } }}>
          Everything the DM Needs
        </Typography>
        <Typography sx={{ color: '#786c5c', textAlign: 'center', mb: 5, maxWidth: 480, mx: 'auto' }}>
          From the first session to the final boss — The Companion keeps your world organized.
        </Typography>
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
          <Grid container spacing={{ xs: 2, md: 2.5 }}>
            {FEATURES.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Paper elevation={0} sx={{ p: 2.5, height: '100%', bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.2)', borderRadius: 2, transition: 'border-color 0.2s', '&:hover': { borderColor: 'rgba(200,164,74,0.35)' } }}>
                  <Box sx={{ color: '#c8a44a', mb: 1.25 }}>{f.icon}</Box>
                  <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontWeight: 600, mb: 0.75, fontSize: '0.95rem' }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ color: '#786c5c', fontSize: '0.83rem', lineHeight: 1.6 }}>
                    {f.desc}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* CTA */}
      <Box sx={{ textAlign: 'center', px: 3, py: 8, borderTop: '1px solid rgba(120,108,92,0.15)' }}>
        <Typography variant="h4" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', mb: 1.5, fontSize: { xs: '1.4rem', md: '1.8rem' } }}>
          Ready to Run Your Best Campaign?
        </Typography>
        <Typography sx={{ color: '#786c5c', mb: 3, maxWidth: 400, mx: 'auto' }}>
          Free, no credit card required. Start tracking your world today.
        </Typography>
        <Button variant="contained" size="large" onClick={() => navigate('/register')} sx={{ px: 5, fontFamily: '"Cinzel", serif', letterSpacing: '0.05em', fontSize: '0.95rem' }}>
          Create Your Campaign
        </Button>
      </Box>

      {/* Footer */}
      <Box sx={{ borderTop: '1px solid rgba(120,108,92,0.1)', px: { xs: 2, md: 6 }, py: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#3a332a', fontSize: '0.85rem' }}>
          The Companion
        </Typography>
        <Typography sx={{ color: '#3a332a', fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace' }}>
          Built for DMs, by a DM.
        </Typography>
      </Box>
    </Box>
  )
}
