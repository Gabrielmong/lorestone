import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useApolloClient, gql } from '@apollo/client'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor,
  useSensor, useSensors, useDroppable,
  type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import { inputRules, InputRule } from '@tiptap/pm/inputrules'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { marked } from 'marked'
import JSZip from 'jszip'
import {
  Box, Typography, IconButton, Tooltip, TextField, CircularProgress,
  useTheme, useMediaQuery, LinearProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, Menu, MenuItem, Divider,
  Popover,
} from '@mui/material'
import EmojiPicker from '@emoji-mart/react'
import emojiData from '@emoji-mart/data'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CodeIcon from '@mui/icons-material/Code'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import TableChartIcon from '@mui/icons-material/TableChart'
import InsertLinkIcon from '@mui/icons-material/InsertLink'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import { useCampaign } from '../context/campaign'

// ── Notion export parser ──────────────────────────────────────────────────────

// Notion filenames: "Title [32hexUUID].md" or "Title [32hexUUID]" (dirs)
const NOTION_ID_RE = /\s+[0-9a-f]{32}(\.md)?$/i

function stripNotionId(name: string): string {
  return name.replace(NOTION_ID_RE, '').trim()
}

// Extract leading emoji if present (handles multi-codepoint emoji)
const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u

function extractIcon(title: string): { icon: string | null; cleanTitle: string } {
  const m = title.match(EMOJI_RE)
  if (m) return { icon: m[1], cleanTitle: title.slice(m[0].length).trim() }
  return { icon: null, cleanTitle: title }
}

interface ParsedPage {
  // Path segments (without the root folder), used to determine hierarchy
  pathSegments: string[]  // e.g. ['Facciones y NPCs', 'Enanos del Norte', 'Gorthak']
  title: string
  icon: string
  content: string         // HTML from markdown
  orderIndex: number
}

interface ParseEntry {
  relativePath: string
  getText: () => Promise<string>
}

async function parseEntries(entries: ParseEntry[]): Promise<ParsedPage[]> {
  const mdEntries = entries.filter((e) => e.relativePath.endsWith('.md'))
  mdEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const orderCounters: Record<string, number> = {}
  const results: ParsedPage[] = []

  for (const entry of mdEntries) {
    const parts = entry.relativePath.split('/')
    // parts[0] is the root folder (campaign name), skip it
    const pathSegments = parts.slice(1).map((p) => stripNotionId(p.replace(/\.md$/, '')))
    const rawFilename = parts[parts.length - 1].replace(/\.md$/, '')
    const cleanName = stripNotionId(rawFilename)
    const { icon, cleanTitle } = extractIcon(cleanName)

    const dirKey = parts.slice(0, parts.length - 1).join('/')
    orderCounters[dirKey] = (orderCounters[dirKey] ?? 0)
    const order = orderCounters[dirKey]++

    const text = await entry.getText()
    const withoutTitle = text.replace(/^#[^\n]+\n/, '').trim()
    // Convert Notion internal .md links → wiki:// placeholders (resolved to page IDs after import)
    // Resolve hrefs relative to the current file's directory so both sibling links
    // ("Page.md"), child links ("Sub/Page.md") and cousin links ("../Other/Page.md") all
    // produce a full root-relative path that matches the keys we store in idMap.
    const currentDir = parts.slice(0, parts.length - 1) // e.g. ['RootFolder', 'Acto 1']
    const cleanMd = withoutTitle.replace(/\[([^\]]+)\]\(([^)]*\.md[^)]*)\)/g, (_, label, href) => {
      const decoded = decodeURIComponent(href.split('#')[0])
      const hrefParts = decoded.split('/')
      // Walk the href relative to the current directory
      const resolved = [...currentDir]
      for (const part of hrefParts) {
        if (part === '..') { if (resolved.length > 0) resolved.pop() }
        else if (part && part !== '.') resolved.push(part)
      }
      // Strip root folder (index 0), Notion IDs, and .md extension
      const pathSegments = resolved
        .slice(1)
        .map((s) => stripNotionId(s.replace(/\.md$/, '')))
        .filter(Boolean)
      const cleanPath = pathSegments.join('/')
      return cleanPath ? `[${label}](wiki://${cleanPath})` : label
    })
    results.push({
      pathSegments,
      title: cleanTitle || 'Untitled',
      icon: icon ?? '📄',
      content: cleanMd,
      orderIndex: order,
    })
  }

  return results
}

async function parseNotionExport(files: FileList): Promise<ParsedPage[]> {
  return parseEntries(
    Array.from(files).map((f) => ({ relativePath: f.webkitRelativePath, getText: () => f.text() }))
  )
}

// Recursively collect .md entries from a zip, handling Notion's outer→Part-N.zip nesting
async function extractZipEntries(zip: JSZip): Promise<ParseEntry[]> {
  const entries: ParseEntry[] = []
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    if (name.endsWith('.zip')) {
      const inner = await JSZip.loadAsync(await file.async('arraybuffer'))
      entries.push(...await extractZipEntries(inner))
    } else if (name.endsWith('.md')) {
      entries.push({ relativePath: name, getText: () => file.async('text') })
    }
  }
  return entries
}

async function parseNotionZip(file: File): Promise<ParsedPage[]> {
  const zip = await JSZip.loadAsync(file)
  return parseEntries(await extractZipEntries(zip))
}

// Plain .md files — flat, all imported as root-level pages
async function parsePlainMdFiles(files: FileList): Promise<ParsedPage[]> {
  return parseEntries(
    Array.from(files)
      .filter((f) => f.name.endsWith('.md'))
      .map((f) => ({ relativePath: `__root__/${f.name}`, getText: () => f.text() }))
  )
}

// ── GraphQL ──────────────────────────────────────────────────────────────────

const WIKI_PAGES = gql`
  query WikiPages($campaignId: ID!) {
    wikiPages(campaignId: $campaignId) {
      id title content icon parentId orderIndex updatedAt
    }
  }
`

const CREATE_WIKI_PAGE = gql`
  mutation CreateWikiPage($input: CreateWikiPageInput!) {
    createWikiPage(input: $input) { id title icon parentId orderIndex }
  }
`

const UPDATE_WIKI_PAGE = gql`
  mutation UpdateWikiPage($id: ID!, $input: UpdateWikiPageInput!) {
    updateWikiPage(id: $id, input: $input) { id title content icon updatedAt }
  }
`

const DELETE_WIKI_PAGE = gql`
  mutation DeleteWikiPage($id: ID!) { deleteWikiPage(id: $id) }
`

// ── Types ─────────────────────────────────────────────────────────────────────

type WikiPageFlat = {
  id: string; title: string; content: string | null; icon: string | null
  parentId: string | null; orderIndex: number; updatedAt: string
}

type WikiPageNode = WikiPageFlat & { children: WikiPageNode[] }

// ── Tree builder ──────────────────────────────────────────────────────────────

