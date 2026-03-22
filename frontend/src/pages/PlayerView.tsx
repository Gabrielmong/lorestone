import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, gql } from '@apollo/client'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import BookIcon from '@mui/icons-material/Book'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ViewListIcon from '@mui/icons-material/ViewList'
import ReputationBar from '../components/ReputationBar'
import StatusBadge from '../components/StatusBadge'
import PlayerDecisionTree from '../components/PlayerDecisionTree'
import DiceFab from '../components/DiceFab'

const PLAYER_VIEW = gql`
  query PlayerView($shareToken: String!) {
    playerView(shareToken: $shareToken) {
      campaign { name system yearInGame dmName }
      sessions { sessionNumber title playedAt playerSummary }
      items { name description type }
      factions { name reputation repMin repMax }
      characters { name description status role portraitUrl }
      stats {
        totalPlayMinutes sessionsPlayed totalEncounters encountersWon
        npcsMet decisionsResolved enemiesKilled itemsCollected
        missionsCompleted chaptersCompleted
      }
      resolvedDecisions {
        id question chosenLabel missionName chapterName chosenBranchId
        branches { id label outcomeType }
        incomingLinks { fromDecisionId fromBranchId }
      }
      missedDecisions {
        id question chosenLabel missionName chapterName chosenBranchId
        branches { id label outcomeType }
        incomingLinks { fromDecisionId fromBranchId }
      }
      encounters {
        id name status outcomeType participantCount linkedDecisionId outcomeDecisionId
      }
      chapterLanes { name colorIndex }
    }
  }
`

