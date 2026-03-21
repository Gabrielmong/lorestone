import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Box, Typography, IconButton, Tooltip, TextField, CircularProgress,
  Chip, Select, MenuItem, FormControl, InputLabel, Dialog, DialogContent, useTheme, useMediaQuery,
  LinearProgress, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CodeIcon from '@mui/icons-material/Code'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CloseIcon from '@mui/icons-material/Close'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import MapIcon from '@mui/icons-material/Map'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import { useCampaign } from '../context/campaign'

// ── GraphQL ────────────────────────────────────────────────────────────────────

const MISSIONS = gql`
  query Missions($campaignId: ID!) {
    missions(campaignId: $campaignId) {
      id name type status description content orderIndex
      chapter { id name }
      maps { id name url key }
      decisions { id question status }
      items { id name type description }
    }
  }
`

const CHAPTERS = gql`
  query MissionChapters($campaignId: ID!) {
    campaign(id: $campaignId) {
      id
      chapters { id name orderIndex }
    }
  }
`

const DECISIONS_FOR_LINK = gql`
  query DecisionsForMission($campaignId: ID!) {
    decisions(campaignId: $campaignId) {
      id question status missionId: missionName
    }
  }
`

const DECISIONS_LINKABLE = gql`
  query DecisionsLinkable($campaignId: ID!) {
    decisions(campaignId: $campaignId) {
      id question status
    }
  }
`

const CREATE_MISSION = gql`
  mutation CreateMission($input: CreateMissionInput!) {
    createMission(input: $input) { id name type status content description orderIndex maps { id name url key } decisions { id question status } }
  }
`

const UPDATE_MISSION = gql`
  mutation UpdateMission($id: ID!, $input: UpdateMissionInput!) {
    updateMission(id: $id, input: $input) { id name type status content description updatedAt }
  }
`

const DELETE_MISSION = gql`
  mutation DeleteMission($id: ID!) { deleteMission(id: $id) }
`

const ADD_MAP = gql`
  mutation AddMissionMap($missionId: ID!, $name: String!, $url: String!, $key: String!) {
    addMissionMap(missionId: $missionId, name: $name, url: $url, key: $key) { id name url key }
  }
`

const DELETE_MAP = gql`
  mutation DeleteMissionMap($id: ID!) { deleteMissionMap(id: $id) }
`

const LINK_DECISION = gql`
  mutation LinkDecision($id: ID!, $input: UpdateDecisionInput!) {
    updateDecision(id: $id, input: $input) { id missionName }
  }
`

const LINK_ITEM = gql`
  mutation LinkItem($id: ID!, $input: UpdateItemInput!) {
    updateItem(id: $id, input: $input) { id }
  }
`

const CAMPAIGN_ITEMS = gql`
  query MissionCampaignItems($campaignId: ID!) {
    items(campaignId: $campaignId) { id name type description }
  }
`

// ── Types ─────────────────────────────────────────────────────────────────────

type MissionMap = { id: string; name: string; url: string; key: string }
type LinkedDecision = { id: string; question: string; status: string }
type LootItem = { id: string; name: string; type: string; description?: string | null }
type Mission = {
  id: string; name: string; type: string; status: string
  description: string | null; content: string | null; orderIndex: number
  chapterId?: string | null
  chapter: { id: string; name: string } | null
  maps: MissionMap[]; decisions: LinkedDecision[]; items: LootItem[]
}

// ── Status / Type helpers ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#786c5c', ACTIVE: '#4a90d9', COMPLETED: '#62a870', FAILED: '#b84848',
}
const TYPE_ICONS: Record<string, string> = { MAIN: '🎯', SECONDARY: '⚔️', OPTIONAL: '🌿', HIDDEN: '👁️' }

// ── Toolbar button style ──────────────────────────────────────────────────────

const TBTN = (active: boolean) => ({
  color: active ? '#c8a44a' : '#786c5c',
  '&:hover': { color: '#c8a44a', bgcolor: 'transparent' },
  p: 0.4, borderRadius: 0.5,
})

// ── Map Lightbox ──────────────────────────────────────────────────────────────

