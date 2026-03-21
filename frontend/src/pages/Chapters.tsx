import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Box, Typography, IconButton, Tooltip, TextField, CircularProgress,
  Select, MenuItem, Dialog, useTheme, useMediaQuery, Chip,
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
import MapIcon from '@mui/icons-material/Map'
import { useCampaign } from '../context/campaign'

// ── GraphQL ────────────────────────────────────────────────────────────────────

const CHAPTERS = gql`
  query ChaptersPage($campaignId: ID!) {
    campaign(id: $campaignId) {
      id
      chapters {
        id name orderIndex status summary content playerVisible
        missions { id name type status }
      }
    }
  }
`

const CREATE_CHAPTER = gql`
  mutation CreateChapter($input: CreateChapterInput!) {
    createChapter(input: $input) { id name orderIndex status summary content }
  }
`

const UPDATE_CHAPTER = gql`
  mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!) {
    updateChapter(id: $id, input: $input) { id name status summary content updatedAt }
  }
`

const DELETE_CHAPTER = gql`
  mutation DeleteChapter($id: ID!) { deleteChapter(id: $id) }
`

// ── Types ──────────────────────────────────────────────────────────────────────

type ChapterMission = { id: string; name: string; type: string; status: string }
type Chapter = {
  id: string; name: string; orderIndex: number; status: string
  summary: string | null; content: string | null; playerVisible: boolean
  missions: ChapterMission[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#786c5c', ACTIVE: '#4a90d9', COMPLETED: '#62a870',
}
const MISSION_TYPE_ICONS: Record<string, string> = { MAIN: '🎯', SECONDARY: '⚔️', OPTIONAL: '🌿', HIDDEN: '👁️' }

const TBTN = (active: boolean) => ({
  color: active ? '#c8a44a' : '#786c5c',
  '&:hover': { color: '#c8a44a', bgcolor: 'transparent' },
  p: 0.4, borderRadius: 0.5,
})

// ── Chapter Editor ─────────────────────────────────────────────────────────────

function ChapterEditor({ chapter, onSave }: {
  chapter: Chapter
  onSave: (id: string, data: Partial<Pick<Chapter, 'name' | 'content' | 'status' | 'summary'>>) => void
}) {
  const editorTheme = useTheme()
  const isMobileEditor = useMediaQuery(editorTheme.breakpoints.down('md'))

  const [name, setName] = useState(chapter.name)
  const [status, setStatus] = useState(chapter.status)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [sheetOpen, setSheetOpen] = useState(false)
  const PEEK_HEIGHT = 48

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rightResizingRef = useRef(false)
  const rightResizeStartXRef = useRef(0)
  const rightResizeStartWidthRef = useRef(0)
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    parseInt(localStorage.getItem('chapters-right-panel-width') ?? '260')
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!rightResizingRef.current) return
      const w = Math.max(200, Math.min(520, rightResizeStartWidthRef.current - (e.clientX - rightResizeStartXRef.current)))
      setRightPanelWidth(w); localStorage.setItem('chapters-right-panel-width', String(w))
    }
    const onUp = () => { rightResizingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    setName(chapter.name); setStatus(chapter.status)
  }, [chapter.id])

  const triggerSave = useCallback((data: Parameters<typeof onSave>[1]) => {
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onSave(chapter.id, data)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 700)
  }, [chapter.id, onSave])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Write chapter notes…' }),
      Underline, TaskList, TaskItem.configure({ nested: true }),
    ],
    content: chapter.content || '',
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
    const incoming = chapter.content || ''
    const current = editor.getHTML()
    if (current !== incoming) editor.commands.setContent(incoming, { emitUpdate: false })
  }, [chapter.id, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  const btn = TBTN

  const rightPanel = (
    <>
      {/* Missions in this chapter */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <MapIcon sx={{ fontSize: 13, color: '#786c5c' }} />
          <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: '"JetBrains Mono"' }}>
            Missions
          </Typography>
          {chapter.missions.length > 0 && (
            <Typography sx={{ fontSize: '0.65rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>
              {chapter.missions.length}
            </Typography>
          )}
        </Box>
        {chapter.missions.length === 0 ? (
          <Typography sx={{ fontSize: '0.72rem', color: '#786c5c' }}>No missions in this chapter.</Typography>
        ) : (
          chapter.missions.map((m) => (
            <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.6, borderBottom: '1px solid rgba(120,108,92,0.08)' }}>
              <Typography sx={{ fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 }}>{MISSION_TYPE_ICONS[m.type] ?? '🎯'}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.1 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: STATUS_COLORS[m.status] ?? '#786c5c', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.62rem', color: '#786c5c' }}>{m.status}</Typography>
                </Box>
              </Box>
            </Box>
          ))
        )}
      </Box>
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

      {/* Body */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Left: rich text */}
        <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 2, md: 5 }, py: 4, minWidth: 0, pb: isMobileEditor ? `${PEEK_HEIGHT + 16}px` : 4 }}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, lineHeight: 1 }}>📖</Typography>
              <TextField
                value={name} variant="standard" fullWidth placeholder="Chapter name"
                onChange={(e) => { setName(e.target.value); triggerSave({ name: e.target.value }) }}
                inputProps={{ style: { fontSize: isMobileEditor ? '1.3rem' : '1.8rem', fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontWeight: 700, padding: 0 } }}
                sx={{ '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' } }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Select size="small" value={status} onChange={(e) => { setStatus(e.target.value); onSave(chapter.id, { status: e.target.value }) }}
                sx={{ fontSize: '0.78rem', color: STATUS_COLORS[status] ?? '#786c5c', '& .MuiOutlinedInput-notchedOutline': { borderColor: STATUS_COLORS[status] ?? 'rgba(120,108,92,0.3)' }, '& .MuiSvgIcon-root': { color: '#786c5c' }, minWidth: 120 }}>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
              </Select>
              <Chip
                label={`${chapter.missions.length} mission${chapter.missions.length !== 1 ? 's' : ''}`}
                size="small"
                sx={{ bgcolor: 'rgba(120,108,92,0.12)', color: '#786c5c', fontFamily: '"JetBrains Mono"', fontSize: '0.68rem', height: 24 }}
              />
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

        {/* Desktop: right panel */}
        {!isMobileEditor && (
          <>
            <Box
              onMouseDown={(e) => { rightResizingRef.current = true; rightResizeStartXRef.current = e.clientX; rightResizeStartWidthRef.current = rightPanelWidth; e.preventDefault() }}
              sx={{ width: 4, flexShrink: 0, cursor: 'col-resize', bgcolor: 'rgba(120,108,92,0.15)', transition: 'background-color 0.15s', '&:hover': { bgcolor: 'rgba(200,164,74,0.4)' }, userSelect: 'none' }}
            />
            <Box sx={{ width: rightPanelWidth, flexShrink: 0, borderLeft: '1px solid rgba(120,108,92,0.12)', overflow: 'auto', bgcolor: '#0d0b08' }}>
              {rightPanel}
            </Box>
          </>
        )}

        {/* Mobile: bottom sheet */}
        {isMobileEditor && (
          <Box sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            height: sheetOpen ? '60vh' : PEEK_HEIGHT,
            transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
            bgcolor: '#0d0b08', borderTop: '1px solid rgba(120,108,92,0.25)',
            borderRadius: sheetOpen ? '12px 12px 0 0' : 0,
            display: 'flex', flexDirection: 'column', zIndex: 1200,
            boxShadow: sheetOpen ? '0 -4px 24px rgba(0,0,0,0.5)' : 'none',
          }}>
            <Box onClick={() => setSheetOpen((v) => !v)} sx={{ flexShrink: 0, height: PEEK_HEIGHT, display: 'flex', alignItems: 'center', px: 2, cursor: 'pointer', userSelect: 'none' }}>
              <Box sx={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 32, height: 3, borderRadius: 2, bgcolor: 'rgba(120,108,92,0.4)' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem' }}>🗺️</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', textTransform: 'uppercase', letterSpacing: 0.5 }}>Missions</Typography>
                {chapter.missions.length > 0 && (
                  <Box sx={{ bgcolor: 'rgba(200,164,74,0.15)', borderRadius: 0.75, px: 0.6 }}>
                    <Typography sx={{ fontSize: '0.6rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"' }}>{chapter.missions.length}</Typography>
                  </Box>
                )}
              </Box>
              <Box sx={{ ml: 'auto', color: '#786c5c', fontSize: '0.6rem' }}>{sheetOpen ? '▼' : '▲'}</Box>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>{rightPanel}</Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ── Main Chapters page ─────────────────────────────────────────────────────────

