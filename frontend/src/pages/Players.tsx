import { useRef, useState } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Grid, Button, Card, CardContent, Chip,
  CircularProgress, Alert, LinearProgress, Divider, Tooltip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody,
  TableRow, TableCell, TextField,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import LinkIcon from '@mui/icons-material/Link'
import SyncIcon from '@mui/icons-material/Sync'
import EditIcon from '@mui/icons-material/Edit'
import PersonIcon from '@mui/icons-material/Person'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteIcon from '@mui/icons-material/Delete'
import FavoriteIcon from '@mui/icons-material/Favorite'
import ShieldIcon from '@mui/icons-material/Shield'
import { useCampaign } from '../context/campaign'
import { parseCharacterSheet } from '../utils/parseCharacterSheet'
import type { ParsedCharacterSheet } from '../utils/parseCharacterSheet'
import PlayerFormDialog from '../components/PlayerFormDialog'
import type { PlayerFormValues } from '../components/PlayerFormDialog'

const PLAYERS = gql`
  query Players($campaignId: ID!) {
    characters(campaignId: $campaignId, role: PLAYER) {
      id name description status hpMax hpCurrent armorClass speed stats extra tags
    }
  }
`
const CREATE_PLAYER = gql`
  mutation CreatePlayer($input: CreateCharacterInput!) {
    createCharacter(input: $input) { id name }
  }
`
const UPDATE_PLAYER = gql`
  mutation UpdatePlayer($id: ID!, $input: UpdateCharacterInput!) {
    updateCharacter(id: $id, input: $input) { id name hpMax hpCurrent armorClass speed stats extra }
  }
`
const DELETE_PLAYER = gql`
  mutation DeletePlayer($id: ID!) { deleteCharacter(id: $id) }
`

type ImportType = 'manual' | 'upload' | 'url'

type Player = {
  id: string; name: string; description?: string | null; status: string
  hpMax?: number | null; hpCurrent?: number | null; armorClass?: number | null
  speed?: number | null; stats?: Record<string, number>; extra: Record<string, unknown>; tags: string[]
}

type SheetExtra = ParsedCharacterSheet & {
  importType?: ImportType
  sheetUrl?: string
  lastSynced?: string
}

const ABILITY_ABBR: Record<string, string> = {
  strength: 'STR', dexterity: 'DEX', constitution: 'CON',
  intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
}
const MOD_KEY: Record<string, keyof ParsedCharacterSheet> = {
  strength: 'strengthMod', dexterity: 'dexterityMod', constitution: 'constitutionMod',
  intelligence: 'intelligenceMod', wisdom: 'wisdomMod', charisma: 'charismaMod',
}

const IMPORT_BADGE: Record<ImportType, { label: string; color: string }> = {
  manual: { label: 'Manual', color: '#786c5c' },
  upload: { label: 'PDF Upload', color: '#c8a44a' },
  url:    { label: 'D&D Beyond', color: '#62a870' },
}

