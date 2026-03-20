import { useState } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { slideUp, staggerContainer } from '../utils/motion'
import {
  Box, Typography, Grid, Button, Chip, CircularProgress, Alert,
  Divider, Tooltip, IconButton, List, ListItem, ListItemText,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import { useCampaign } from '../context/campaign'
import CharacterCard from '../components/CharacterCard'
import DecisionCard from '../components/DecisionCard'
import RelicGrid from '../components/RelicGrid'
import StatusBadge from '../components/StatusBadge'
import ChapterFormDialog from '../components/ChapterFormDialog'
import SessionFormDialog from '../components/SessionFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

const DASHBOARD = gql`
  query Dashboard($campaignId: ID!) {
    campaign(id: $campaignId) {
      id name system yearInGame playerCount shareToken
      activeChapter { id name status orderIndex summary }
      currentSession { id status sessionNumber title }
      chapters { id name status orderIndex summary }
      sessions { id sessionNumber title status playedAt dmNotes playerSummary }
      characters {
        id name role status hpCurrent hpMax corruptionStage corruptionMax miniPrinted location
      }
      decisions(status: ACTIVE) {
        id question status missionName
        chapter { name }
        branches { id label description consequence outcomeType orderIndex }
        chosenBranch { id label }
        incomingLinks { id fromDecision { id } fromBranch { id label } }
      }
      items {
        id name type description narrativeWeight locationFound inPossession
      }
    }
  }
`

const DELETE_CHAPTER = gql`
  mutation DeleteChapter($id: ID!) { deleteChapter(id: $id) }
`

const DELETE_SESSION = gql`
  mutation DeleteSession($id: ID!) { deleteSession(id: $id) }
`

const UPDATE_CHAPTER_STATUS = gql`
  mutation UpdateChapterStatus($id: ID!, $status: ChapterStatus!) {
    updateChapterStatus(id: $id, status: $status) { id status }
  }
`

const START_SESSION = gql`
  mutation StartSession($id: ID!) {
    startSession(id: $id) { id status }
  }
`

const CAMPAIGN_STATS = gql`
  query CampaignStats($campaignId: ID!) {
    campaignStats(campaignId: $campaignId) {
      totalPlayMinutes sessionsPlayed totalEncounters encountersWon
      npcsMet decisionsResolved enemiesKilled itemsCollected
      missionsCompleted chaptersCompleted
    }
  }
`

export default function Dashboard() {
  const navigate = useNavigate()
  const { campaignId } = useCampaign()

  const [chapterFormOpen, setChapterFormOpen] = useState(false)
  const [editChapter, setEditChapter] = useState<{ id: string; name: string; summary?: string | null; status: string; orderIndex: number } | null>(null)
  const [deleteChapterId, setDeleteChapterId] = useState<string | null>(null)
  const [deleteChapterName, setDeleteChapterName] = useState('')

  const [sessionFormOpen, setSessionFormOpen] = useState(false)
  const [editSession, setEditSession] = useState<{ id: string; sessionNumber: number; title?: string | null; dmNotes?: string | null; playerSummary?: string | null; playedAt?: string | null } | null>(null)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  const [deleteSessionNum, setDeleteSessionNum] = useState(0)

  const { data, loading, error, refetch } = useQuery(DASHBOARD, {
    variables: { campaignId },
    skip: !campaignId,
  })

  const { data: statsData } = useQuery(CAMPAIGN_STATS, {
    variables: { campaignId },
    skip: !campaignId,
  })

  const [deleteChapter, { loading: deletingChapter }] = useMutation(DELETE_CHAPTER)
  const [deleteSession, { loading: deletingSession }] = useMutation(DELETE_SESSION)
  const [updateChapterStatus] = useMutation(UPDATE_CHAPTER_STATUS)
  const [startSession] = useMutation(START_SESSION)

  const copyShareLink = () => {
    const token = data?.campaign?.shareToken
    if (token) navigator.clipboard.writeText(`${window.location.origin}/play/${token}`)
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
      <CircularProgress sx={{ color: '#c8a44a' }} />
    </Box>
  )

  if (!campaignId) return (
    <Box sx={{ pt: 4 }}>
      <Alert severity="info">No campaign selected. <Button onClick={() => navigate('/')}>Go to campaigns</Button></Alert>
    </Box>
  )

  if (error) return <Alert severity="error">{error.message}</Alert>

  const campaign = data?.campaign
  if (!campaign) return null

  const activeChars = campaign.characters?.filter((c: { status: string }) =>
    ['ACTIVE', 'UNKNOWN'].includes(c.status)
  ) ?? []
  const CRITICAL_WEIGHTS = ['critical', 'high']
  const storyCritical = campaign.items?.filter((i: { narrativeWeight?: string | null; inPossession: boolean }) =>
    CRITICAL_WEIGHTS.includes((i.narrativeWeight ?? '').toLowerCase()) && i.inPossession
  ) ?? []
  const chapters = campaign.chapters ?? []
  const sessions = campaign.sessions ?? []
  const nextSessionNumber = sessions.length > 0
    ? Math.max(...sessions.map((s: { sessionNumber: number }) => s.sessionNumber)) + 1
    : 1
  const nextChapterIndex = chapters.length > 0
    ? Math.max(...chapters.map((c: { orderIndex: number }) => c.orderIndex)) + 1
    : 0

  return (
    <Box
      component={motion.div}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <Box component={motion.div} variants={slideUp} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h3" sx={{ mb: 0.5 }}>{campaign.name}</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {campaign.system && <Chip label={campaign.system} size="small" sx={{ bgcolor: '#1a160f', color: '#b4a48a', fontSize: '0.72rem' }} />}
            {campaign.yearInGame && <Chip label={campaign.yearInGame} size="small" sx={{ bgcolor: '#1a160f', color: '#786c5c', fontFamily: '"JetBrains Mono"', fontSize: '0.7rem' }} />}
            {campaign.playerCount > 0 && <Chip label={`${campaign.playerCount} players`} size="small" sx={{ bgcolor: '#1a160f', color: '#786c5c', fontSize: '0.7rem' }} />}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Copy player share link">
            <IconButton onClick={copyShareLink} size="small" sx={{ color: '#c8a44a', border: '1px solid rgba(200,164,74,0.3)', borderRadius: 1 }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {campaign.currentSession ? (
            <Button variant="contained" startIcon={<PlayArrowIcon />}
              onClick={() => navigate(`/session/${campaign.currentSession.id}`)}
              color="secondary" size="small">
              Session {campaign.currentSession.sessionNumber} Active
            </Button>
          ) : (
            <Button variant="outlined" size="small" onClick={() => { setEditSession(null); setSessionFormOpen(true) }}>
              Start Session
            </Button>
          )}
        </Box>
      </Box>

      {/* Stats bar */}
      {statsData?.campaignStats && <CampaignStatsBar stats={statsData.campaignStats} />}

      <Grid container spacing={3}>
        {/* Left column: Chapters + Sessions */}
        <Grid item xs={12} md={4}>
          {/* Chapters */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ color: '#c8a44a' }}>Chapters</Typography>
              <Button size="small" startIcon={<AddIcon />} variant="outlined"
                onClick={() => { setEditChapter(null); setChapterFormOpen(true) }}
                sx={{ color: '#c8a44a', borderColor: 'rgba(200,164,74,0.3)', fontSize: '0.75rem' }}>
                Add
              </Button>
            </Box>
            <List disablePadding component={motion.ul} variants={staggerContainer}>
              {chapters.map((ch: { id: string; name: string; status: string; orderIndex: number; summary?: string | null }) => (
                <motion.div key={ch.id} variants={slideUp}>
                <ListItem sx={{
                  bgcolor: '#111009', borderRadius: 1, mb: 0.5, pr: 1,
                  border: ch.status === 'ACTIVE'
                    ? '1px solid rgba(200,164,74,0.4)'
                    : '1px solid rgba(120,108,92,0.2)',
                }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StatusBadge status={ch.status} />
                        <Typography sx={{ fontSize: '0.85rem', color: ch.status === 'ACTIVE' ? '#e6d8c0' : '#786c5c' }}>
                          {ch.name}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                    {ch.status === 'PENDING' && (
                      <Tooltip title="Set as Active">
                        <IconButton size="small"
                          onClick={() => updateChapterStatus({ variables: { id: ch.id, status: 'ACTIVE' } }).then(() => refetch())}
                          sx={{ color: '#62a870', '&:hover': { color: '#8ede9a' }, width: 24, height: 24 }}>
                          <PlayArrowIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {ch.status === 'ACTIVE' && (
                      <Tooltip title="Mark as Completed">
                        <IconButton size="small"
                          onClick={() => updateChapterStatus({ variables: { id: ch.id, status: 'COMPLETED' } }).then(() => refetch())}
                          sx={{ color: '#c8a44a', '&:hover': { color: '#e6d8c0' }, width: 24, height: 24 }}>
                          <CheckIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton size="small" onClick={() => { setEditChapter(ch); setChapterFormOpen(true) }}
                      sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 24, height: 24 }}>
                      <EditIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => { setDeleteChapterId(ch.id); setDeleteChapterName(ch.name) }}
                      sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, width: 24, height: 24 }}>
                      <DeleteIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                </ListItem>
                </motion.div>
              ))}
              {chapters.length === 0 && (
                <Typography sx={{ color: '#786c5c', fontSize: '0.82rem', textAlign: 'center', py: 2 }}>No chapters yet.</Typography>
              )}
            </List>
          </Box>

          {/* Sessions */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ color: '#c8a44a' }}>Sessions</Typography>
              <Button size="small" startIcon={<AddIcon />} variant="outlined"
                onClick={() => { setEditSession(null); setSessionFormOpen(true) }}
                sx={{ color: '#c8a44a', borderColor: 'rgba(200,164,74,0.3)', fontSize: '0.75rem' }}>
                Add
              </Button>
            </Box>
            <List disablePadding component={motion.ul} variants={staggerContainer}>
              {sessions.map((s: { id: string; sessionNumber: number; title?: string | null; status: string; dmNotes?: string | null; playerSummary?: string | null; playedAt?: string | null }) => (
                <motion.div key={s.id} variants={slideUp}>
                <ListItem
                  onClick={() => navigate(`/session/${s.id}`)}
                  sx={{ bgcolor: '#111009', borderRadius: 1, mb: 0.5, border: '1px solid rgba(120,108,92,0.2)', pr: 1, cursor: 'pointer', '&:hover': { borderColor: 'rgba(200,164,74,0.3)', bgcolor: '#151209' } }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.78rem', color: '#c8a44a', minWidth: 24 }}>
                          #{s.sessionNumber}
                        </Typography>
                        <StatusBadge status={s.status} />
                        <Typography sx={{ fontSize: '0.82rem', color: '#e6d8c0' }}>{s.title ?? `Session ${s.sessionNumber}`}</Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => { setEditSession(s); setSessionFormOpen(true) }}
                      sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 24, height: 24 }}>
                      <EditIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => { setDeleteSessionId(s.id); setDeleteSessionNum(s.sessionNumber) }}
                      sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, width: 24, height: 24 }}>
                      <DeleteIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                </ListItem>
                </motion.div>
              ))}
              {sessions.length === 0 && (
                <Typography sx={{ color: '#786c5c', fontSize: '0.82rem', textAlign: 'center', py: 2 }}>No sessions yet.</Typography>
              )}
            </List>
          </Box>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={8}>
          {/* Active decisions */}
          {campaign.decisions?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h6" sx={{ color: '#c8a44a' }}>Active Decisions</Typography>
                <Button size="small" variant="text" onClick={() => navigate('/decisions')} sx={{ color: '#786c5c', fontSize: '0.8rem' }}>
                  View all →
                </Button>
              </Box>
              <Box component={motion.div} variants={staggerContainer} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {campaign.decisions.map((d: { id: string }) => (
                  <DecisionCard key={d.id} decision={d as Parameters<typeof DecisionCard>[0]['decision']} />
                ))}
              </Box>
            </Box>
          )}

          {/* NPCs */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ color: '#c8a44a' }}>Active Characters</Typography>
              <Button size="small" variant="text" onClick={() => navigate('/characters')} sx={{ color: '#786c5c', fontSize: '0.8rem' }}>
                View all →
              </Button>
            </Box>
            <Grid container spacing={1.5} component={motion.div} variants={staggerContainer}>
              {activeChars.slice(0, 6).map((c: Parameters<typeof CharacterCard>[0]['character']) => (
                <Grid item xs={12} sm={6} key={c.id}>
                  <CharacterCard character={c} />
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Story-Critical Items */}
          {storyCritical.length > 0 && (
            <Box>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h6" sx={{ color: '#c8a44a' }}>Story-Critical Items</Typography>
                <Button size="small" variant="text" onClick={() => navigate('/items')} sx={{ color: '#786c5c', fontSize: '0.8rem' }}>
                  View all →
                </Button>
              </Box>
              <RelicGrid items={storyCritical} />
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Chapter dialogs */}
      <ChapterFormDialog
        open={chapterFormOpen}
        onClose={() => { setChapterFormOpen(false); setEditChapter(null) }}
        onSaved={() => refetch()}
        chapter={editChapter}
        nextOrderIndex={nextChapterIndex}
      />
      <ConfirmDeleteDialog
        open={!!deleteChapterId}
        title={`Delete chapter "${deleteChapterName}"?`}
        message="All missions and decisions linked to this chapter may be affected."
        onConfirm={async () => { if (deleteChapterId) { await deleteChapter({ variables: { id: deleteChapterId } }); setDeleteChapterId(null); refetch() } }}
        onClose={() => setDeleteChapterId(null)}
        loading={deletingChapter}
      />

      {/* Session dialogs */}
      <SessionFormDialog
        open={sessionFormOpen}
        onClose={() => { setSessionFormOpen(false); setEditSession(null) }}
        onSaved={() => refetch()}
        onCreated={async (sessionId) => {
          await startSession({ variables: { id: sessionId } })
          setSessionFormOpen(false)
          navigate(`/session/${sessionId}`)
        }}
        session={editSession}
        nextSessionNumber={nextSessionNumber}
      />
      <ConfirmDeleteDialog
        open={!!deleteSessionId}
        title={`Delete Session #${deleteSessionNum}?`}
        message="All session events and notes will be deleted."
        onConfirm={async () => { if (deleteSessionId) { await deleteSession({ variables: { id: deleteSessionId } }); setDeleteSessionId(null); refetch() } }}
        onClose={() => setDeleteSessionId(null)}
        loading={deletingSession}
      />
    </Box>
  )
}

interface Stats {
  totalPlayMinutes: number
  sessionsPlayed: number
  totalEncounters: number
  encountersWon: number
  npcsMet: number
  decisionsResolved: number
  enemiesKilled: number
  itemsCollected: number
  missionsCompleted: number
  chaptersCompleted: number
}

function formatPlayTime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Box
      component={motion.div}
      variants={slideUp}
      sx={{
        flex: '1 1 0', minWidth: 90, px: 1.5, py: 1.25,
        bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)',
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '1.3rem', color: '#c8a44a', lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: '0.6rem', color: '#62a870', fontFamily: '"JetBrains Mono"', lineHeight: 1 }}>
          {sub}
        </Typography>
      )}
      <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', mt: 0.25, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
    </Box>
  )
}

function CampaignStatsBar({ stats }: { stats: Stats }) {
  return (
    <Box component={motion.div} variants={staggerContainer} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
      <StatTile label="Play Time" value={formatPlayTime(stats.totalPlayMinutes)} />
      <StatTile label="Sessions" value={stats.sessionsPlayed} />
      <StatTile label="Encounters" value={stats.totalEncounters} sub={stats.encountersWon > 0 ? `${stats.encountersWon} won` : undefined} />
      <StatTile label="Decisions" value={stats.decisionsResolved} />
      <StatTile label="NPCs Met" value={stats.npcsMet} />
      <StatTile label="Enemies Killed" value={stats.enemiesKilled} />
      <StatTile label="Items Held" value={stats.itemsCollected} />
      <StatTile label="Missions Done" value={stats.missionsCompleted} />
      <StatTile label="Chapters Done" value={stats.chaptersCompleted} />
    </Box>
  )
}
