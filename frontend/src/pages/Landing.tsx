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

function MockFactionBar({ faction }: { faction: typeof MOCK_FACTIONS[0] }) {
  const range = faction.repMax - faction.repMin
  const pct = ((faction.rep - faction.repMin) / range) * 100
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.82rem', color: '#e6d8c0' }}>{faction.name}</Typography>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem', color: faction.color }}>
          {faction.rep > 0 ? '+' : ''}{faction.rep}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{ height: 4, borderRadius: 2, bgcolor: '#2a231a', '& .MuiLinearProgress-bar': { bgcolor: faction.color, borderRadius: 2 } }}
      />
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
        <Typography sx={{ color: '#786c5c', fontSize: { xs: '0.95rem', md: '1.05rem' }, maxWidth: 520, mx: 'auto', lineHeight: 1.7, mb: 4 }}>
          Track characters, decisions, factions, encounters, and sessions — all in one dark, focused tool built for long-running TTRPG campaigns.
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
      <Box sx={{ px: { xs: 2, md: 6 }, pb: 8 }}>
        <Grid container spacing={3} sx={{ maxWidth: 1100, mx: 'auto' }}>

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
            <Box sx={{ display: 'flex', gap: 1.5 }}>
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

      {/* Features grid */}
      <Box sx={{ px: { xs: 3, md: 6 }, py: 8 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', textAlign: 'center', mb: 1, fontSize: { xs: '1.4rem', md: '1.8rem' } }}>
          Everything the DM Needs
        </Typography>
        <Typography sx={{ color: '#786c5c', textAlign: 'center', mb: 5, maxWidth: 480, mx: 'auto' }}>
          From the first session to the final boss — The Companion keeps your world organized.
        </Typography>
        <Grid container spacing={2.5} sx={{ maxWidth: 1100, mx: 'auto' }}>
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
      <Box sx={{ borderTop: '1px solid rgba(120,108,92,0.1)', px: 6, py: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
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