export default function Chapters() {
  const { campaignId } = useCampaign()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(`chapters-last-${campaignId}`) ?? null)
  const [showSidebar, setShowSidebar] = useState(!isMobile || !selectedId)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('chapters-sidebar-width') ?? '240'))
  const isResizingRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const w = Math.max(180, Math.min(400, resizeStartWidthRef.current + e.clientX - resizeStartXRef.current))
      setSidebarWidth(w); localStorage.setItem('chapters-sidebar-width', String(w))
    }
    const onUp = () => { isResizingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const { data, refetch } = useQuery(CHAPTERS, { variables: { campaignId }, skip: !campaignId, fetchPolicy: 'cache-and-network' })
  const [createChapter] = useMutation(CREATE_CHAPTER)
  const [updateChapter] = useMutation(UPDATE_CHAPTER)
  const [deleteChapter] = useMutation(DELETE_CHAPTER, { refetchQueries: ['ChaptersPage'] })

  const chapters: Chapter[] = (data?.campaign?.chapters ?? []).slice().sort((a: Chapter, b: Chapter) => a.orderIndex - b.orderIndex)
  const selectedChapter = chapters.find((c) => c.id === selectedId) ?? null

  const handleSelect = (id: string) => {
    setSelectedId(id)
    localStorage.setItem(`chapters-last-${campaignId}`, id)
    if (isMobile) setShowSidebar(false)
  }

  const handleCreate = async () => {
    const res = await createChapter({ variables: { input: { campaignId, name: 'New Chapter', orderIndex: chapters.length } } })
    const id = res.data?.createChapter?.id
    await refetch()
    if (id) { setSelectedId(id); localStorage.setItem(`chapters-last-${campaignId}`, id); if (isMobile) setShowSidebar(false) }
  }

  const handleSave = useCallback(async (id: string, data: Partial<Pick<Chapter, 'name' | 'content' | 'status' | 'summary'>>) => {
    await updateChapter({ variables: { id, input: data } })
  }, [updateChapter])

  const handleDelete = async (id: string) => {
    if (selectedId === id) { setSelectedId(null); localStorage.removeItem(`chapters-last-${campaignId}`) }
    await deleteChapter({ variables: { id } })
    setPendingDeleteId(null)
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
          <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid rgba(120,108,92,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono"' }}>
              Chapters
            </Typography>
            <Tooltip title="New chapter">
              <IconButton size="small" onClick={handleCreate} sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.5 }}>
                <AddIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
            {chapters.length === 0 && (
              <Typography sx={{ color: '#786c5c', fontSize: '0.78rem', textAlign: 'center', pt: 3, px: 2 }}>
                No chapters yet.
              </Typography>
            )}
            {chapters.map((ch, idx) => {
              const isSelected = ch.id === selectedId
              return (
                <Box key={ch.id}
                  onClick={() => handleSelect(ch.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, mx: 0.5,
                    borderRadius: 1, cursor: 'pointer', mb: 0.25,
                    bgcolor: isSelected ? 'rgba(200,164,74,0.1)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #c8a44a' : '3px solid transparent',
                    '&:hover': { bgcolor: isSelected ? 'rgba(200,164,74,0.12)' : 'rgba(120,108,92,0.08)' },
                    '&:hover .ch-delete': { opacity: 1 },
                  }}>
                  <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', fontFamily: '"JetBrains Mono"', flexShrink: 0, minWidth: 18 }}>
                    {idx + 1}.
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.82rem', color: isSelected ? '#c8a44a' : '#b4a48a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.2 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: STATUS_COLORS[ch.status] ?? '#786c5c', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.65rem', color: '#786c5c' }}>{ch.status}</Typography>
                      {ch.missions.length > 0 && (
                        <Typography sx={{ fontSize: '0.6rem', color: '#786c5c' }}>· {ch.missions.length}m</Typography>
                      )}
                    </Box>
                  </Box>
                  <IconButton className="ch-delete" size="small"
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteId(ch.id) }}
                    sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, color: '#786c5c', '&:hover': { color: '#b84848' } }}>
                    <DeleteIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Box>
              )
            })}
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
          {selectedChapter ? (
            <ChapterEditor key={selectedChapter.id} chapter={selectedChapter} onSave={handleSave} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
              <Typography sx={{ fontSize: '2rem' }}>📖</Typography>
              <Typography sx={{ color: '#786c5c', fontFamily: '"Cinzel", serif', fontSize: '0.9rem' }}>
                Select a chapter or create a new one
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!pendingDeleteId} onClose={() => setPendingDeleteId(null)}
        PaperProps={{ sx: { bgcolor: '#1a1612', border: '1px solid rgba(120,108,92,0.3)', minWidth: 300 } }}>
        <Box sx={{ p: 3 }}>
          <Typography sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem', mb: 1 }}>Delete chapter?</Typography>
          <Typography sx={{ color: '#786c5c', fontSize: '0.85rem', mb: 2.5 }}>This will permanently delete the chapter. Missions in this chapter will be unlinked.</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Box component="button" onClick={() => setPendingDeleteId(null)} sx={{ px: 2, py: 0.75, bgcolor: 'transparent', border: '1px solid rgba(120,108,92,0.3)', borderRadius: 1, color: '#786c5c', cursor: 'pointer', fontSize: '0.8rem', '&:hover': { borderColor: '#786c5c' } }}>Cancel</Box>
            <Box component="button" onClick={() => pendingDeleteId && handleDelete(pendingDeleteId)} sx={{ px: 2, py: 0.75, bgcolor: '#b84848', border: 'none', borderRadius: 1, color: '#fff', cursor: 'pointer', fontSize: '0.8rem', '&:hover': { bgcolor: '#a03838' } }}>Delete</Box>
          </Box>
        </Box>
      </Dialog>
    </Box>
  )
}
