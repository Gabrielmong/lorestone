import { useQuery, gql } from '@apollo/client'
import { Box, Typography, Grid, CircularProgress, Alert, Paper } from '@mui/material'
import { useCampaign } from '../context/campaign'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts'

const ANALYTICS = gql`
  query Analytics($campaignId: ID!) {
    analytics(campaignId: $campaignId) {
      sessionActivity {
        sessionNumber playedAt durationMinutes rollCount encounterCount xpGained goldGained
      }
      characterRollStats {
        characterName totalRolls nat20s nat1s avgTotal
      }
      factionRepTimelines {
        factionId factionName color
        points { sessionNumber reputation }
      }
      characterHPTimelines {
        characterId characterName
        points { sessionNumber hpCurrent hpMax }
      }
      activityHeatmap { date count }
      encounterStats {
        encounterId encounterName totalRounds damageDealt damageTaken enemiesKilled
      }
    }
  }
`

const CHART_BG = '#111009'
const AXIS_COLOR = '#786c5c'
const GOLD = '#c8a44a'
const RED = '#b84848'
const GREEN = '#62a870'
const PURPLE = '#8884d8'

const FACTION_COLORS = ['#c8a44a', '#62a870', '#b84848', '#7bb8d4', '#d49db8', '#a8c87b', '#d4a07b']

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2, bgcolor: CHART_BG, border: '1px solid rgba(120,108,92,0.25)', borderRadius: 1 }}>
      <Typography sx={{ fontSize: '0.72rem', color: AXIS_COLOR, textTransform: 'uppercase', letterSpacing: 1, mb: 2, fontFamily: '"JetBrains Mono"' }}>
        {title}
      </Typography>
      {children}
    </Paper>
  )
}

const tickStyle = { fill: AXIS_COLOR, fontSize: 10, fontFamily: 'JetBrains Mono' }
const tooltipStyle = { contentStyle: { bgcolor: '#0f0d0a', border: '1px solid rgba(120,108,92,0.4)', fontSize: 11, borderRadius: 4, fontFamily: 'JetBrains Mono' }, labelStyle: { color: GOLD } }