function MapLightbox({ maps, initialIndex, onClose }: {
  maps: MissionMap[]; initialIndex: number; onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  const map = maps[idx]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(maps.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maps.length, onClose])

  return (
    <Dialog open fullScreen PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)' } }} onClose={onClose}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid rgba(120,108,92,0.2)' }}>
          <Typography sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '0.9rem' }}>
            {map?.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ color: '#786c5c', fontSize: '0.78rem' }}>{idx + 1} / {maps.length}</Typography>
            <IconButton onClick={onClose} sx={{ color: '#786c5c', '&:hover': { color: '#e6d8c0' } }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Image */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          {idx > 0 && (
            <IconButton onClick={() => setIdx((i) => i - 1)} sx={{ position: 'absolute', left: 8, color: '#e6d8c0', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
              <NavigateBeforeIcon sx={{ fontSize: 32 }} />
            </IconButton>
          )}
          <Box component="img" src={map?.url} alt={map?.name}
            sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none' }}
          />
          {idx < maps.length - 1 && (
            <IconButton onClick={() => setIdx((i) => i + 1)} sx={{ position: 'absolute', right: 8, color: '#e6d8c0', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
              <NavigateNextIcon sx={{ fontSize: 32 }} />
            </IconButton>
          )}
        </Box>

        {/* Thumbnail strip */}
        {maps.length > 1 && (
          <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1.5, overflowX: 'auto', borderTop: '1px solid rgba(120,108,92,0.15)' }}>
            {maps.map((m, i) => (
              <Box key={m.id} onClick={() => setIdx(i)}
                sx={{ width: 64, height: 48, flexShrink: 0, cursor: 'pointer', borderRadius: 1, overflow: 'hidden',
                  outline: i === idx ? '2px solid #c8a44a' : '2px solid transparent', transition: 'outline 0.15s' }}>
                <Box component="img" src={m.url} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Dialog>
  )
}

// ── Collapsible section ────────────────────────────────────────────────────────

function Section({ title, icon, count, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Box sx={{ borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
      <Box onClick={() => setOpen((v) => !v)} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'rgba(120,108,92,0.05)' } }}>
        <Box sx={{ color: '#786c5c', display: 'flex', fontSize: 13 }}>{icon}</Box>
        <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: '"JetBrains Mono"', flex: 1 }}>{title}</Typography>
        {count !== undefined && count > 0 && (
          <Typography sx={{ fontSize: '0.65rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{count}</Typography>
        )}
        <Typography sx={{ fontSize: '0.6rem', color: '#786c5c', lineHeight: 1 }}>{open ? '▲' : '▼'}</Typography>
      </Box>
      {open && <Box sx={{ px: 1.5, pb: 1.5 }}>{children}</Box>}
    </Box>
  )
}

// ── Mission Editor ─────────────────────────────────────────────────────────────

function MissionEditor({ mission, allDecisions, allItems, chapters, onSave, onAddMap, onDeleteMap, onLinkDecision, onUnlinkDecision, onLinkItem, onUnlinkItem, uploadUrl }: {
  mission: Mission
  allDecisions: { id: string; question: string; status: string }[]
  allItems: { id: string; name: string; type: string; description?: string | null }[]
  chapters: { id: string; name: string; orderIndex: number }[]
  onSave: (id: string, data: Partial<Pick<Mission, 'name' | 'content' | 'status' | 'type' | 'description' | 'chapterId'>>) => void
  onAddMap: (missionId: string, file: File) => void
  onDeleteMap: (mapId: string) => void
  onLinkDecision: (decisionId: string, missionId: string) => void
  onUnlinkDecision: (decisionId: string) => void
  onLinkItem: (itemId: string, missionId: string) => void
  onUnlinkItem: (itemId: string) => void
  uploadUrl: string
}) {
  const editorTheme = useTheme()
  const isMobileEditor = useMediaQuery(editorTheme.breakpoints.down('md'))
  const [name, setName] = useState(mission.name)
  const [status, setStatus] = useState(mission.status)
  const [type, setType] = useState(mission.type)
  const [chapterId, setChapterId] = useState(mission.chapter?.id ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showLinkDecision, setShowLinkDecision] = useState(false)
  const [showLinkItem, setShowLinkItem] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(() => parseInt(localStorage.getItem('missions-right-panel-width') ?? '260'))
  const [sheetOpen, setSheetOpen] = useState(false)
  const PEEK_HEIGHT = 48
  const mapInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rightResizingRef = useRef(false)
  const rightResizeStartXRef = useRef(0)
  const rightResizeStartWidthRef = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!rightResizingRef.current) return
      // Moving left = panel grows, moving right = panel shrinks
      const w = Math.max(200, Math.min(520, rightResizeStartWidthRef.current - (e.clientX - rightResizeStartXRef.current)))
      setRightPanelWidth(w); localStorage.setItem('missions-right-panel-width', String(w))
    }
    const onUp = () => { rightResizingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => { setName(mission.name); setStatus(mission.status); setType(mission.type); setChapterId(mission.chapter?.id ?? '') }, [mission.id])

  const triggerSave = useCallback((data: Parameters<typeof onSave>[1]) => {
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onSave(mission.id, data)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 700)
  }, [mission.id, onSave])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Describe the mission…' }),
      Underline, TaskList, TaskItem.configure({ nested: true }),
    ],
    content: mission.content || '',
    onUpdate({ editor }) {
      const html = editor.getHTML()
      if (contentTimer.current) clearTimeout(contentTimer.current)
      contentTimer.current = setTimeout(() => triggerSave({ content: html === '<p></p>' ? '' : html }), 700)
    },
    editorProps: {
      attributes: { style: 'outline:none; min-height:40vh; font-size:1rem; color:#c8b89a; line-height:1.75; font-family:"Crimson Pro", Georgia, serif' },
    },
  })

  useEffect(() => {
    if (!editor) return
    const incoming = mission.content || ''
    const current = editor.getHTML()
    if (current !== incoming) editor.commands.setContent(incoming, { emitUpdate: false })
  }, [mission.id, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapUpload = async (file: File) => {
    if (!uploadUrl) { setUploadError('Upload not configured (set R2 env vars)'); return }
    setUploading(true); setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(uploadUrl, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
      const { url, key } = await res.json()
      onAddMap(mission.id, { url, key, name: file.name.replace(/\.[^.]+$/, '') } as unknown as File)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (mapInputRef.current) mapInputRef.current.value = ''
    }
  }

  const unlinkedDecisions = useMemo(() =>
    allDecisions.filter((d) => !mission.decisions.some((ld) => ld.id === d.id)),
    [allDecisions, mission.decisions]
  )
  const unlinkedItems = useMemo(() =>
    allItems.filter((i) => !mission.items.some((li) => li.id === i.id)),
    [allItems, mission.items]
  )

  if (!editor) return null

  const btn = TBTN

  const panelSections = (
    <>
      {/* Maps */}
      <Section title="Maps" icon={<MapIcon sx={{ fontSize: 13 }} />} count={mission.maps.length}>
        <input ref={mapInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.[0]) handleMapUpload(e.target.files[0]) }} />
        {uploading && <LinearProgress sx={{ mb: 1, height: 2, borderRadius: 1, bgcolor: 'rgba(120,108,92,0.15)', '& .MuiLinearProgress-bar': { bgcolor: '#c8a44a' } }} />}
        {uploadError && <Alert severity="error" sx={{ mb: 1, fontSize: '0.7rem', py: 0.25 }} onClose={() => setUploadError(null)}>{uploadError}</Alert>}
        {mission.maps.length === 0 ? (
          <Box onClick={() => mapInputRef.current?.click()} sx={{ border: '1px dashed rgba(120,108,92,0.25)', borderRadius: 1, py: 1.5, textAlign: 'center', cursor: 'pointer', '&:hover': { borderColor: 'rgba(200,164,74,0.3)' } }}>
            <Typography sx={{ color: '#786c5c', fontSize: '0.72rem' }}>Click to upload</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1 }}>
              {mission.maps.map((map, i) => (
                <Box key={map.id} sx={{ position: 'relative', aspectRatio: '4/3', borderRadius: 1, overflow: 'hidden', cursor: 'pointer', '&:hover .map-del': { opacity: 1 }, '&:hover img': { filter: 'brightness(0.7)' } }}
                  onClick={() => setLightboxIdx(i)}>
                  <Box component="img" src={map.url} alt={map.name} sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'filter 0.15s', display: 'block' }} />
                  <Typography sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 0.5, py: 0.25, fontSize: '0.6rem', color: '#e6d8c0', bgcolor: 'rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{map.name}</Typography>
                  <IconButton className="map-del" size="small" onClick={(e) => { e.stopPropagation(); onDeleteMap(map.id) }}
                    sx={{ position: 'absolute', top: 2, right: 2, p: 0.25, color: '#fff', bgcolor: 'rgba(184,72,72,0.8)', opacity: 0, transition: 'opacity 0.15s', '&:hover': { bgcolor: 'rgba(184,72,72,1)' } }}>
                    <DeleteIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
            <Box onClick={() => mapInputRef.current?.click()} sx={{ textAlign: 'center', cursor: 'pointer', py: 0.5 }}>
              <Typography sx={{ color: '#786c5c', fontSize: '0.68rem', '&:hover': { color: '#c8a44a' } }}>+ Upload map</Typography>
            </Box>
          </>
        )}
      </Section>

      {/* Loot */}
      <Section title="Loot" icon={<Typography sx={{ fontSize: 13 }}>💰</Typography>} count={mission.items.length}>
        <Tooltip title="Link item">
          <IconButton size="small" onClick={() => setShowLinkItem((v) => !v)}
            sx={{ color: showLinkItem ? '#c8a44a' : '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.5, mb: 0.5 }}>
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        {showLinkItem && (
          <Box sx={{ mb: 1, border: '1px solid rgba(120,108,92,0.2)', borderRadius: 1, maxHeight: 160, overflow: 'auto', bgcolor: '#0b0906' }}>
            {unlinkedItems.length === 0
              ? <Typography sx={{ px: 1.5, py: 1, fontSize: '0.72rem', color: '#786c5c' }}>No items to link.</Typography>
              : unlinkedItems.map((item) => (
                <Box key={item.id} onClick={() => { onLinkItem(item.id, mission.id); setShowLinkItem(false) }}
                  sx={{ px: 1.5, py: 0.6, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(200,164,74,0.08)' }, borderBottom: '1px solid rgba(120,108,92,0.1)' }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a' }}>{item.name}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>{item.type}</Typography>
                </Box>
              ))
            }
          </Box>
        )}
        {mission.items.length === 0
          ? <Typography sx={{ fontSize: '0.72rem', color: '#786c5c' }}>No loot linked yet.</Typography>
          : mission.items.map((item) => (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(120,108,92,0.08)' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>{item.type}</Typography>
              </Box>
              <Tooltip title="Unlink">
                <IconButton size="small" onClick={() => onUnlinkItem(item.id)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, p: 0.25, flexShrink: 0 }}>
                  <LinkOffIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))
        }
      </Section>

      {/* Decisions */}
      <Section title="Decisions" icon={<LinkIcon sx={{ fontSize: 13 }} />} count={mission.decisions.length}>
        <Tooltip title="Link decision">
          <IconButton size="small" onClick={() => setShowLinkDecision((v) => !v)}
            sx={{ color: showLinkDecision ? '#c8a44a' : '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.5, mb: 0.5 }}>
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        {showLinkDecision && (
          <Box sx={{ mb: 1, border: '1px solid rgba(120,108,92,0.2)', borderRadius: 1, maxHeight: 160, overflow: 'auto', bgcolor: '#0b0906' }}>
            {unlinkedDecisions.length === 0
              ? <Typography sx={{ px: 1.5, py: 1, fontSize: '0.72rem', color: '#786c5c' }}>All decisions linked.</Typography>
              : unlinkedDecisions.map((d) => (
                <Box key={d.id} onClick={() => { onLinkDecision(d.id, mission.id); setShowLinkDecision(false) }}
                  sx={{ px: 1.5, py: 0.6, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(200,164,74,0.08)' }, borderBottom: '1px solid rgba(120,108,92,0.1)' }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a' }}>{d.question}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>{d.status}</Typography>
                </Box>
              ))
            }
          </Box>
        )}
        {mission.decisions.length === 0
          ? <Typography sx={{ fontSize: '0.72rem', color: '#786c5c' }}>No decisions linked yet.</Typography>
          : mission.decisions.map((d) => (
            <Box key={d.id} sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(120,108,92,0.08)' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.question}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: STATUS_COLORS[d.status] ?? '#786c5c' }}>{d.status}</Typography>
              </Box>
              <Tooltip title="Unlink">
                <IconButton size="small" onClick={() => onUnlinkDecision(d.id)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, p: 0.25, flexShrink: 0 }}>
                  <LinkOffIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))
        }
      </Section>
    </>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', gap: 0.25, px: 2, py: 0.75, alignItems: 'center', flexShrink: 0,
        overflowX: 'auto', overflowY: 'hidden', flexWrap: 'nowrap',
        borderBottom: '1px solid rgba(120,108,92,0.15)',
        position: 'sticky', top: 0, bgcolor: '#0f0d0a', zIndex: 1,
        '&::-webkit-scrollbar': { height: 2 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(120,108,92,0.3)' },
      }}>
        {([1, 2, 3] as const).map((level) => (
          <Tooltip key={level} title={`Heading ${level}`}>
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level }).run() }} sx={btn(editor.isActive('heading', { level }))}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: '"JetBrains Mono"', lineHeight: 1 }}>H{level}</Typography>
            </IconButton>
          </Tooltip>
        ))}
        <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16, flexShrink: 0 }} />
        <Tooltip title="Bold"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }} sx={btn(editor.isActive('bold'))}><FormatBoldIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Italic"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }} sx={btn(editor.isActive('italic'))}><FormatItalicIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Underline"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }} sx={btn(editor.isActive('underline'))}><FormatUnderlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16, flexShrink: 0 }} />
        <Tooltip title="Bullet list"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }} sx={btn(editor.isActive('bulletList'))}><FormatListBulletedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Numbered list"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }} sx={btn(editor.isActive('orderedList'))}><FormatListNumberedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Task list"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleTaskList().run() }} sx={btn(editor.isActive('taskList'))}><CheckBoxOutlineBlankIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16, flexShrink: 0 }} />
        <Tooltip title="Code"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run() }} sx={btn(editor.isActive('codeBlock'))}><CodeIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Quote"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run() }} sx={btn(editor.isActive('blockquote'))}><FormatQuoteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {saveStatus === 'saving' && <CircularProgress size={10} sx={{ color: '#786c5c' }} />}
          {saveStatus !== 'idle' && <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>{saveStatus === 'saving' ? 'Saving…' : 'Saved'}</Typography>}
        </Box>
      </Box>

      {/* Two-column body */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* ── Left: rich text ── */}
        <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 2, md: 5 }, py: 4, minWidth: 0, pb: isMobileEditor ? `${PEEK_HEIGHT + 16}px` : 4 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, lineHeight: 1 }}>{TYPE_ICONS[type] ?? '🎯'}</Typography>
              <TextField
                value={name} variant="standard" fullWidth placeholder="Mission name"
                onChange={(e) => { setName(e.target.value); triggerSave({ name: e.target.value }) }}
                inputProps={{ style: { fontSize: isMobileEditor ? '1.3rem' : '1.8rem', fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontWeight: 700, padding: 0 } }}
                sx={{ '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' } }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Select size="small" value={type} onChange={(e) => { setType(e.target.value); onSave(mission.id, { type: e.target.value }) }}
                sx={{ fontSize: '0.78rem', color: '#b4a48a', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(120,108,92,0.3)' }, '& .MuiSvgIcon-root': { color: '#786c5c' }, minWidth: 110 }}>
                <MenuItem value="MAIN">🎯 Main</MenuItem>
                <MenuItem value="SECONDARY">⚔️ Secondary</MenuItem>
                <MenuItem value="OPTIONAL">🌿 Optional</MenuItem>
                <MenuItem value="HIDDEN">👁️ Hidden</MenuItem>
              </Select>
              <Select size="small" value={status} onChange={(e) => { setStatus(e.target.value); onSave(mission.id, { status: e.target.value }) }}
                sx={{ fontSize: '0.78rem', color: STATUS_COLORS[status] ?? '#786c5c', '& .MuiOutlinedInput-notchedOutline': { borderColor: STATUS_COLORS[status] ?? 'rgba(120,108,92,0.3)' }, '& .MuiSvgIcon-root': { color: '#786c5c' }, minWidth: 110 }}>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="FAILED">Failed</MenuItem>
              </Select>
              {chapters.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel sx={{ fontSize: '0.72rem', color: '#786c5c' }}>Chapter</InputLabel>
                  <Select value={chapterId} label="Chapter"
                    onChange={(e) => { setChapterId(e.target.value); onSave(mission.id, { chapterId: e.target.value || null }) }}
                    sx={{ fontSize: '0.78rem', color: '#b4a48a', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(120,108,92,0.3)' }, '& .MuiSvgIcon-root': { color: '#786c5c' } }}>
                    <MenuItem value=""><em style={{ color: '#786c5c' }}>None</em></MenuItem>
                    {chapters.map((ch) => <MenuItem key={ch.id} value={ch.id}>{ch.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
            </Box>
          </Box>

          {/* Rich text */}
          <Box sx={{
            '.tiptap': { outline: 'none' },
            '.tiptap p': { my: 0.5 },
            '.tiptap h1': { fontFamily: '"Cinzel", serif', fontSize: '1.5rem', color: '#e6d8c0', mt: 2, mb: 0.75 },
            '.tiptap h2': { fontFamily: '"Cinzel", serif', fontSize: '1.2rem', color: '#e6d8c0', mt: 1.75, mb: 0.5 },
            '.tiptap h3': { fontFamily: '"Cinzel", serif', fontSize: '1rem', color: '#c8b89a', mt: 1.5, mb: 0.5 },
            '.tiptap strong': { color: '#e6d8c0', fontWeight: 700 },
            '.tiptap em': { color: '#b4a48a', fontStyle: 'italic' },
            '.tiptap ul, .tiptap ol': { pl: 3, my: 0.5 },
            '.tiptap li': { my: 0.25 },
            '.tiptap blockquote': { borderLeft: '3px solid rgba(200,164,74,0.4)', pl: 2, ml: 0, my: 1, color: '#786c5c', fontStyle: 'italic' },
            '.tiptap code': { fontFamily: '"JetBrains Mono"', fontSize: '0.82em', bgcolor: 'rgba(120,108,92,0.15)', px: 0.5, borderRadius: 0.5, color: '#c8a44a' },
            '.tiptap pre': { bgcolor: '#111009', p: 2, borderRadius: 1, my: 1, border: '1px solid rgba(120,108,92,0.2)', '& code': { bgcolor: 'transparent', p: 0, color: '#c8a44a', fontSize: '0.85rem' } },
            '.tiptap hr': { border: 'none', borderTop: '1px solid rgba(120,108,92,0.2)', my: 2 },
            '.tiptap ul[data-type="taskList"]': { listStyle: 'none', pl: 1 },
            '.tiptap li[data-type="taskItem"]': { display: 'flex', alignItems: 'flex-start', gap: 1, my: 0.25 },
            '.tiptap li[data-type="taskItem"] > label input': { accentColor: '#c8a44a', width: 14, height: 14 },
            '.tiptap li[data-type="taskItem"] > div': { flex: 1 },
            '.tiptap p.is-editor-empty:first-child::before': { content: 'attr(data-placeholder)', color: 'rgba(120,108,92,0.4)', pointerEvents: 'none', float: 'left', height: 0 },
          }}>
            <EditorContent editor={editor} />
          </Box>
        </Box>

        {/* ── Resize handle (desktop only) ── */}
        {!isMobileEditor && (
          <Box
            onMouseDown={(e) => { rightResizingRef.current = true; rightResizeStartXRef.current = e.clientX; rightResizeStartWidthRef.current = rightPanelWidth; e.preventDefault() }}
            sx={{ width: 4, flexShrink: 0, cursor: 'col-resize', bgcolor: 'rgba(120,108,92,0.15)', transition: 'background-color 0.15s', '&:hover': { bgcolor: 'rgba(200,164,74,0.4)' }, userSelect: 'none' }}
          />
        )}

        {/* ── Desktop: right panel ── */}
        {!isMobileEditor && (
          <Box sx={{ width: rightPanelWidth, flexShrink: 0, borderLeft: '1px solid rgba(120,108,92,0.12)', overflow: 'auto', bgcolor: '#0d0b08' }}>
            {panelSections}
          </Box>
        )}

        {/* ── Mobile: bottom sheet ── */}
        {isMobileEditor && (
          <Box sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            height: sheetOpen ? '68vh' : PEEK_HEIGHT,
            transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
            bgcolor: '#0d0b08',
            borderTop: '1px solid rgba(120,108,92,0.25)',
            borderRadius: sheetOpen ? '12px 12px 0 0' : 0,
            display: 'flex', flexDirection: 'column',
            zIndex: 1200,
            boxShadow: sheetOpen ? '0 -4px 24px rgba(0,0,0,0.5)' : 'none',
          }}>
            {/* Handle / peek strip */}
            <Box onClick={() => setSheetOpen((v) => !v)} sx={{
              flexShrink: 0, height: PEEK_HEIGHT, display: 'flex', alignItems: 'center',
              px: 2, gap: 2, cursor: 'pointer', userSelect: 'none',
            }}>
              {/* Drag pill */}
              <Box sx={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 32, height: 3, borderRadius: 2, bgcolor: 'rgba(120,108,92,0.4)' }} />
              {/* Summary badges */}
              {[
                { label: 'Maps', count: mission.maps.length, icon: '🗺️' },
                { label: 'Loot', count: mission.items.length, icon: '💰' },
                { label: 'Decisions', count: mission.decisions.length, icon: '🔗' },
              ].map(({ label, count, icon }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.75rem' }}>{icon}</Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
                  {count > 0 && (
                    <Box sx={{ bgcolor: 'rgba(200,164,74,0.15)', borderRadius: 0.75, px: 0.6, lineHeight: 1.4 }}>
                      <Typography sx={{ fontSize: '0.6rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{count}</Typography>
                    </Box>
                  )}
                </Box>
              ))}
              <Box sx={{ ml: 'auto', color: '#786c5c', fontSize: '0.6rem', lineHeight: 1 }}>{sheetOpen ? '▼' : '▲'}</Box>
            </Box>

            {/* Scrollable content */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {panelSections}
            </Box>
          </Box>
        )}

      </Box>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <MapLightbox maps={mission.maps} initialIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </Box>
  )
}

// ── Main Missions page ─────────────────────────────────────────────────────────

export default function Missions() {
  const { campaignId } = useCampaign()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [searchParams] = useSearchParams()
  const urlId = searchParams.get('id')
  const [selectedId, setSelectedId] = useState<string | null>(() => urlId ?? localStorage.getItem(`missions-last-${campaignId}`) ?? null)
  const [showSidebar, setShowSidebar] = useState(!isMobile || !selectedId)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('missions-sidebar-width') ?? '260'))
  const isResizingRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const w = Math.max(180, Math.min(480, resizeStartWidthRef.current + e.clientX - resizeStartXRef.current))
      setSidebarWidth(w); localStorage.setItem('missions-sidebar-width', String(w))
    }
    const onUp = () => { isResizingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const uploadUrl = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'}/api/upload/map`

  const { data, refetch } = useQuery(MISSIONS, { variables: { campaignId }, skip: !campaignId, fetchPolicy: 'cache-and-network' })
  const { data: decisionData } = useQuery(DECISIONS_LINKABLE, { variables: { campaignId }, skip: !campaignId, fetchPolicy: 'cache-and-network' })
  const { data: chaptersData } = useQuery(CHAPTERS, { variables: { campaignId }, skip: !campaignId })
  const { data: itemsData } = useQuery(CAMPAIGN_ITEMS, { variables: { campaignId }, skip: !campaignId })

  const [createMission] = useMutation(CREATE_MISSION)
  const [updateMission] = useMutation(UPDATE_MISSION)
  const [deleteMission] = useMutation(DELETE_MISSION, { refetchQueries: ['Missions'] })
  const [addMap] = useMutation(ADD_MAP, { refetchQueries: ['Missions'] })
  const [deleteMap] = useMutation(DELETE_MAP, { refetchQueries: ['Missions'] })
  const [linkDecision] = useMutation(LINK_DECISION, { refetchQueries: ['Missions'] })
  const [linkItem] = useMutation(LINK_ITEM, { refetchQueries: ['Missions'] })

  const missions: Mission[] = data?.missions ?? []
  const allDecisions = decisionData?.decisions ?? []
  const allItems: LootItem[] = itemsData?.items ?? []

  const chapters: { id: string; name: string; orderIndex: number }[] =
    (chaptersData?.campaign?.chapters ?? []).slice().sort((a: { orderIndex: number }, b: { orderIndex: number }) => a.orderIndex - b.orderIndex)
  const selectedMission = missions.find((m) => m.id === selectedId) ?? null

  const groupedMissions = useMemo(() => {
    const map = new Map<string, { label: string; orderIndex: number; missions: Mission[] }>()
    missions.forEach((m) => {
      const key = m.chapter?.id ?? '__none__'
      const label = m.chapter?.name ?? 'No Chapter'
      const orderIndex = chapters.findIndex((c) => c.id === m.chapter?.id)
      if (!map.has(key)) map.set(key, { label, orderIndex: orderIndex === -1 ? 999 : orderIndex, missions: [] })
      map.get(key)!.missions.push(m)
    })
    return Array.from(map.values()).sort((a, b) => a.orderIndex - b.orderIndex)
  }, [missions, chapters])


  const handleSelect = (id: string) => {
    setSelectedId(id)
    localStorage.setItem(`missions-last-${campaignId}`, id)
    if (isMobile) setShowSidebar(false)
  }

  const handleCreate = async () => {
    const res = await createMission({ variables: { input: { campaignId, name: 'New Mission', type: 'MAIN' } } })
    const id = res.data?.createMission?.id
    await refetch()
    if (id) { setSelectedId(id); localStorage.setItem(`missions-last-${campaignId}`, id); if (isMobile) setShowSidebar(false) }
  }

  const handleSave = useCallback(async (id: string, data: Partial<Pick<Mission, 'name' | 'content' | 'status' | 'type' | 'description' | 'chapterId'>>) => {
    await updateMission({ variables: { id, input: data } })
  }, [updateMission])

  const handleDelete = async (id: string) => {
    if (selectedId === id) { setSelectedId(null); localStorage.removeItem(`missions-last-${campaignId}`) }
    await deleteMission({ variables: { id } })
    setPendingDeleteId(null)
  }

  const handleAddMap = async (missionId: string, fileOrMeta: File | { url: string; key: string; name: string }) => {
    const meta = fileOrMeta as { url: string; key: string; name: string }
    await addMap({ variables: { missionId, name: meta.name, url: meta.url, key: meta.key } })
  }

  const handleDeleteMap = async (mapId: string) => {
    await deleteMap({ variables: { id: mapId } })
  }

  const handleLinkDecision = async (decisionId: string, missionId: string) => {
    const mission = missions.find((m) => m.id === missionId)
    await linkDecision({ variables: { id: decisionId, input: { missionId, missionName: mission?.name ?? '' } } })
  }

  const handleUnlinkDecision = async (decisionId: string) => {
    await linkDecision({ variables: { id: decisionId, input: { missionId: null, missionName: null } } })
  }

  const handleLinkItem = async (itemId: string, missionId: string) => {
    await linkItem({ variables: { id: itemId, input: { missionId } } })
  }

  const handleUnlinkItem = async (itemId: string) => {
    await linkItem({ variables: { id: itemId, input: { missionId: null } } })
  }

  return (
    <Box sx={{ display: 'flex', height: isMobile ? 'calc(100vh - 68px)' : 'calc(100vh)', overflow: 'hidden', mx: { xs: -2, md: -3 }, mt: { xs: 0, md: -3 }, mb: { xs: -2, md: -3 } }}>

      {/* Sidebar */}
      {(!isMobile || showSidebar) && (
        <Box sx={{
          width: sidebarWidth, flexShrink: 0, display: 'flex', flexDirection: 'column',
          bgcolor: '#0d0b08', height: '100%', overflow: 'hidden',
          ...(isMobile ? { position: 'absolute', zIndex: 10, top: 0, left: 0, height: '100%' } : {}),
        }}>
          {/* Header */}
          <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid rgba(120,108,92,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono"' }}>
              Missions
            </Typography>
            <Tooltip title="New mission">
              <IconButton size="small" onClick={handleCreate} sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.5 }}>
                <AddIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* List */}
          <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
            {missions.length === 0 && (
              <Typography sx={{ color: '#786c5c', fontSize: '0.78rem', textAlign: 'center', pt: 3, px: 2 }}>
                No missions yet.
              </Typography>
            )}
            {groupedMissions.map((group) => (
              <Box key={group.label}>
                <Typography sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono"', borderBottom: '1px solid rgba(120,108,92,0.08)' }}>
                  {group.label}
                </Typography>
                {group.missions.map((m) => {
                  const isSelected = m.id === selectedId
                  return (
                    <Box key={m.id}
                      onClick={() => handleSelect(m.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, mx: 0.5,
                        borderRadius: 1, cursor: 'pointer', mb: 0.25, mt: 0.25,
                        bgcolor: isSelected ? 'rgba(200,164,74,0.1)' : 'transparent',
                        borderLeft: isSelected ? '3px solid #c8a44a' : '3px solid transparent',
                        '&:hover': { bgcolor: isSelected ? 'rgba(200,164,74,0.12)' : 'rgba(120,108,92,0.08)' },
                        '&:hover .mission-delete': { opacity: 1 },
                      }}>
                      <Typography sx={{ fontSize: '0.9rem', lineHeight: 1, flexShrink: 0 }}>{TYPE_ICONS[m.type] ?? '🎯'}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.82rem', color: isSelected ? '#c8a44a' : '#b4a48a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.2 }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: STATUS_COLORS[m.status] ?? '#786c5c', flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>{m.status}</Typography>
                          {m.maps.length > 0 && <Typography sx={{ fontSize: '0.6rem', color: '#786c5c' }}>· {m.maps.length} map{m.maps.length > 1 ? 's' : ''}</Typography>}
                          {m.decisions.length > 0 && <Typography sx={{ fontSize: '0.6rem', color: '#786c5c' }}>· {m.decisions.length}d</Typography>}
                        </Box>
                      </Box>
                      <IconButton className="mission-delete" size="small"
                        onClick={(e) => { e.stopPropagation(); setPendingDeleteId(m.id) }}
                        sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, color: '#786c5c', '&:hover': { color: '#b84848' } }}>
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Resize divider */}
      {!isMobile && (
        <Box onMouseDown={(e) => { isResizingRef.current = true; resizeStartXRef.current = e.clientX; resizeStartWidthRef.current = sidebarWidth; e.preventDefault() }}
          sx={{ width: 4, flexShrink: 0, cursor: 'col-resize', bgcolor: 'rgba(120,108,92,0.15)', transition: 'background-color 0.15s', '&:hover': { bgcolor: 'rgba(200,164,74,0.4)' }, userSelect: 'none' }} />
      )}

      {/* Editor */}
      {(!isMobile || !showSidebar) && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#0f0d0a' }}>
          {isMobile && (
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
              <IconButton size="small" onClick={() => setShowSidebar(true)} sx={{ color: '#786c5c' }}>
                <ArrowBackIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}
          {selectedMission ? (
            <MissionEditor
              key={selectedMission.id}
              mission={selectedMission}
              allDecisions={allDecisions}
              allItems={allItems}
              chapters={chapters}
              onSave={handleSave}
              onAddMap={handleAddMap}
              onDeleteMap={handleDeleteMap}
              onLinkDecision={handleLinkDecision}
              onUnlinkDecision={handleUnlinkDecision}
              onLinkItem={handleLinkItem}
              onUnlinkItem={handleUnlinkItem}
              uploadUrl={uploadUrl}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
              <Typography sx={{ fontSize: '2rem' }}>🗺️</Typography>
              <Typography sx={{ color: '#786c5c', fontFamily: '"Cinzel", serif', fontSize: '0.9rem' }}>
                Select a mission or create a new one
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!pendingDeleteId} onClose={() => setPendingDeleteId(null)}
        PaperProps={{ sx: { bgcolor: '#1a1612', border: '1px solid rgba(120,108,92,0.3)', minWidth: 300 } }}>
        <Box sx={{ p: 3 }}>
          <Typography sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem', mb: 1 }}>Delete mission?</Typography>
          <Typography sx={{ color: '#786c5c', fontSize: '0.85rem', mb: 2.5 }}>This will permanently delete the mission and all its maps.</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Box component="button" onClick={() => setPendingDeleteId(null)} sx={{ px: 2, py: 0.75, bgcolor: 'transparent', border: '1px solid rgba(120,108,92,0.3)', borderRadius: 1, color: '#786c5c', cursor: 'pointer', fontSize: '0.8rem', '&:hover': { borderColor: '#786c5c' } }}>Cancel</Box>
            <Box component="button" onClick={() => pendingDeleteId && handleDelete(pendingDeleteId)} sx={{ px: 2, py: 0.75, bgcolor: '#b84848', border: 'none', borderRadius: 1, color: '#fff', cursor: 'pointer', fontSize: '0.8rem', '&:hover': { bgcolor: '#a03838' } }}>Delete</Box>
          </Box>
        </Box>
      </Dialog>
    </Box>
  )
}