export default function PlayerView() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [decisionView, setDecisionView] = useState<'list' | 'tree'>('tree')

  const { data, loading, error } = useQuery(PLAYER_VIEW, {
    variables: { shareToken },
    skip: !shareToken,
  })

  if (loading) {
    return (
      <Box sx={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0b0906' }}>
        <CircularProgress sx={{ color: '#c8a44a' }} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0b0906' }}>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error.message.includes('not found') ? 'This campaign link is invalid or has expired.' : error.message}
        </Alert>
      </Box>
    )
  }

  const view = data?.playerView
  if (!view) return null

  const { campaign, sessions, items, factions, resolvedDecisions, missedDecisions, encounters, stats, chapterLanes } = view
  const characters = (view.characters as Array<{ name: string; description?: string | null; status: string; role: string; portraitUrl?: string | null }>)
    .filter((c) => c.role !== 'MONSTER')

  return (
    <Box sx={{ minHeight: '100svh', bgcolor: '#0b0906', py: 4, px: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography variant="h2" sx={{ mb: 0.5 }}>{campaign.name}</Typography>
          {campaign.dmName && (
            <Typography sx={{ fontSize: '0.82rem', color: '#786c5c', mb: 0.75, fontFamily: '"JetBrains Mono"' }}>
              Dungeon Master: <Typography component="span" sx={{ color: '#b4a48a', fontFamily: '"JetBrains Mono"' }}>{campaign.dmName}</Typography>
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {campaign.system && <Chip label={campaign.system} size="small" sx={{ bgcolor: '#1a160f', color: '#b4a48a' }} />}
            {campaign.yearInGame && <Chip label={campaign.yearInGame} size="small" sx={{ bgcolor: '#1a160f', color: '#786c5c', fontFamily: '"JetBrains Mono"' }} />}
          </Box>
        </Box>

        {/* Stats */}
        {stats && <PlayerStatsBar stats={stats} />}

        <Grid container spacing={3}>
          {/* Items in possession */}
          {items.length > 0 && (
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AutoAwesomeIcon sx={{ color: '#c8a44a' }} />
                <Typography variant="h5">Items in Possession</Typography>
              </Box>
              {items.map((item: { name: string; description?: string | null; type: string }) => (
                <Box key={item.name} sx={{ mb: 1, p: 1.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(200,164,74,0.15)' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.25 }}>
                    <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.9rem', color: '#c8a44a' }}>
                      {item.name}
                    </Typography>
                    <StatusBadge status={item.type} />
                  </Box>
                  {item.description && (
                    <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.8rem' }}>
                      {item.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Grid>
          )}

          {/* Faction reputations */}
          {factions.length > 0 && (
            <Grid item xs={12} md={6}>
              <Typography variant="h5" sx={{ mb: 2 }}>Faction Standing</Typography>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  {factions.map((f: { name: string; reputation: number; repMin: number; repMax: number }, i: number) => (
                    <Box key={f.name}>
                      {i > 0 && <Divider sx={{ my: 1.5 }} />}
                      <ReputationBar
                        name={f.name}
                        reputation={f.reputation}
                        repMin={f.repMin}
                        repMax={f.repMax}
                        readonly
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Characters met */}
          {characters.length > 0 && (
            <Grid item xs={12} md={6}>
              <Typography variant="h5" sx={{ mb: 2 }}>Characters Encountered</Typography>
              <Grid container spacing={1}>
                {characters.map((c) => (
                  <Grid item xs={12} key={c.name}>
                    <Box sx={{ p: 1.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)', display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      {c.portraitUrl && (
                        <Box component="img" src={c.portraitUrl} alt={c.name}
                          sx={{ width: 44, height: 44, borderRadius: 1, objectFit: 'cover', objectPosition: 'top', flexShrink: 0, border: '1px solid rgba(120,108,92,0.25)' }} />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mb: c.description ? 0.35 : 0, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.9rem', color: '#e6d8c0' }}>
                            {c.name}
                          </Typography>
                          <StatusBadge status={c.status} />
                        </Box>
                        {c.description && (
                          <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.78rem' }}>
                            {c.description.length > 120 ? c.description.slice(0, 117) + '…' : c.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}

          {/* Choices Made — list or story tree */}
          {resolvedDecisions.length > 0 && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Story Choices</Typography>
                <ToggleButtonGroup
                  value={decisionView}
                  exclusive
                  onChange={(_, v) => v && setDecisionView(v)}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      color: '#786c5c', borderColor: 'rgba(120,108,92,0.3)', px: 1.5,
                      '&.Mui-selected': { color: '#c8a44a', bgcolor: 'rgba(200,164,74,0.1)', borderColor: 'rgba(200,164,74,0.4)' },
                    },
                  }}
                >
                  <ToggleButton value="tree">
                    <AccountTreeIcon fontSize="small" sx={{ mr: 0.5 }} />Story Tree
                  </ToggleButton>
                  <ToggleButton value="list">
                    <ViewListIcon fontSize="small" sx={{ mr: 0.5 }} />List
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {decisionView === 'tree' ? (
                <PlayerDecisionTree
                decisions={resolvedDecisions}
                missedDecisions={missedDecisions}
                encounters={encounters}
                chapterLanes={chapterLanes ?? []}
                shareToken={shareToken ?? ''}
              />
              ) : (
                <List disablePadding>
                  {resolvedDecisions.map((d: {
                    id: string; question: string; chosenLabel: string; missionName?: string | null
                    chosenBranchId: string; branches: Array<{ id: string; label: string; outcomeType: string }>
                  }) => (
                    <ListItem key={d.id} sx={{ px: 0, py: 0.5 }}>
                      <Box sx={{ width: '100%', p: 1.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                        {d.missionName && (
                          <Typography sx={{ fontSize: '0.65rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', mb: 0.25 }}>
                            {d.missionName}
                          </Typography>
                        )}
                        <Typography sx={{ color: '#b4a48a', fontSize: '0.88rem', fontFamily: '"Cinzel", serif', mb: 1 }}>
                          {d.question}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {d.branches.map((b) => {
                            const isChosen = b.id === d.chosenBranchId
                            const color = isChosen
                              ? ({ GOOD: '#62a870', BAD: '#b84848', NEUTRAL: '#c8a44a', VARIABLE: '#c8a44a' }[b.outcomeType] ?? '#c8a44a')
                              : '#786c5c'
                            return (
                              <Box key={b.id} sx={{
                                display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1,
                                bgcolor: isChosen ? `${color}14` : 'transparent',
                                border: `1px solid ${isChosen ? `${color}40` : 'rgba(120,108,92,0.12)'}`,
                              }}>
                                <Box sx={{
                                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                                  bgcolor: isChosen ? color : 'transparent',
                                  border: `1.5px solid ${isChosen ? color : 'rgba(120,108,92,0.35)'}`,
                                }} />
                                <Typography sx={{ fontSize: '0.82rem', color, fontWeight: isChosen ? 600 : 400, flex: 1 }}>
                                  {b.label}
                                </Typography>
                                {isChosen && (
                                  <Typography sx={{ fontSize: '0.62rem', color, fontFamily: '"JetBrains Mono"', opacity: 0.8 }}>
                                    chosen
                                  </Typography>
                                )}
                              </Box>
                            )
                          })}
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Grid>
          )}
        </Grid>

        {/* Sessions — timeline */}
        {sessions.length > 0 && (
          <Box sx={{ mt: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BookIcon sx={{ color: '#c8a44a' }} />
              <Typography variant="h5">Campaign Journal</Typography>
            </Box>
            {sessions.map((s: { sessionNumber: number; title?: string | null; playedAt?: string | null; playerSummary?: string | null }) => (
              <Card key={s.sessionNumber} sx={{ mb: 1.5, border: '1px solid rgba(200,164,74,0.15)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                      Session {s.sessionNumber}{s.title ? ` — ${s.title}` : ''}
                    </Typography>
                    {s.playedAt && (
                      <Typography variant="caption" sx={{ color: '#786c5c', fontFamily: '"JetBrains Mono"', fontSize: '0.72rem' }}>
                        {new Date(s.playedAt).toLocaleDateString()}
                      </Typography>
                    )}
                  </Box>
                  {s.playerSummary ? (
                    <Typography variant="body2" sx={{ color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                      {s.playerSummary}
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#786c5c', fontStyle: 'italic' }}>
                      No summary recorded for this session.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ mt: 6, textAlign: 'center', borderTop: '1px solid rgba(120,108,92,0.2)', pt: 3 }}>
          <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.75rem', fontStyle: 'italic' }}>
            This journal is shared by your DM. It contains only what your party has discovered so far.
          </Typography>
        </Box>
      </Box>

      {/* Draggable dice FAB */}
      <DiceFab />
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

function PlayerStatsBar({ stats }: { stats: Stats }) {
  const tiles = [
    { label: 'Play Time', value: formatPlayTime(stats.totalPlayMinutes) },
    { label: 'Sessions', value: stats.sessionsPlayed },
    { label: 'Encounters', value: stats.totalEncounters, sub: stats.encountersWon > 0 ? `${stats.encountersWon} won` : undefined },
    { label: 'Decisions', value: stats.decisionsResolved },
    { label: 'NPCs Met', value: stats.npcsMet },
    { label: 'Enemies Slain', value: stats.enemiesKilled },
    { label: 'Items Held', value: stats.itemsCollected },
    { label: 'Missions Done', value: stats.missionsCompleted },
    { label: 'Chapters Done', value: stats.chaptersCompleted },
  ].filter((t) => Number(t.value) !== 0 || t.label === 'Play Time')

  if (tiles.every((t) => t.value === 0 || t.value === '0m')) return null

  return (
    <Box sx={{ mb: 5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {tiles.map((t) => (
          <Box key={t.label} sx={{
            flex: '1 1 0', minWidth: 80, px: 1.5, py: 1.25,
            bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)',
            textAlign: 'center',
          }}>
            <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '1.25rem', color: '#c8a44a', lineHeight: 1.2 }}>
              {t.value}
            </Typography>
            {t.sub && (
              <Typography sx={{ fontSize: '0.6rem', color: '#62a870', fontFamily: '"JetBrains Mono"', lineHeight: 1 }}>
                {t.sub}
              </Typography>
            )}
            <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', mt: 0.25, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