function modStr(score: string | number | undefined): string {
  const n = typeof score === 'string' ? parseInt(score) : score
  if (n == null || isNaN(n)) return ''
  const m = Math.floor((n - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function SheetSection({ title, children, defaultExpanded = false }: {
  title: string; children: React.ReactNode; defaultExpanded?: boolean
}) {
  return (
    <Accordion disableGutters defaultExpanded={defaultExpanded}
      sx={{ bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.2)', '&:before': { display: 'none' }, mb: 0.5 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: '#786c5c' }} />}
        sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
        <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: '"JetBrains Mono"' }}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>{children}</AccordionDetails>
    </Accordion>
  )
}

/** Build the character input payload from a parsed sheet + importType metadata */
function sheetToInput(sheet: ParsedCharacterSheet, importType: ImportType, sheetUrl?: string) {
  const stats: Record<string, number> = {}
  if (sheet.strength) stats.STR = sheet.strength
  if (sheet.dexterity) stats.DEX = sheet.dexterity
  if (sheet.constitution) stats.CON = sheet.constitution
  if (sheet.intelligence) stats.INT = sheet.intelligence
  if (sheet.wisdom) stats.WIS = sheet.wisdom
  if (sheet.charisma) stats.CHA = sheet.charisma

  const extra: SheetExtra = {
    ...sheet,
    importType,
    ...(sheetUrl ? { sheetUrl, lastSynced: new Date().toISOString() } : {}),
  }

  return {
    name: sheet.name ?? 'Unknown',
    description: [sheet.race, sheet.class, sheet.background].filter(Boolean).join(' · ') || undefined,
    hpMax: sheet.hpMax,
    hpCurrent: sheet.hpMax,
    armorClass: sheet.armorClass,
    speed: sheet.speed ? parseInt(sheet.speed) || undefined : undefined,
    stats: Object.keys(stats).length ? stats : undefined,
    extra: extra as unknown as Record<string, unknown>,
  }
}

/** Build create/update payload from manual form values */
function formToInput(v: PlayerFormValues, importType: ImportType) {
  const scores = {
    strength: parseInt(v.strength) || undefined,
    dexterity: parseInt(v.dexterity) || undefined,
    constitution: parseInt(v.constitution) || undefined,
    intelligence: parseInt(v.intelligence) || undefined,
    wisdom: parseInt(v.wisdom) || undefined,
    charisma: parseInt(v.charisma) || undefined,
  }
  const stats: Record<string, number> = {}
  if (scores.strength) stats.STR = scores.strength
  if (scores.dexterity) stats.DEX = scores.dexterity
  if (scores.constitution) stats.CON = scores.constitution
  if (scores.intelligence) stats.INT = scores.intelligence
  if (scores.wisdom) stats.WIS = scores.wisdom
  if (scores.charisma) stats.CHA = scores.charisma

  const extra: SheetExtra = {
    importType,
    name: v.name || undefined,
    playerName: v.playerName || undefined,
    race: v.race || undefined,
    class: v.class || undefined,
    level: parseInt(v.level) || undefined,
    background: v.background || undefined,
    alignment: v.alignment || undefined,
    hpMax: parseInt(v.hpMax) || undefined,
    armorClass: parseInt(v.armorClass) || undefined,
    speed: v.speed || undefined,
    initiative: v.initiative || undefined,
    hitDice: v.hitDice || undefined,
    proficiencyBonus: v.proficiencyBonus || undefined,
    proficienciesAndLanguages: v.proficienciesAndLanguages || undefined,
    ...scores,
    strengthMod: scores.strength ? modStr(scores.strength) : undefined,
    dexterityMod: scores.dexterity ? modStr(scores.dexterity) : undefined,
    constitutionMod: scores.constitution ? modStr(scores.constitution) : undefined,
    intelligenceMod: scores.intelligence ? modStr(scores.intelligence) : undefined,
    wisdomMod: scores.wisdom ? modStr(scores.wisdom) : undefined,
    charismaMod: scores.charisma ? modStr(scores.charisma) : undefined,
  }

  const descParts = [v.race, v.class, v.background].filter(Boolean)
  return {
    name: v.name,
    description: v.description || (descParts.length ? descParts.join(' · ') : undefined),
    hpMax: parseInt(v.hpMax) || undefined,
    hpCurrent: parseInt(v.hpMax) || undefined,
    armorClass: parseInt(v.armorClass) || undefined,
    speed: v.speed ? parseInt(v.speed) || undefined : undefined,
    stats: Object.keys(stats).length ? stats : undefined,
    extra: extra as unknown as Record<string, unknown>,
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export default function Players() {
  const { campaignId } = useCampaign()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsing, setParsing] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  // Manual form
  const [manualOpen, setManualOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)

  // URL import dialog
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [sheetUrl, setSheetUrl] = useState('')

  const { data, loading, error } = useQuery(PLAYERS, {
    variables: { campaignId },
    skip: !campaignId,
  })
  const [createPlayer] = useMutation(CREATE_PLAYER, { refetchQueries: ['Players'] })
  const [updatePlayer] = useMutation(UPDATE_PLAYER, { refetchQueries: ['Players'] })
  const [deletePlayer, { loading: deleting }] = useMutation(DELETE_PLAYER, {
    refetchQueries: ['Players'],
    onCompleted: () => setDeleteId(null),
  })

  const players: Player[] = data?.characters ?? []

  // ── File Upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) { setParseError('Please select a PDF file.'); return }
    setParsing(true); setParseError(null)
    try {
      const sheet = await parseCharacterSheet(file)
      await createPlayer({ variables: { input: { campaignId, role: 'PLAYER', ...sheetToInput(sheet, 'upload') } } })
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse PDF.')
    } finally { setParsing(false) }
  }

  // ── URL Import ───────────────────────────────────────────────────────────
  const fetchAndParse = async (url: string): Promise<ParsedCharacterSheet> => {
    const res = await fetch(`${API_BASE}/api/proxy-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    return parseCharacterSheet(await res.arrayBuffer())
  }

  const handleUrlImport = async () => {
    const url = sheetUrl.trim()
    if (!url) return
    setUrlDialogOpen(false); setSheetUrl('')
    setParsing(true); setParseError(null)
    try {
      const sheet = await fetchAndParse(url)
      await createPlayer({ variables: { input: { campaignId, role: 'PLAYER', ...sheetToInput(sheet, 'url', url) } } })
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to import sheet.')
    } finally { setParsing(false) }
  }

  // ── Sync (re-fetch URL sheet) ────────────────────────────────────────────
  const handleSync = async (player: Player) => {
    const extra = player.extra as SheetExtra
    const url = extra.sheetUrl
    if (!url) return
    setSyncingId(player.id); setParseError(null)
    try {
      const sheet = await fetchAndParse(url)
      await updatePlayer({
        variables: { id: player.id, input: sheetToInput(sheet, 'url', url) },
      })
      // Refresh detail view if open
      if (selectedPlayer?.id === player.id) {
        setSelectedPlayer((prev) => prev ? { ...prev, ...sheetToInput(sheet, 'url', url), extra: { ...sheet, importType: 'url', sheetUrl: url, lastSynced: new Date().toISOString() } } : prev)
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Sync failed.')
    } finally { setSyncingId(null) }
  }

  // ── Manual Save ──────────────────────────────────────────────────────────
  const handleManualSave = async (values: PlayerFormValues) => {
    setManualOpen(false)
    const payload = formToInput(values, 'manual')
    if (editingPlayer) {
      await updatePlayer({ variables: { id: editingPlayer.id, input: payload } })
      if (selectedPlayer?.id === editingPlayer.id) {
        setSelectedPlayer((prev) => prev ? { ...prev, ...payload } : prev)
      }
    } else {
      await createPlayer({ variables: { input: { campaignId, role: 'PLAYER', ...payload } } })
    }
    setEditingPlayer(null)
  }

  // ── Edit button → pre-fill form ──────────────────────────────────────────
  const openEdit = (player: Player, e: React.MouseEvent) => {
    e.stopPropagation()
    const s = player.extra as SheetExtra
    setEditingPlayer(player)
    setManualOpen(true)
  }

  const sheet = selectedPlayer?.extra as SheetExtra | undefined

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Typography variant="h4">Players</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />
          <Button variant="outlined" size="small" startIcon={<LinkIcon />}
            onClick={() => setUrlDialogOpen(true)} disabled={parsing}
            sx={{ borderColor: 'rgba(98,168,112,0.4)', color: '#62a870', '&:hover': { borderColor: '#62a870' } }}>
            D&D Beyond URL
          </Button>
          <Button variant="outlined" size="small" startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()} disabled={parsing}
            sx={{ borderColor: 'rgba(200,164,74,0.4)', color: '#c8a44a', '&:hover': { borderColor: '#c8a44a' } }}>
            {parsing ? 'Parsing…' : 'Upload PDF'}
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => { setEditingPlayer(null); setManualOpen(true) }}
            sx={{ bgcolor: '#c8a44a', color: '#0b0906', '&:hover': { bgcolor: '#e6c86a' } }}>
            Manual Entry
          </Button>
        </Box>
      </Box>

      {parseError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setParseError(null)}>{parseError}</Alert>}
      {(parsing || syncingId) && <LinearProgress sx={{ mb: 2, '& .MuiLinearProgress-bar': { bgcolor: '#62a870' } }} />}

      {/* ── Empty state ── */}
      {players.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10, border: '1px dashed rgba(120,108,92,0.3)', borderRadius: 2 }}>
          <PersonIcon sx={{ fontSize: 40, color: '#786c5c', mb: 1 }} />
          <Typography sx={{ color: '#786c5c', mb: 2 }}>No player characters yet.</Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button size="small" startIcon={<LinkIcon />} onClick={() => setUrlDialogOpen(true)}
              sx={{ color: '#62a870', border: '1px solid rgba(98,168,112,0.3)' }}>
              Import from D&D Beyond URL
            </Button>
            <Button size="small" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}
              sx={{ color: '#c8a44a', border: '1px solid rgba(200,164,74,0.3)' }}>
              Upload PDF
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => { setEditingPlayer(null); setManualOpen(true) }}
              sx={{ color: '#786c5c', border: '1px solid rgba(120,108,92,0.3)' }}>
              Manual Entry
            </Button>
          </Box>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {players.map((p) => {
            const pSheet = p.extra as SheetExtra
            const importType: ImportType = pSheet.importType ?? 'upload'
            const badge = IMPORT_BADGE[importType]
            const hpPct = p.hpMax ? Math.max(0, ((p.hpCurrent ?? 0) / p.hpMax) * 100) : null
            const hpColor = hpPct != null ? (hpPct > 50 ? '#62a870' : hpPct > 25 ? '#c8a44a' : '#b84848') : '#786c5c'
            const isSyncing = syncingId === p.id

            return (
              <Grid item xs={12} md={6} lg={4} key={p.id}>
                <Card onClick={() => setSelectedPlayer(p)} sx={{
                  border: '1px solid rgba(98,168,112,0.2)', cursor: 'pointer',
                  '&:hover': { borderColor: 'rgba(98,168,112,0.45)' }, bgcolor: '#111009',
                }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    {/* Header row */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.95rem', color: '#e6d8c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </Typography>
                          <Chip label={badge.label} size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: 'transparent', color: badge.color, border: `1px solid ${badge.color}40`, flexShrink: 0 }} />
                        </Box>
                        {p.description && (
                          <Typography sx={{ fontSize: '0.7rem', color: '#786c5c' }}>{p.description}</Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4, flexWrap: 'wrap' }}>
                          {pSheet.class && <Chip label={pSheet.class} size="small" sx={{ height: 15, fontSize: '0.58rem', bgcolor: '#1a160f', color: '#c8a44a' }} />}
                          {pSheet.level && <Chip label={`Lv.${pSheet.level}`} size="small" sx={{ height: 15, fontSize: '0.58rem', bgcolor: '#1a160f', color: '#786c5c' }} />}
                        </Box>
                      </Box>
                      {/* Action buttons */}
                      <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0, ml: 0.5 }} onClick={(e) => e.stopPropagation()}>
                        {importType === 'url' && (
                          <Tooltip title={pSheet.lastSynced ? `Last synced ${new Date(pSheet.lastSynced).toLocaleDateString()}` : 'Sync from D&D Beyond'}>
                            <IconButton size="small" onClick={() => handleSync(p)} disabled={isSyncing}
                              sx={{ color: '#62a870', '&:hover': { color: '#8ede9a' }, width: 24, height: 24 }}>
                              <SyncIcon sx={{ fontSize: 13, animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                                '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={(e) => openEdit(p, e)}
                            sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 24, height: 24 }}>
                            <EditIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => setDeleteId(p.id)}
                          sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, width: 24, height: 24 }}>
                          <DeleteIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* HP bar */}
                    {p.hpMax != null && (
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <FavoriteIcon sx={{ fontSize: 9, color: hpColor }} />
                            <Typography sx={{ fontSize: '0.68rem', color: hpColor, fontFamily: '"JetBrains Mono"' }}>
                              {p.hpCurrent ?? p.hpMax}/{p.hpMax}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            {p.armorClass && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <ShieldIcon sx={{ fontSize: 9, color: '#786c5c' }} />
                                <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>AC {p.armorClass}</Typography>
                              </Box>
                            )}
                            {pSheet.speed && (
                              <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{pSheet.speed}</Typography>
                            )}
                          </Box>
                        </Box>
                        {hpPct != null && (
                          <LinearProgress variant="determinate" value={hpPct}
                            sx={{ height: 3, borderRadius: 1, bgcolor: 'rgba(120,108,92,0.2)', '& .MuiLinearProgress-bar': { bgcolor: hpColor, borderRadius: 1 } }} />
                        )}
                      </Box>
                    )}

                    {/* Ability scores */}
                    <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                      {Object.entries(ABILITY_ABBR).map(([key, abbr]) => {
                        const score = pSheet?.[key as keyof ParsedCharacterSheet] as number | undefined
                        const modVal = pSheet?.[MOD_KEY[key] as keyof ParsedCharacterSheet] as string | undefined
                          ?? (score != null ? modStr(score) : undefined)
                        if (!score) return null
                        return (
                          <Box key={abbr} sx={{ textAlign: 'center', px: 0.6, py: 0.2, bgcolor: '#0b0906', borderRadius: 0.5, border: '1px solid rgba(120,108,92,0.2)', minWidth: 34 }}>
                            <Typography sx={{ fontSize: '0.56rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{abbr}</Typography>
                            <Typography sx={{ fontSize: '0.82rem', color: '#e6d8c0', fontWeight: 700, fontFamily: '"JetBrains Mono"', lineHeight: 1 }}>{score}</Typography>
                            <Typography sx={{ fontSize: '0.58rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{modVal}</Typography>
                          </Box>
                        )
                      })}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* ── Character Sheet Detail Dialog ── */}
      <Dialog open={!!selectedPlayer} onClose={() => setSelectedPlayer(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(120,108,92,0.3)', maxHeight: '92vh' } }}>
        {selectedPlayer && sheet && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1.1rem', color: '#e6d8c0' }}>{selectedPlayer.name}</Typography>
                    {sheet.importType && (
                      <Chip label={IMPORT_BADGE[sheet.importType].label} size="small"
                        sx={{ height: 16, fontSize: '0.6rem', color: IMPORT_BADGE[sheet.importType].color, border: `1px solid ${IMPORT_BADGE[sheet.importType].color}50`, bgcolor: 'transparent' }} />
                    )}
                  </Box>
                  {sheet.playerName && <Typography sx={{ fontSize: '0.7rem', color: '#786c5c' }}>Player: {sheet.playerName}</Typography>}
                  {sheet.lastSynced && (
                    <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                      Synced {new Date(sheet.lastSynced).toLocaleString()}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    {sheet.race && <Chip label={sheet.race} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#1a160f', color: '#b4a48a' }} />}
                    {sheet.class && <Chip label={sheet.class} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#1a160f', color: '#c8a44a' }} />}
                    {sheet.level && <Chip label={`Level ${sheet.level}`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#1a160f', color: '#786c5c' }} />}
                    {sheet.background && <Chip label={sheet.background} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#1a160f', color: '#786c5c' }} />}
                    {sheet.alignment && <Chip label={sheet.alignment} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#1a160f', color: '#786c5c' }} />}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {sheet.importType === 'url' && sheet.sheetUrl && (
                    <Tooltip title="Re-sync from D&D Beyond">
                      <IconButton size="small" onClick={() => handleSync(selectedPlayer)} disabled={syncingId === selectedPlayer.id}
                        sx={{ color: '#62a870' }}>
                        <SyncIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={(e) => { setSelectedPlayer(null); openEdit(selectedPlayer, e) }}
                      sx={{ color: '#786c5c' }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </DialogTitle>

            <DialogContent sx={{ pt: 0.5 }}>
              {/* Combat stats row */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {[
                  { label: 'HP', value: selectedPlayer.hpMax != null ? `${selectedPlayer.hpCurrent ?? selectedPlayer.hpMax}/${selectedPlayer.hpMax}` : null, color: '#62a870' },
                  { label: 'AC', value: selectedPlayer.armorClass, color: '#c8a44a' },
                  { label: 'Speed', value: sheet.speed },
                  { label: 'Initiative', value: sheet.initiative },
                  { label: 'Hit Dice', value: sheet.hitDice },
                  { label: 'Prof.', value: sheet.proficiencyBonus },
                  { label: 'Spell DC', value: sheet.spellSaveDC },
                  { label: 'Pass. Perc.', value: sheet.passivePerception },
                ].filter((s) => s.value != null).map((s) => (
                  <Box key={s.label} sx={{ textAlign: 'center', px: 1, py: 0.5, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                    <Typography sx={{ fontSize: '0.58rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase' }}>{s.label}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: s.color ?? '#e6d8c0', fontWeight: 700, fontFamily: '"JetBrains Mono"' }}>{s.value}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Ability scores */}
              {[sheet.strength, sheet.dexterity, sheet.constitution, sheet.intelligence, sheet.wisdom, sheet.charisma].some(Boolean) && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  {Object.entries(ABILITY_ABBR).map(([key, abbr]) => {
                    const score = sheet[key as keyof ParsedCharacterSheet] as number | undefined
                    const modVal = sheet[MOD_KEY[key] as keyof ParsedCharacterSheet] as string | undefined
                      ?? (score != null ? modStr(score) : undefined)
                    if (!score) return null
                    return (
                      <Box key={abbr} sx={{ flex: 1, textAlign: 'center', py: 1, bgcolor: '#111009', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                        <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{abbr}</Typography>
                        <Typography sx={{ fontSize: '1.1rem', color: '#e6d8c0', fontWeight: 700, fontFamily: '"JetBrains Mono"', lineHeight: 1.2 }}>{score}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{modVal}</Typography>
                      </Box>
                    )
                  })}
                </Box>
              )}

              <Divider sx={{ mb: 1.5 }} />

              {sheet.weapons && sheet.weapons.length > 0 && (
                <SheetSection title={`Weapons (${sheet.weapons.length})`} defaultExpanded>
                  <Table size="small">
                    <TableBody>
                      {sheet.weapons.map((w, i) => (
                        <TableRow key={i} sx={{ '& td': { border: 0, py: 0.25 } }}>
                          <TableCell sx={{ color: '#e6d8c0', fontSize: '0.78rem', fontFamily: '"Cinzel", serif' }}>{w.name}</TableCell>
                          <TableCell sx={{ color: '#c8a44a', fontSize: '0.72rem', fontFamily: '"JetBrains Mono"' }}>{w.attackBonus}</TableCell>
                          <TableCell sx={{ color: '#b84848', fontSize: '0.72rem', fontFamily: '"JetBrains Mono"' }}>{w.damage}</TableCell>
                          <TableCell sx={{ color: '#786c5c', fontSize: '0.68rem' }}>{w.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </SheetSection>
              )}

              {sheet.savingThrows && Object.keys(sheet.savingThrows).length > 0 && (
                <SheetSection title="Saving Throws">
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {Object.entries(sheet.savingThrows).map(([stat, val]) => (
                      <Box key={stat} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', px: 1, py: 0.25, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                        <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>{stat}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', fontWeight: 700 }}>{val}</Typography>
                      </Box>
                    ))}
                  </Box>
                </SheetSection>
              )}

              {sheet.skills && Object.keys(sheet.skills).length > 0 && (
                <SheetSection title="Skills">
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {Object.entries(sheet.skills).map(([skill, val]) => (
                      <Box key={skill} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', px: 0.75, py: 0.2, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.15)' }}>
                        <Typography sx={{ fontSize: '0.63rem', color: '#786c5c' }}>{skill}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#b4a48a', fontFamily: '"JetBrains Mono"' }}>{val}</Typography>
                      </Box>
                    ))}
                    {sheet.customSkills?.map((cs) => (
                      <Box key={cs.name} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', px: 0.75, py: 0.2, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(200,164,74,0.2)' }}>
                        <Typography sx={{ fontSize: '0.63rem', color: '#c8a44a' }}>{cs.name}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#b4a48a', fontFamily: '"JetBrains Mono"' }}>{cs.bonus}</Typography>
                      </Box>
                    ))}
                  </Box>
                </SheetSection>
              )}

              {sheet.equipment && sheet.equipment.length > 0 && (
                <SheetSection title={`Equipment (${sheet.equipment.length})`}>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: sheet.currency ? 1 : 0 }}>
                    {sheet.equipment.map((item, i) => (
                      <Chip key={i} label={`${item.qty && item.qty !== '1' ? `${item.qty}× ` : ''}${item.name}`}
                        size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#0b0906', color: '#b4a48a', border: '1px solid rgba(120,108,92,0.2)' }} />
                    ))}
                  </Box>
                  {sheet.currency && Object.values(sheet.currency).some(Boolean) && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
                      {Object.entries(sheet.currency).map(([k, v]) => v ? (
                        <Box key={k} sx={{ textAlign: 'center', px: 1, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(200,164,74,0.2)' }}>
                          <Typography sx={{ fontSize: '0.58rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{k.toUpperCase()}</Typography>
                          <Typography sx={{ fontSize: '0.88rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{v}</Typography>
                        </Box>
                      ) : null)}
                    </Box>
                  )}
                </SheetSection>
              )}

              {sheet.featuresTraits && sheet.featuresTraits.length > 0 && (
                <SheetSection title="Features & Traits">
                  {sheet.featuresTraits.map((block, i) => (
                    <Typography key={i} sx={{ fontSize: '0.75rem', color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-wrap', mb: i < sheet.featuresTraits!.length - 1 ? 1.5 : 0 }}>
                      {block}
                    </Typography>
                  ))}
                </SheetSection>
              )}

              {sheet.actions && sheet.actions.length > 0 && (
                <SheetSection title="Actions">
                  {sheet.actions.map((block, i) => (
                    <Typography key={i} sx={{ fontSize: '0.75rem', color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-wrap', mb: i < sheet.actions!.length - 1 ? 1.5 : 0 }}>
                      {block}
                    </Typography>
                  ))}
                </SheetSection>
              )}

              {sheet.proficienciesAndLanguages && (
                <SheetSection title="Proficiencies & Languages">
                  <Typography sx={{ fontSize: '0.75rem', color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {sheet.proficienciesAndLanguages}
                  </Typography>
                </SheetSection>
              )}

              {[sheet.gender, sheet.age, sheet.height, sheet.weight, sheet.eyes, sheet.hair, sheet.skin].some(Boolean) && (
                <SheetSection title="Character Info">
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Gender', value: sheet.gender }, { label: 'Age', value: sheet.age },
                      { label: 'Height', value: sheet.height }, { label: 'Weight', value: sheet.weight ? `${sheet.weight} lb` : null },
                      { label: 'Eyes', value: sheet.eyes }, { label: 'Hair', value: sheet.hair },
                      { label: 'Skin', value: sheet.skin },
                    ].filter((s) => s.value).map((s) => (
                      <Box key={s.label} sx={{ px: 1, py: 0.25, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                        <Typography sx={{ fontSize: '0.58rem', color: '#786c5c' }}>{s.label}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a' }}>{s.value}</Typography>
                      </Box>
                    ))}
                  </Box>
                </SheetSection>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 2 }}>
              <Button onClick={() => setSelectedPlayer(null)} sx={{ color: '#786c5c' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── URL Import Dialog ── */}
      <Dialog open={urlDialogOpen} onClose={() => setUrlDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f0d0a', border: '1px solid rgba(98,168,112,0.25)' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.95rem' }}>
          Import from D&D Beyond
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: '#786c5c', mb: 2 }}>
            Paste the public PDF link. The URL looks like:<br />
            <span style={{ fontFamily: '"JetBrains Mono"', fontSize: '0.72rem', color: '#c8a44a' }}>
              https://www.dndbeyond.com/sheet-pdfs/Name_123456789.pdf
            </span>
          </Typography>
          <TextField
            label="Sheet PDF URL" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sheetUrl.trim() && handleUrlImport()}
            fullWidth size="small" autoFocus
            placeholder="https://www.dndbeyond.com/sheet-pdfs/..."
            InputProps={{ style: { fontFamily: '"JetBrains Mono"', fontSize: '0.82rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setUrlDialogOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={handleUrlImport} disabled={!sheetUrl.trim()} variant="contained" size="small"
            sx={{ bgcolor: '#62a870', color: '#0b0906', '&:hover': { bgcolor: '#8ede9a' } }}>
            Import & Parse
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Manual Entry / Edit Form ── */}
      <PlayerFormDialog
        open={manualOpen}
        onClose={() => { setManualOpen(false); setEditingPlayer(null) }}
        onSave={handleManualSave}
        title={editingPlayer ? `Edit — ${editingPlayer.name}` : 'New Player Character'}
        initial={editingPlayer ? (() => {
          const s = editingPlayer.extra as SheetExtra
          return {
            name: editingPlayer.name ?? '',
            playerName: s.playerName ?? '',
            race: s.race ?? '',
            class: s.class ?? '',
            level: s.level != null ? String(s.level) : '',
            background: s.background ?? '',
            alignment: s.alignment ?? '',
            hpMax: editingPlayer.hpMax != null ? String(editingPlayer.hpMax) : '',
            armorClass: editingPlayer.armorClass != null ? String(editingPlayer.armorClass) : '',
            speed: s.speed ?? '',
            initiative: s.initiative ?? '',
            hitDice: s.hitDice ?? '',
            proficiencyBonus: s.proficiencyBonus ?? '',
            strength: s.strength != null ? String(s.strength) : '',
            dexterity: s.dexterity != null ? String(s.dexterity) : '',
            constitution: s.constitution != null ? String(s.constitution) : '',
            intelligence: s.intelligence != null ? String(s.intelligence) : '',
            wisdom: s.wisdom != null ? String(s.wisdom) : '',
            charisma: s.charisma != null ? String(s.charisma) : '',
            description: editingPlayer.description ?? '',
            proficienciesAndLanguages: s.proficienciesAndLanguages ?? '',
          }
        })() : undefined}
      />

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs"
        PaperProps={{ sx: { bgcolor: '#0f0d0a' } }}>
        <DialogTitle sx={{ color: '#e6d8c0', fontSize: '0.95rem' }}>Remove Player?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#786c5c', fontSize: '0.85rem' }}>
            This will remove the player character from the campaign.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={() => deleteId && deletePlayer({ variables: { id: deleteId } })}
            disabled={deleting} variant="contained" size="small"
            sx={{ bgcolor: '#b84848', '&:hover': { bgcolor: '#d45f5f' } }}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