function buildTree(pages: WikiPageFlat[]): WikiPageNode[] {
  const map = new Map<string, WikiPageNode>()
  for (const p of pages) map.set(p.id, { ...p, children: [] })
  const roots: WikiPageNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sort = (nodes: WikiPageNode[]) => {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex)
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: '#c8a44a', fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

function isDescendant(pages: WikiPageFlat[], ancestorId: string, checkId: string): boolean {
  const children = pages.filter((p) => p.parentId === ancestorId)
  return children.some((c) => c.id === checkId || isDescendant(pages, c.id, checkId))
}

function RootDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: 'root-zone' })
  return (
    <Box ref={setNodeRef} sx={{
      mx: 1, mb: 0.5, px: 1.5, py: 0.6,
      border: `1px dashed ${isOver ? '#c8a44a' : 'rgba(120,108,92,0.25)'}`,
      borderRadius: 1,
      bgcolor: isOver ? 'rgba(200,164,74,0.08)' : 'transparent',
      transition: 'all 0.15s',
    }}>
      <Typography sx={{ fontSize: '0.68rem', color: isOver ? '#c8a44a' : '#786c5c', textAlign: 'center', fontFamily: '"JetBrains Mono"' }}>
        ↑ drop here → top level
      </Typography>
    </Box>
  )
}

// ── PageTreeRow ───────────────────────────────────────────────────────────────

function PageTreeRow({
  node, depth, selectedId, onSelect, onAdd, onDelete, renamingId, onStartRename, onFinishRename,
  collapsedIds, onToggleCollapse, nestTargetId, nestActive,
}: {
  node: WikiPageNode; depth: number; selectedId: string | null
  onSelect: (id: string) => void
  onAdd: (parentId: string) => void
  onDelete: (id: string) => void
  renamingId: string | null
  onStartRename: (id: string) => void
  onFinishRename: (id: string, title: string) => void
  collapsedIds: Set<string>
  onToggleCollapse: (id: string) => void
  nestTargetId: string | null
  nestActive: boolean
}) {
  const [renameValue, setRenameValue] = useState(node.title)
  const isSelected = selectedId === node.id
  const isRenaming = renamingId === node.id
  const hasChildren = node.children.length > 0
  const open = !collapsedIds.has(node.id)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })
  const dragStyle = {
    // Freeze sortable transforms while in nest mode so items don't shift away from the pointer
    transform: nestActive && !isDragging ? undefined : CSS.Transform.toString(transform),
    transition: nestActive && !isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 999 : undefined,
  }

  useEffect(() => { setRenameValue(node.title) }, [node.title])

  const isNestTarget = nestTargetId === node.id

  return (
    <Box ref={setNodeRef} style={dragStyle}>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          pl: `${8 + depth * 16}px`, pr: 0.5, py: 0.6,
          borderRadius: 1, cursor: 'pointer',
          bgcolor: isNestTarget
            ? 'rgba(200,164,74,0.12)'
            : isSelected ? 'rgba(200,164,74,0.1)' : 'transparent',
          outline: isNestTarget ? '1px solid rgba(200,164,74,0.5)' : 'none',
          '&:hover': { bgcolor: isNestTarget ? 'rgba(200,164,74,0.15)' : isSelected ? 'rgba(200,164,74,0.12)' : 'rgba(120,108,92,0.1)' },
          '&:hover .wiki-row-actions': { opacity: 1 },
          '&:hover .wiki-drag-handle': { opacity: 1 },
          transition: 'outline 0.1s, bgcolor 0.1s',
        }}
        onClick={() => !isRenaming && onSelect(node.id)}
      >
        {/* Drag handle */}
        <Box
          className="wiki-drag-handle"
          sx={{ width: 14, flexShrink: 0, opacity: 0, transition: 'opacity 0.15s', cursor: 'grab', display: 'flex', alignItems: 'center', touchAction: 'none' }}
          {...attributes} {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <DragIndicatorIcon sx={{ fontSize: 12, color: '#786c5c' }} />
        </Box>

        {/* Collapse toggle */}
        <Box sx={{ width: 16, flexShrink: 0 }}>
          {hasChildren && (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id) }}
              sx={{ p: 0, color: '#786c5c', '&:hover': { color: '#c8a44a' } }}>
              {open
                ? <ExpandMoreIcon sx={{ fontSize: 14 }} />
                : <ChevronRightIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          )}
        </Box>

        {/* Icon */}
        <Typography sx={{ fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 }}>
          {node.icon ?? '📄'}
        </Typography>

        {/* Title / rename */}
        {isRenaming ? (
          <TextField
            value={renameValue}
            size="small"
            autoFocus
            variant="standard"
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => onFinishRename(node.id, renameValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onFinishRename(node.id, renameValue)
              if (e.key === 'Escape') { setRenameValue(node.title); onFinishRename(node.id, node.title) }
              e.stopPropagation()
            }}
            onClick={(e) => e.stopPropagation()}
            inputProps={{ style: { fontSize: '0.82rem', color: '#e6d8c0', padding: '1px 0' } }}
            sx={{ flex: 1, '& .MuiInput-underline:before': { borderColor: 'rgba(200,164,74,0.4)' } }}
          />
        ) : (
          <Typography
            onDoubleClick={(e) => { e.stopPropagation(); onStartRename(node.id) }}
            sx={{
              flex: 1, fontSize: '0.82rem', color: isSelected ? '#c8a44a' : '#b4a48a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {node.title}
          </Typography>
        )}

        {/* Hover actions */}
        <Box className="wiki-row-actions" sx={{ display: 'flex', gap: 0, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(node.id) }}
            sx={{ p: 0.25, color: '#786c5c', '&:hover': { color: '#c8a44a' } }}>
            <AddIcon sx={{ fontSize: 13 }} />
          </IconButton>
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(node.id) }}
            sx={{ p: 0.25, color: '#786c5c', '&:hover': { color: '#b84848' } }}>
            <DeleteIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>
      </Box>

      {open && node.children.length > 0 && (
        <SortableContext items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {node.children.map((child) => (
            <PageTreeRow
              key={child.id} node={child} depth={depth + 1}
              selectedId={selectedId} onSelect={onSelect}
              onAdd={onAdd} onDelete={onDelete}
              renamingId={renamingId} onStartRename={onStartRename} onFinishRename={onFinishRename}
              collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse}
              nestTargetId={nestTargetId} nestActive={nestActive}
            />
          ))}
        </SortableContext>
      )}
    </Box>
  )
}

// ── WikiEditor ────────────────────────────────────────────────────────────────

// Converts [display text](url) markdown syntax to a real link as you type
const MarkdownLinkInput = Extension.create({
  name: 'markdownLinkInput',
  addProseMirrorPlugins() {
    const { schema } = this.editor
    return [
      inputRules({
        rules: [
          new InputRule(
            /\[([^\]]+)\]\(([^)]+)\)$/,
            (state, match, start, end) => {
              const [, text, href] = match
              const linkMark = schema.marks.link?.create({ href })
              if (!linkMark) return null
              return state.tr.replaceWith(start, end, schema.text(text, [linkMark]))
            }
          ),
        ],
      }),
    ]
  },
})