export default function Analytics() {
  const { campaignId } = useCampaign()

  const { data, loading, error } = useQuery(ANALYTICS, {
    fetchPolicy: 'network-only',
    variables: { campaignId },
    skip: !campaignId,
  })

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: GOLD }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  const a = data?.analytics
  if (!a) return <Box sx={{ pt: 4, textAlign: 'center' }}><Typography sx={{ color: AXIS_COLOR }}>No analytics data yet. Start playing!</Typography></Box>

  const sessionLabels = a.sessionActivity.map((s: { sessionNumber: number }) => `#${s.sessionNumber}`)

  // Nat20 / Nat1 pie data per character
  const rollPieData = a.characterRollStats.flatMap((c: { characterName: string; nat20s: number; nat1s: number; totalRolls: number }) => [
    { name: `${c.characterName} Nat20`, value: c.nat20s },
    { name: `${c.characterName} Nat1`, value: c.nat1s },
  ]).filter((d: { value: number }) => d.value > 0)

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Cinzel", serif', color: GOLD, mb: 3 }}>
        Analytics
      </Typography>

      <Grid container spacing={2.5}>

        {/* Session Activity */}
        {a.sessionActivity.length > 0 && (
          <Grid item xs={12} lg={6}>
            <ChartCard title="Session Duration (minutes)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={a.sessionActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,108,92,0.15)" />
                  <XAxis dataKey="sessionNumber" tick={tickStyle} tickFormatter={(v) => `#${v}`} />
                  <YAxis tick={tickStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="durationMinutes" fill={GOLD} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* Rolls per session */}
        {a.sessionActivity.length > 0 && (
          <Grid item xs={12} lg={6}>
            <ChartCard title="Dice Rolls per Session">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={a.sessionActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,108,92,0.15)" />
                  <XAxis dataKey="sessionNumber" tick={tickStyle} tickFormatter={(v) => `#${v}`} />
                  <YAxis tick={tickStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="rollCount" fill={PURPLE} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* XP & Gold per session */}
        {a.sessionActivity.some((s: { xpGained: number; goldGained: number }) => s.xpGained > 0 || s.goldGained > 0) && (
          <Grid item xs={12} lg={6}>
            <ChartCard title="XP & Gold per Session">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={a.sessionActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,108,92,0.15)" />
                  <XAxis dataKey="sessionNumber" tick={tickStyle} tickFormatter={(v) => `#${v}`} />
                  <YAxis tick={tickStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: AXIS_COLOR }} />
                  <Bar dataKey="xpGained" name="XP" fill={GREEN} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="goldGained" name="Gold" fill={GOLD} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* Character roll stats */}
        {a.characterRollStats.length > 0 && (
          <Grid item xs={12} lg={6}>
            <ChartCard title="Character Roll Stats">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={a.characterRollStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,108,92,0.15)" />
                  <XAxis type="number" tick={tickStyle} />
                  <YAxis type="category" dataKey="characterName" tick={tickStyle} width={80} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: AXIS_COLOR }} />
                  <Bar dataKey="totalRolls" name="Total Rolls" fill={PURPLE} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="nat20s" name="Nat 20s" fill={GREEN} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="nat1s" name="Nat 1s" fill={RED} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* Nat 20 / Nat 1 Pie */}
        {rollPieData.length > 0 && (
          <Grid item xs={12} md={4}>
            <ChartCard title="Critical Rolls Breakdown">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={rollPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {rollPieData.map((_: unknown, i: number) => (
                      <Cell key={i} fill={i % 2 === 0 ? GREEN : RED} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* Faction rep timelines */}
        {a.factionRepTimelines.length > 0 && (
          <Grid item xs={12} lg={8}>
            <ChartCard title="Faction Reputation Over Time">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,108,92,0.15)" />
                  <XAxis type="category" dataKey="sessionNumber" tick={tickStyle} tickFormatter={(v) => `#${v}`}
                    allowDuplicatedCategory={false} />
                  <YAxis tick={tickStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: AXIS_COLOR }} />
                  {a.factionRepTimelines.map((f: { factionId: string; factionName: string; color?: string | null; points: Array<{ sessionNumber: number; reputation: number }> }, i: number) => (
                    <Line
                      key={f.factionId}
                      data={f.points}
                      type="monotone"
                      dataKey="reputation"
                      name={f.factionName}
                      stroke={f.color ?? FACTION_COLORS[i % FACTION_COLORS.length]}
                      dot={{ r: 3 }}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* Character HP timelines */}
        {a.characterHPTimelines.length > 0 && (
          <Grid item xs={12} lg={8}>
            <ChartCard title="Character HP Over Time">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,108,92,0.15)" />
                  <XAxis type="category" dataKey="sessionNumber" tick={tickStyle} tickFormatter={(v) => `#${v}`}
                    allowDuplicatedCategory={false} />
                  <YAxis tick={tickStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: AXIS_COLOR }} />
                  {a.characterHPTimelines.map((c: { characterId: string; characterName: string; points: Array<{ sessionNumber: number; hpCurrent: number }> }, i: number) => (
                    <Line
                      key={c.characterId}
                      data={c.points}
                      type="monotone"
                      dataKey="hpCurrent"
                      name={c.characterName}
                      stroke={FACTION_COLORS[i % FACTION_COLORS.length]}
                      dot={{ r: 3 }}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* Encounter stats */}
        {a.encounterStats.length > 0 && (
          <Grid item xs={12} lg={6}>
            <ChartCard title="Encounter Stats">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={a.encounterStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,108,92,0.15)" />
                  <XAxis type="number" tick={tickStyle} />
                  <YAxis type="category" dataKey="encounterName" tick={tickStyle} width={100} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: AXIS_COLOR }} />
                  <Bar dataKey="totalRounds" name="Rounds" fill={PURPLE} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="enemiesKilled" name="Kills" fill={RED} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* Activity heatmap (simple bar chart by day) */}
        {a.activityHeatmap.length > 0 && (
          <Grid item xs={12}>
            <ChartCard title="Activity by Day">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={a.activityHeatmap}>
                  <XAxis dataKey="date" tick={tickStyle} interval="preserveStartEnd" />
                  <YAxis tick={tickStyle} width={25} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill={GOLD} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        {/* Summary stats */}
        {sessionLabels.length === 0 && a.characterRollStats.length === 0 && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ color: AXIS_COLOR }}>
                No data yet. Play some sessions, run some encounters, and roll some dice!
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