const TOOLBAR_BTN = (active: boolean) => ({
  color: active ? '#c8a44a' : '#786c5c',
  '&:hover': { color: '#c8a44a', bgcolor: 'transparent' },
  p: 0.4, borderRadius: 0.5,
})

function WikiEditor({
  page,
  onSave,
  onPageNavigate,
  pages = [],
}: {
  page: WikiPageFlat
  onSave: (id: string, data: { title?: string; content?: string; icon?: string }) => void
  onPageNavigate?: (id: string) => void
  pages?: WikiPageFlat[]
}) {
  const [title, setTitle] = useState(page.title)
  const [icon, setIcon] = useState(page.icon ?? '📄')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Context menu + link state ─────────────────────────────────────────────
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [extLinkOpen, setExtLinkOpen] = useState(false)
  const [extLinkUrl, setExtLinkUrl] = useState('')
  const [pagePickerOpen, setPagePickerOpen] = useState(false)
  const [pageSearch, setPageSearch] = useState('')
  // Saved selection so dialogs can restore it after stealing focus
  const savedSel = useRef<{ from: number; to: number } | null>(null)
  // Stable ref so editorProps.handleClick can call the latest onPageNavigate
  const onPageNavigateRef = useRef(onPageNavigate)
  useEffect(() => { onPageNavigateRef.current = onPageNavigate }, [onPageNavigate])

  const closeCtx = () => setCtxMenu(null)

  const openExtLink = () => {
    // For toolbar: save selection while editor still has focus (onMouseDown + preventDefault keeps it)
    if (!editor.state.selection.empty) {
      savedSel.current = { from: editor.state.selection.from, to: editor.state.selection.to }
    }
    const existing = editor?.getAttributes('link').href ?? ''
    setExtLinkUrl(existing.startsWith('wiki://') ? '' : existing)
    setExtLinkOpen(true)
  }

  const restoreAndRun = (href: string) => {
    editor.view.focus()
    // Single chain without .focus() — fully synchronous, no requestAnimationFrame
    const chain = editor.chain()
    if (savedSel.current) chain.setTextSelection(savedSel.current)
    chain.setLink({ href }).run()
    savedSel.current = null
  }

  const applyExtLink = () => {
    if (!editor || !extLinkUrl.trim()) return
    const href = /^https?:\/\//.test(extLinkUrl) ? extLinkUrl : `https://${extLinkUrl}`
    restoreAndRun(href)
    setExtLinkOpen(false)
    setExtLinkUrl('')
  }

  const applyPageLink = (pageId: string) => {
    if (!editor) return
    restoreAndRun(`wiki://${pageId}`)
    setPagePickerOpen(false)
    setPageSearch('')
  }

  const filteredPages = pages.filter(
    (p) => p.id !== page.id && (p.title.toLowerCase().includes(pageSearch.toLowerCase()) || (p.icon ?? '').includes(pageSearch))
  )

  // Sync when page changes
  useEffect(() => {
    setTitle(page.title)
    setIcon(page.icon ?? '📄')
  }, [page.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerSave = useCallback((data: { title?: string; content?: string; icon?: string }) => {
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onSave(page.id, data)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 800)
  }, [page.id, onSave])

  // Flush any pending debounced content save immediately
  const saveNowRef = useRef<(() => void) | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: null }, isAllowedUri: () => true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      MarkdownLinkInput,
    ],
    content: page.content || '',
    onUpdate({ editor }) {
      const html = editor.getHTML()
      const content = html === '<p></p>' ? '' : html
      if (contentTimer.current) clearTimeout(contentTimer.current)
      saveNowRef.current = () => { saveNowRef.current = null; triggerSave({ content }) }
      contentTimer.current = setTimeout(() => { saveNowRef.current?.(); saveNowRef.current = null }, 800)
    },
    editorProps: {
      attributes: { style: 'outline:none; min-height:60vh; padding:0; font-size:1rem; color:#c8b89a; line-height:1.75; font-family:"Crimson Pro", Georgia, serif' },
      handleClick(_view, _pos, event) {
        const anchor = (event.target as HTMLElement).closest('a')
        if (anchor) {
          const href = anchor.getAttribute('href')
          if (href?.startsWith('wiki://')) {
            event.preventDefault()
            event.stopPropagation()
            onPageNavigateRef.current?.(href.slice(7))
            return true
          }
        }
        return false
      },
      handleKeyDown(_view, event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault()
          if (saveNowRef.current) {
            if (contentTimer.current) clearTimeout(contentTimer.current)
            saveNowRef.current()
          }
          return true
        }
        return false
      },
    },
  })

  // Sync editor content when page changes
  useEffect(() => {
    if (!editor) return
    const incoming = page.content || ''
    const current = editor.getHTML()
    if (current !== incoming && current !== '<p></p>') {
      editor.commands.setContent(incoming, { emitUpdate: false })
    } else if (!current || current === '<p></p>') {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [page.id, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  const btn = TOOLBAR_BTN
  const hasLink = editor.isActive('link')
  const hasSelection = !editor.state.selection.empty

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const inTable = editor.isActive('table')
    if (!editor.state.selection.empty || inTable) {
      if (!editor.state.selection.empty)
        savedSel.current = { from: editor.state.selection.from, to: editor.state.selection.to }
      setCtxMenu({ x: e.clientX, y: e.clientY })
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', gap: 0.25, px: 2, py: 0.75, flexWrap: 'wrap', alignItems: 'center',
        borderBottom: '1px solid rgba(120,108,92,0.15)',
        position: 'sticky', top: 0, bgcolor: '#0f0d0a', zIndex: 1,
      }}>
        {/* Headings */}
        {([1, 2, 3] as const).map((level) => (
          <Tooltip key={level} title={`Heading ${level}`}>
            <IconButton size="small"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level }).run() }}
              sx={btn(editor.isActive('heading', { level }))}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: '"JetBrains Mono"', lineHeight: 1 }}>H{level}</Typography>
            </IconButton>
          </Tooltip>
        ))}
        <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16 }} />
        <Tooltip title="Bold">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }} sx={btn(editor.isActive('bold'))}>
            <FormatBoldIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }} sx={btn(editor.isActive('italic'))}>
            <FormatItalicIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Underline">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }} sx={btn(editor.isActive('underline'))}>
            <FormatUnderlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16 }} />
        <Tooltip title="Bullet list">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }} sx={btn(editor.isActive('bulletList'))}>
            <FormatListBulletedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Numbered list">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }} sx={btn(editor.isActive('orderedList'))}>
            <FormatListNumberedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Task list">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleTaskList().run() }} sx={btn(editor.isActive('taskList'))}>
            <CheckBoxOutlineBlankIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16 }} />
        <Tooltip title="Code block">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run() }} sx={btn(editor.isActive('codeBlock'))}>
            <CodeIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Blockquote">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run() }} sx={btn(editor.isActive('blockquote'))}>
            <FormatQuoteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Divider">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run() }} sx={btn(false)}>
            <HorizontalRuleIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert table">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }} sx={btn(editor.isActive('table'))}>
            <TableChartIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Box sx={{ width: '1px', bgcolor: 'rgba(120,108,92,0.25)', mx: 0.25, height: 16 }} />
        <Tooltip title={hasLink ? 'Edit link' : 'Add link'}>
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); openExtLink() }} sx={btn(hasLink)}>
            <InsertLinkIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Link to wiki page">
          <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); if (!editor.state.selection.empty) savedSel.current = { from: editor.state.selection.from, to: editor.state.selection.to }; setPagePickerOpen(true) }} sx={btn(hasLink && editor.getAttributes('link').href?.startsWith('wiki://'))}>
            <SearchIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {hasLink && (
          <Tooltip title="Remove link">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetLink().run() }} sx={btn(false)}>
              <LinkOffIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Save status */}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {saveStatus === 'saving' && <CircularProgress size={10} sx={{ color: '#786c5c' }} />}
          {saveStatus !== 'idle' && (
            <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
              {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Page content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 2, md: 6 }, py: 4, maxWidth: 780, width: '100%', mx: 'auto' }}>
        {/* Icon + Title */}
        <Box sx={{ mb: 3 }}>
          <Box
            onClick={(e) => setEmojiAnchor(e.currentTarget)}
            sx={{
              fontSize: '2.5rem', lineHeight: 1, cursor: 'pointer', display: 'inline-block',
              mb: 1.5, borderRadius: 1, px: 0.5,
              '&:hover': { bgcolor: 'rgba(200,164,74,0.08)' },
            }}
            title="Change icon"
          >
            {icon}
          </Box>
          <Popover
            open={Boolean(emojiAnchor)}
            anchorEl={emojiAnchor}
            onClose={() => setEmojiAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <EmojiPicker
              data={emojiData}
              theme="dark"
              onEmojiSelect={(e: { native: string }) => {
                setIcon(e.native)
                triggerSave({ icon: e.native })
                setEmojiAnchor(null)
              }}
              previewPosition="none"
              skinTonePosition="none"
            />
          </Popover>
          <TextField
            value={title}
            variant="standard"
            fullWidth
            placeholder="Untitled"
            onChange={(e) => {
              setTitle(e.target.value)
              triggerSave({ title: e.target.value })
            }}
            inputProps={{ style: { fontSize: '2rem', fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontWeight: 700, padding: 0 } }}
            sx={{ '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' } }}
          />
        </Box>

        {/* Editor */}
        <Box sx={{
          '.tiptap': { outline: 'none' },
          '.tiptap p': { my: 0.5 },
          '.tiptap h1': { fontFamily: '"Cinzel", serif', fontSize: '1.6rem', color: '#e6d8c0', mt: 2, mb: 0.75 },
          '.tiptap h2': { fontFamily: '"Cinzel", serif', fontSize: '1.25rem', color: '#e6d8c0', mt: 1.75, mb: 0.5 },
          '.tiptap h3': { fontFamily: '"Cinzel", serif', fontSize: '1rem', color: '#c8b89a', mt: 1.5, mb: 0.5 },
          '.tiptap strong': { color: '#e6d8c0', fontWeight: 700 },
          '.tiptap em': { color: '#b4a48a', fontStyle: 'italic' },
          '.tiptap u': { textDecorationColor: 'rgba(200,164,74,0.5)' },
          '.tiptap ul, .tiptap ol': { pl: 3, my: 0.5 },
          '.tiptap li': { my: 0.25 },
          '.tiptap blockquote': {
            borderLeft: '3px solid rgba(200,164,74,0.4)',
            pl: 2, ml: 0, my: 1, color: '#786c5c', fontStyle: 'italic',
          },
          '.tiptap code': {
            fontFamily: '"JetBrains Mono", monospace', fontSize: '0.82em',
            bgcolor: 'rgba(120,108,92,0.15)', px: 0.5, borderRadius: 0.5, color: '#c8a44a',
          },
          '.tiptap pre': {
            bgcolor: '#111009', p: 2, borderRadius: 1, my: 1,
            border: '1px solid rgba(120,108,92,0.2)',
            '& code': { bgcolor: 'transparent', p: 0, color: '#c8a44a', fontSize: '0.85rem' },
          },
          '.tiptap hr': { border: 'none', borderTop: '1px solid rgba(120,108,92,0.2)', my: 2 },
          // Tables
          '.tiptap table': { borderCollapse: 'collapse', width: '100%', my: 1.5, fontSize: '0.9rem' },
          '.tiptap th, .tiptap td': {
            border: '1px solid rgba(120,108,92,0.3)', px: 1.5, py: 0.75,
            textAlign: 'left', verticalAlign: 'top',
          },
          '.tiptap th': { bgcolor: 'rgba(120,108,92,0.12)', color: '#c8a44a', fontFamily: '"Cinzel", serif', fontSize: '0.8rem', fontWeight: 600 },
          '.tiptap td': { color: '#b4a48a' },
          '.tiptap .selectedCell::after': { background: 'rgba(200,164,74,0.1)', content: '""', position: 'absolute', inset: 0, pointerEvents: 'none' },
          '.tiptap .column-resize-handle': { display: 'none' },
          '.tiptap a': { color: '#c8a44a', textDecorationColor: 'rgba(200,164,74,0.4)' },
          '.tiptap a[href^="wiki://"]': { color: '#a8c4e8', textDecorationColor: 'rgba(168,196,232,0.4)', cursor: 'pointer' },
          // Task list
          '.tiptap ul[data-type="taskList"]': { listStyle: 'none', pl: 1 },
          '.tiptap li[data-type="taskItem"]': { display: 'flex', alignItems: 'flex-start', gap: 1, my: 0.25 },
          '.tiptap li[data-type="taskItem"] > label': { mt: '3px', flexShrink: 0 },
          '.tiptap li[data-type="taskItem"] > label input': { accentColor: '#c8a44a', width: 14, height: 14 },
          '.tiptap li[data-type="taskItem"] > div': { flex: 1 },
          // Placeholder
          '.tiptap p.is-editor-empty:first-child::before': {
            content: 'attr(data-placeholder)', color: 'rgba(120,108,92,0.4)',
            pointerEvents: 'none', float: 'left', height: 0,
          },
        }}
          onContextMenu={handleContextMenu}
        >
          <EditorContent editor={editor} />
        </Box>
      </Box>

      {/* ── Context menu ───────────────────────────────────────────────── */}
      <Menu
        open={Boolean(ctxMenu)}
        onClose={closeCtx}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}
        slotProps={{ paper: { sx: { bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.2)', minWidth: 170 } } }}
      >
        <MenuItem dense onClick={() => { editor.chain().focus().toggleBold().run(); closeCtx() }}
          sx={{ fontSize: '0.82rem', color: editor.isActive('bold') ? '#c8a44a' : '#b4a48a', gap: 1 }}>
          <FormatBoldIcon sx={{ fontSize: 14 }} /> Bold
        </MenuItem>
        <MenuItem dense onClick={() => { editor.chain().focus().toggleItalic().run(); closeCtx() }}
          sx={{ fontSize: '0.82rem', color: editor.isActive('italic') ? '#c8a44a' : '#b4a48a', gap: 1 }}>
          <FormatItalicIcon sx={{ fontSize: 14 }} /> Italic
        </MenuItem>
        <MenuItem dense onClick={() => { editor.chain().focus().toggleUnderline().run(); closeCtx() }}
          sx={{ fontSize: '0.82rem', color: editor.isActive('underline') ? '#c8a44a' : '#b4a48a', gap: 1 }}>
          <FormatUnderlinedIcon sx={{ fontSize: 14 }} /> Underline
        </MenuItem>
        <MenuItem dense onClick={() => { editor.chain().focus().toggleCode().run(); closeCtx() }}
          sx={{ fontSize: '0.82rem', color: editor.isActive('code') ? '#c8a44a' : '#b4a48a', gap: 1 }}>
          <CodeIcon sx={{ fontSize: 14 }} /> Code
        </MenuItem>
        <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)', my: 0.5 }} />
        <MenuItem dense onClick={() => { closeCtx(); openExtLink() }}
          sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
          <InsertLinkIcon sx={{ fontSize: 14 }} /> {hasLink ? 'Edit link' : 'Add external link'}
        </MenuItem>
        <MenuItem dense onClick={() => { closeCtx(); setPagePickerOpen(true) }}
          sx={{ fontSize: '0.82rem', color: '#a8c4e8', gap: 1 }}>
          <SearchIcon sx={{ fontSize: 14 }} /> Link to wiki page
        </MenuItem>
        {hasLink && (
          <MenuItem dense onClick={() => { editor.chain().focus().unsetLink().run(); closeCtx() }}
            sx={{ fontSize: '0.82rem', color: '#b84848', gap: 1 }}>
            <LinkOffIcon sx={{ fontSize: 14 }} /> Remove link
          </MenuItem>
        )}
        {editor.isActive('table') && [
          <Divider key="td" sx={{ borderColor: 'rgba(120,108,92,0.15)', my: 0.5 }} />,
          <MenuItem key="arb" dense onClick={() => { editor.chain().focus().addRowBefore().run(); closeCtx() }}
            sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
            <TableChartIcon sx={{ fontSize: 14 }} /> Add row above
          </MenuItem>,
          <MenuItem key="ar" dense onClick={() => { editor.chain().focus().addRowAfter().run(); closeCtx() }}
            sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
            <TableChartIcon sx={{ fontSize: 14 }} /> Add row below
          </MenuItem>,
          <MenuItem key="acb" dense onClick={() => { editor.chain().focus().addColumnBefore().run(); closeCtx() }}
            sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
            <TableChartIcon sx={{ fontSize: 14 }} /> Add column before
          </MenuItem>,
          <MenuItem key="ac" dense onClick={() => { editor.chain().focus().addColumnAfter().run(); closeCtx() }}
            sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
            <TableChartIcon sx={{ fontSize: 14 }} /> Add column after
          </MenuItem>,
          editor.can().mergeCells() && (
            <MenuItem key="mc" dense onClick={() => { editor.chain().focus().mergeCells().run(); closeCtx() }}
              sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
              <TableChartIcon sx={{ fontSize: 14 }} /> Merge cells
            </MenuItem>
          ),
          editor.can().splitCell() && (
            <MenuItem key="sc" dense onClick={() => { editor.chain().focus().splitCell().run(); closeCtx() }}
              sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
              <TableChartIcon sx={{ fontSize: 14 }} /> Split cell
            </MenuItem>
          ),
          <Divider key="td2" sx={{ borderColor: 'rgba(120,108,92,0.15)', my: 0.5 }} />,
          <MenuItem key="dr" dense onClick={() => { editor.chain().focus().deleteRow().run(); closeCtx() }}
            sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
            <TableChartIcon sx={{ fontSize: 14 }} /> Delete row
          </MenuItem>,
          <MenuItem key="dc" dense onClick={() => { editor.chain().focus().deleteColumn().run(); closeCtx() }}
            sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1 }}>
            <TableChartIcon sx={{ fontSize: 14 }} /> Delete column
          </MenuItem>,
          <MenuItem key="dt" dense onClick={() => { editor.chain().focus().deleteTable().run(); closeCtx() }}
            sx={{ fontSize: '0.82rem', color: '#b84848', gap: 1 }}>
            <TableChartIcon sx={{ fontSize: 14 }} /> Delete table
          </MenuItem>,
        ]}
      </Menu>

      {/* ── External link dialog ───────────────────────────────────────── */}
      <Dialog open={extLinkOpen} onClose={() => setExtLinkOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.2)' } }}>
        <DialogTitle sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', fontSize: '1rem', pb: 1 }}>
          {editor.getAttributes('link').href ? 'Edit Link' : 'Add Link'}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField fullWidth autoFocus size="small" label="URL" value={extLinkUrl}
            onChange={(e) => setExtLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyExtLink() }}
            placeholder="https://..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setExtLinkOpen(false)} sx={{ color: '#786c5c' }}>Cancel</Button>
          <Button onClick={applyExtLink} variant="contained" disabled={!extLinkUrl.trim()}
            sx={{ bgcolor: '#c8a44a', color: '#0b0906', '&:hover': { bgcolor: '#d4b05a' } }}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Page picker dialog ─────────────────────────────────────────── */}
      <Dialog open={pagePickerOpen} onClose={() => { setPagePickerOpen(false); setPageSearch('') }}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.2)' } }}>
        <DialogTitle sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', fontSize: '1rem', pb: 1 }}>
          Link to Wiki Page
        </DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 0 }}>
          <TextField fullWidth autoFocus size="small" placeholder="Search pages…" value={pageSearch}
            onChange={(e) => setPageSearch(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Box sx={{ maxHeight: 320, overflow: 'auto', mx: -1 }}>
            {filteredPages.length === 0 ? (
              <Typography sx={{ fontSize: '0.82rem', color: '#786c5c', px: 1, py: 1 }}>No pages found</Typography>
            ) : filteredPages.map((p) => (
              <MenuItem key={p.id} onClick={() => applyPageLink(p.id)}
                sx={{ fontSize: '0.85rem', color: '#b4a48a', gap: 1, borderRadius: 0.5,
                  '&:hover': { bgcolor: 'rgba(200,164,74,0.06)', color: '#e6d8c0' } }}>
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>{p.icon ?? '📄'}</span> {p.title}
              </MenuItem>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, pt: 1 }}>
          <Button onClick={() => { setPagePickerOpen(false); setPageSearch('') }} sx={{ color: '#786c5c' }}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ── Main Wiki page ────────────────────────────────────────────────────────────

export default function Wiki() {
  const { campaignId } = useCampaign()
  const [searchParams, setSearchParams] = useSearchParams()
  const paramPageId = searchParams.get('page')
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const lsKey = campaignId ? `wiki-last-page-${campaignId}` : null
  const initialPageId = paramPageId ?? (lsKey ? (localStorage.getItem(lsKey) ?? null) : null)
  const [selectedId, setSelectedId] = useState<string | null>(initialPageId)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(!isMobile || !selectedId)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const treeInitialized = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [nestTarget, setNestTarget] = useState<string | null>(null)

  // Sidebar resize
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem('wiki-sidebar-width')
    return stored ? parseInt(stored) : 240
  })
  const isResizingRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const newWidth = Math.max(160, Math.min(520, resizeStartWidthRef.current + e.clientX - resizeStartXRef.current))
      setSidebarWidth(newWidth)
      localStorage.setItem('wiki-sidebar-width', String(newWidth))
    }
    const onUp = () => { isResizingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Hover-timer for nest detection: hold over an item for 500ms → nest target activates
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverIdRef = useRef<string | null>(null)

  const clearHover = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    hoverIdRef.current = null
    setNestTarget(null)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])
  const importInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const mdInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMenuAnchor, setImportMenuAnchor] = useState<null | HTMLElement>(null)

  const { data, loading, refetch } = useQuery(WIKI_PAGES, {
    variables: { campaignId },
    skip: !campaignId,
  })

  const apolloClient = useApolloClient()
  const [createPage] = useMutation(CREATE_WIKI_PAGE)
  const [updatePage] = useMutation(UPDATE_WIKI_PAGE)
  const [deletePage] = useMutation(DELETE_WIKI_PAGE, { refetchQueries: ['WikiPages'] })

  const pages: WikiPageFlat[] = data?.wikiPages ?? []
  const tree = buildTree(pages)
  const selectedPage = pages.find((p) => p.id === selectedId) ?? null

  // Collect ancestor IDs for a given page
  const getAncestorIds = useCallback((pageId: string): string[] => {
    const ancestors: string[] = []
    let cur = pages.find((p) => p.id === pageId)
    while (cur?.parentId) {
      ancestors.push(cur.parentId)
      cur = pages.find((p) => p.id === cur!.parentId)
    }
    return ancestors
  }, [pages])

  // On first data load: collapse every folder, then expand ancestors of active page
  useEffect(() => {
    if (pages.length === 0 || treeInitialized.current) return
    treeInitialized.current = true
    const allParentIds = new Set(
      pages.filter((p) => pages.some((c) => c.parentId === p.id)).map((p) => p.id)
    )
    if (selectedId) getAncestorIds(selectedId).forEach((id) => allParentIds.delete(id))
    setCollapsedIds(allParentIds)
  }, [pages]) // eslint-disable-line react-hooks/exhaustive-deps

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return pages.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      stripHtml(p.content || '').toLowerCase().includes(q)
    )
  }, [pages, searchQuery])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setSearchParams({ page: id }, { replace: true })
    if (lsKey) localStorage.setItem(lsKey, id)
    // Ensure all ancestor folders are open
    const ancestors = getAncestorIds(id)
    if (ancestors.length > 0) {
      setCollapsedIds((prev) => {
        const next = new Set(prev)
        ancestors.forEach((aid) => next.delete(aid))
        return next
      })
    }
    if (isMobile) setShowSidebar(false)
  }

  const handleAdd = async (parentId?: string) => {
    const result = await createPage({
      variables: { input: { campaignId, parentId: parentId ?? null } },
    })
    const newId = result.data?.createWikiPage?.id
    await refetch()
    if (newId) {
      setSelectedId(newId)
      setRenamingId(newId)
      setSearchParams({ page: newId }, { replace: true })
      if (isMobile) setShowSidebar(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      setSearchParams({}, { replace: true })
      if (lsKey) localStorage.removeItem(lsKey)
    }
    await deletePage({ variables: { id } })
    setPendingDeleteId(null)
  }

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    const overId = over?.id as string | undefined

    if (!overId || overId === 'root-zone' || overId === activeDragId) {
      clearHover()
      return
    }

    // Already hovering this item — let the timer run
    if (hoverIdRef.current === overId) return

    // New item — restart the timer
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverIdRef.current = overId
    setNestTarget(null)

    hoverTimerRef.current = setTimeout(() => {
      if (hoverIdRef.current === overId && !isDescendant(pages, activeDragId ?? '', overId)) {
        setNestTarget(overId)
      }
    }, 500)
  }, [activeDragId, pages, clearHover])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    const currentNest = nestTarget
    clearHover()

    const activeId = active.id as string
    const activePage = pages.find((p) => p.id === activeId)
    if (!activePage) return

    // ── Make root ──────────────────────────────────────────────────────────────
    if (over?.id === 'root-zone' && activePage.parentId !== null) {
      const rootPages = pages.filter((p) => p.parentId === null)
      const newOrderIndex = rootPages.length
      apolloClient.cache.modify({
        id: apolloClient.cache.identify({ __typename: 'WikiPage', id: activeId }),
        fields: { parentId: () => null, orderIndex: () => newOrderIndex },
      })
      updatePage({ variables: { id: activeId, input: { parentId: null, orderIndex: newOrderIndex } } })
        .then(() => refetch())
      return
    }

    // ── Nest into target ───────────────────────────────────────────────────────
    if (currentNest && currentNest !== activeId && !isDescendant(pages, activeId, currentNest)) {
      const targetChildren = pages.filter((p) => p.parentId === currentNest)
      const newOrderIndex = targetChildren.length
      apolloClient.cache.modify({
        id: apolloClient.cache.identify({ __typename: 'WikiPage', id: activeId }),
        fields: { parentId: () => currentNest, orderIndex: () => newOrderIndex },
      })
      // Expand the new parent so the moved page is visible
      setCollapsedIds((prev) => { const next = new Set(prev); next.delete(currentNest); return next })
      updatePage({ variables: { id: activeId, input: { parentId: currentNest, orderIndex: newOrderIndex } } })
        .then(() => refetch())
      return
    }

    // ── Reorder siblings ───────────────────────────────────────────────────────
    if (!over || active.id === over.id) return
    const overId = over.id as string
    const overPage = pages.find((p) => p.id === overId)
    if (!overPage || activePage.parentId !== overPage.parentId) return

    const siblings = pages
      .filter((p) => p.parentId === activePage.parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
    const oldIndex = siblings.findIndex((p) => p.id === activeId)
    const newIndex = siblings.findIndex((p) => p.id === overId)
    if (oldIndex === newIndex) return

    const reordered = arrayMove(siblings, oldIndex, newIndex)
    reordered.forEach((sibling, i) => {
      if (sibling.orderIndex !== i) {
        apolloClient.cache.modify({
          id: apolloClient.cache.identify({ __typename: 'WikiPage', id: sibling.id }),
          fields: { orderIndex: () => i },
        })
      }
    })
    Promise.all(
      reordered.map((p, i) =>
        p.orderIndex !== i ? updatePage({ variables: { id: p.id, input: { orderIndex: i } } }) : Promise.resolve()
      )
    )
  }, [pages, nestTarget, apolloClient, updatePage, refetch, setCollapsedIds, clearHover])

  const handleFinishRename = async (id: string, title: string) => {
    setRenamingId(null)
    await updatePage({ variables: { id, input: { title } } })
    refetch()
  }

  const handleSave = useCallback(async (id: string, data: { title?: string; content?: string; icon?: string }) => {
    await updatePage({ variables: { id, input: data } })
    if (data.title || data.icon) refetch()
  }, [updatePage, refetch])

  const runImport = async (parsed: ParsedPage[]) => {
    setImportTotal(parsed.length)
    const idMap = new Map<string, string>()
    // Track pages that need link resolution (have wiki:// placeholders)
    const withLinks: Array<{ id: string; content: string }> = []
    let done = 0

    // Phase 1: create all pages
    for (const page of parsed) {
      const parentPathKey = page.pathSegments.slice(0, -1).join('/')
      const parentId = idMap.get(parentPathKey) ?? null
      const result = await createPage({
        variables: { input: { campaignId, parentId, title: page.title, icon: page.icon, orderIndex: page.orderIndex } },
      })
      const newId = result.data?.createWikiPage?.id
      if (newId) {
        idMap.set(page.pathSegments.join('/'), newId)
        if (page.content) {
          if (page.content.includes('wiki://')) {
            withLinks.push({ id: newId, content: page.content })
          } else {
            const html = await marked(page.content, { gfm: true, breaks: false }) as string
            await updatePage({ variables: { id: newId, input: { content: html } } })
          }
        }
      }
      done++
      setImportProgress(done)
    }

    // Phase 2: resolve wiki://PATH → wiki://pageId in markdown, then convert to HTML
    for (const { id, content } of withLinks) {
      let resolved = content
      for (const [pathKey, targetId] of idMap) {
        resolved = resolved.split(`wiki://${pathKey}`).join(`wiki://${targetId}`)
      }
      // URL-encode spaces in any remaining unresolved wiki:// paths so marked() treats them as valid links
      resolved = resolved.replace(/\(wiki:\/\/([^)]+)\)/g, (_, path) =>
        `(wiki://${path.replace(/ /g, '%20')})`
      )
      const html = await marked(resolved, { gfm: true, breaks: false }) as string
      await updatePage({ variables: { id, input: { content: html } } })
    }

    await refetch()
  }

  const handleImport = async (files: FileList) => {
    if (!campaignId || files.length === 0) return
    setImporting(true)
    setImportError(null)
    setImportProgress(0)
    try {
      await runImport(await parseNotionExport(files))
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const handleZipImport = async (file: File) => {
    if (!campaignId) return
    setImporting(true)
    setImportError(null)
    setImportProgress(0)
    try {
      await runImport(await parseNotionZip(file))
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
      if (zipInputRef.current) zipInputRef.current.value = ''
    }
  }

  const handleMdImport = async (files: FileList) => {
    if (!campaignId || files.length === 0) return
    setImporting(true)
    setImportError(null)
    setImportProgress(0)
    try {
      await runImport(await parsePlainMdFiles(files))
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
      if (mdInputRef.current) mdInputRef.current.value = ''
    }
  }

  return (
    <Box sx={{ position: 'relative', display: 'flex', height: isMobile ? 'calc(100svh - 68px)' : 'calc(100svh)', overflow: 'hidden', mx: { xs: -2, md: -3 }, mt: { xs: 0, md: -3 }, mb: { xs: -2, md: -3 } }}>

      {/* Sidebar */}
      {(!isMobile || showSidebar) && (
        <Box sx={{
          width: isMobile ? '100%' : sidebarWidth, flexShrink: 0, display: 'flex', flexDirection: 'column',
          bgcolor: '#0d0b08', height: '100%', overflow: 'hidden',
          ...(isMobile ? { position: 'absolute', zIndex: 10, top: 0, left: 0, right: 0 } : {}),
        }}>
          {/* Hidden inputs for import modes */}
          <input ref={importInputRef} type="file"
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory="" multiple style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files) handleImport(e.target.files) }}
          />
          <input ref={zipInputRef} type="file" accept=".zip" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) handleZipImport(e.target.files[0]) }}
          />
          <input ref={mdInputRef} type="file" accept=".md" multiple style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files) handleMdImport(e.target.files) }}
          />

          {/* Sidebar header */}
          <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid rgba(120,108,92,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono"' }}>
              Wiki
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              <Tooltip title="Collapse all">
                <IconButton size="small" onClick={() => setCollapsedIds(new Set(pages.filter(p => pages.some(c => c.parentId === p.id)).map(p => p.id)))}
                  sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.5 }}>
                  <UnfoldLessIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Import Notion export">
                <IconButton size="small" disabled={importing}
                  onClick={(e) => setImportMenuAnchor(e.currentTarget)}
                  sx={{ color: '#786c5c', '&:hover': { color: '#62a870' }, p: 0.5 }}>
                  <UploadFileIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={importMenuAnchor}
                open={Boolean(importMenuAnchor)}
                onClose={() => setImportMenuAnchor(null)}
                slotProps={{ paper: { sx: { bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.2)', minWidth: 180 } } }}
              >
                <MenuItem onClick={() => { setImportMenuAnchor(null); zipInputRef.current?.click() }}
                  sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1.5 }}>
                  <UploadFileIcon sx={{ fontSize: 15, color: '#786c5c' }} /> Import .zip
                </MenuItem>
                <MenuItem onClick={() => { setImportMenuAnchor(null); importInputRef.current?.click() }}
                  sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1.5 }}>
                  <UploadFileIcon sx={{ fontSize: 15, color: '#786c5c' }} /> Import folder
                </MenuItem>
                <MenuItem onClick={() => { setImportMenuAnchor(null); mdInputRef.current?.click() }}
                  sx={{ fontSize: '0.82rem', color: '#b4a48a', gap: 1.5 }}>
                  <UploadFileIcon sx={{ fontSize: 15, color: '#786c5c' }} /> Import .md files
                </MenuItem>
              </Menu>
              <Tooltip title="New page">
                <IconButton size="small" onClick={() => handleAdd()} sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.5 }}>
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Import progress */}
          {importing && (
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
              <Typography sx={{ fontSize: '0.68rem', color: '#62a870', fontFamily: '"JetBrains Mono"', mb: 0.5 }}>
                Importing {importProgress}/{importTotal}…
              </Typography>
              <LinearProgress
                variant={importTotal > 0 ? 'determinate' : 'indeterminate'}
                value={importTotal > 0 ? (importProgress / importTotal) * 100 : undefined}
                sx={{ height: 3, borderRadius: 1, bgcolor: 'rgba(120,108,92,0.2)', '& .MuiLinearProgress-bar': { bgcolor: '#62a870' } }}
              />
            </Box>
          )}
          {importError && (
            <Alert severity="error" sx={{ mx: 1, mt: 0.5, fontSize: '0.72rem', py: 0.25 }} onClose={() => setImportError(null)}>
              {importError}
            </Alert>
          )}

          {/* Search */}
          <Box sx={{ px: 1.25, py: 0.75, borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(120,108,92,0.07)', borderRadius: 1, px: 1, py: 0.4, border: '1px solid rgba(120,108,92,0.15)' }}>
              <SearchIcon sx={{ fontSize: 13, color: '#786c5c', flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pages…"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: '0.78rem', color: '#b4a48a', fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25, color: '#786c5c', '&:hover': { color: '#c8a44a' } }}>
                  <CloseIcon sx={{ fontSize: 11 }} />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Page tree / search results */}
          <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
                <CircularProgress size={18} sx={{ color: '#c8a44a' }} />
              </Box>
            )}
            {!loading && searchResults !== null ? (
              // ── Search results (flat list) ──
              searchResults.length === 0 ? (
                <Typography sx={{ color: '#786c5c', fontSize: '0.78rem', textAlign: 'center', pt: 3, px: 2 }}>
                  No results for "{searchQuery}"
                </Typography>
              ) : (
                searchResults.map((page) => {
                  const isSelected = selectedId === page.id
                  const snippet = stripHtml(page.content || '')
                  const q = searchQuery.toLowerCase()
                  const snippetIdx = snippet.toLowerCase().indexOf(q)
                  const contentSnippet = snippetIdx !== -1
                    ? '…' + snippet.slice(Math.max(0, snippetIdx - 20), snippetIdx + 60).trim() + '…'
                    : ''
                  return (
                    <Box
                      key={page.id}
                      onClick={() => { setSearchQuery(''); handleSelect(page.id) }}
                      sx={{
                        px: 1.5, py: 0.6, mx: 0.5, borderRadius: 1, cursor: 'pointer',
                        bgcolor: isSelected ? 'rgba(200,164,74,0.1)' : 'transparent',
                        '&:hover': { bgcolor: isSelected ? 'rgba(200,164,74,0.12)' : 'rgba(120,108,92,0.1)' },
                        mb: 0.25,
                      }}
                    >
                      <Typography sx={{ fontSize: '0.82rem', color: isSelected ? '#c8a44a' : '#b4a48a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {page.icon ?? '📄'} {highlightMatch(page.title, searchQuery)}
                      </Typography>
                      {contentSnippet && (
                        <Typography sx={{ fontSize: '0.7rem', color: '#786c5c', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {highlightMatch(contentSnippet, searchQuery)}
                        </Typography>
                      )}
                    </Box>
                  )
                })
              )
            ) : (
              // ── Normal tree ──
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setActiveDragId(e.active.id as string)}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={() => { setActiveDragId(null); clearHover() }}
              >
                {!loading && tree.length === 0 && (
                  <Typography sx={{ color: '#786c5c', fontSize: '0.78rem', textAlign: 'center', pt: 3, px: 2 }}>
                    No pages yet.
                  </Typography>
                )}
                {/* Root drop zone — visible only while dragging a nested page */}
                {activeDragId && pages.find((p) => p.id === activeDragId)?.parentId && (
                  <RootDropZone />
                )}
                <SortableContext items={tree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                  {tree.map((node) => (
                    <PageTreeRow
                      key={node.id} node={node} depth={0}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                      onAdd={handleAdd}
                      onDelete={setPendingDeleteId}
                      renamingId={renamingId}
                      onStartRename={setRenamingId}
                      onFinishRename={handleFinishRename}
                      collapsedIds={collapsedIds}
                      onToggleCollapse={handleToggleCollapse}
                      nestTargetId={nestTarget}
                      nestActive={nestTarget !== null}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeDragId && (() => {
                    const p = pages.find((pg) => pg.id === activeDragId)
                    return p ? (
                      <Box sx={{ px: 1.5, py: 0.4, bgcolor: '#1a1612', border: '1px solid rgba(200,164,74,0.3)', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 0.75, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                        <Typography sx={{ fontSize: '0.82rem' }}>{p.icon ?? '📄'}</Typography>
                        <Typography sx={{ fontSize: '0.82rem', color: '#c8a44a' }}>{p.title}</Typography>
                      </Box>
                    ) : null
                  })()}
                </DragOverlay>
              </DndContext>
            )}
          </Box>
        </Box>
      )}

      {/* Resize divider */}
      {!isMobile && (
        <Box
          onMouseDown={(e) => {
            isResizingRef.current = true
            resizeStartXRef.current = e.clientX
            resizeStartWidthRef.current = sidebarWidth
            e.preventDefault()
          }}
          sx={{
            width: 4, flexShrink: 0, cursor: 'col-resize', bgcolor: 'rgba(120,108,92,0.15)',
            transition: 'background-color 0.15s',
            '&:hover': { bgcolor: 'rgba(200,164,74,0.4)' },
            userSelect: 'none',
          }}
        />
      )}

      {/* Editor area */}
      {(!isMobile || !showSidebar) && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#0f0d0a' }}>
          {isMobile && (
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(120,108,92,0.12)' }}>
              <IconButton size="small" onClick={() => setShowSidebar(true)} sx={{ color: '#786c5c' }}>
                <ArrowBackIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}

          {selectedPage ? (
            <WikiEditor key={selectedPage.id} page={selectedPage} onSave={handleSave} onPageNavigate={(id) => {
                handleSelect(id)
              }} pages={pages} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
              <Typography sx={{ fontSize: '2rem' }}>📖</Typography>
              <Typography sx={{ color: '#786c5c', fontFamily: '"Cinzel", serif', fontSize: '0.9rem' }}>
                Select a page or create a new one
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Delete confirmation */}
      <Dialog
        open={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        PaperProps={{ sx: { bgcolor: '#1a1612', border: '1px solid rgba(120,108,92,0.3)', minWidth: 320 } }}
      >
        <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem', pb: 1 }}>
          Delete page?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#786c5c', fontSize: '0.85rem' }}>
            {(() => {
              const p = pages.find((pg) => pg.id === pendingDeleteId)
              const hasChildren = (p?.id && pages.some((pg) => pg.parentId === p.id)) ?? false
              return hasChildren
                ? 'This will delete the page and all its subpages. This cannot be undone.'
                : 'This page will be permanently deleted.'
            })()}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={() => setPendingDeleteId(null)} size="small" sx={{ color: '#786c5c', fontSize: '0.8rem' }}>
            Cancel
          </Button>
          <Button
            onClick={() => pendingDeleteId && handleDelete(pendingDeleteId)}
            size="small"
            variant="contained"
            sx={{ bgcolor: '#b84848', '&:hover': { bgcolor: '#a03838' }, fontSize: '0.8rem' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
