import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, gql } from '@apollo/client'
import {
  Dialog, Box, Typography, IconButton, Tooltip, TextField,
  Divider, CircularProgress, Button, useMediaQuery, useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import SearchIcon from '@mui/icons-material/Search'
import { useCampaign } from '../context/campaign'

// ── GraphQL ────────────────────────────────────────────────────────────────────

const CREATE_MARKER = gql`
  mutation CreateMapLootMarker($mapId: ID!, $x: Float!, $y: Float!) {
    createMapLootMarker(mapId: $mapId, x: $x, y: $y) {
      id mapId x y label itemIds items { id name type }
    }
  }
`
const UPDATE_MARKER = gql`
  mutation UpdateMapLootMarker($id: ID!, $x: Float, $y: Float, $label: String, $itemIds: [ID!]) {
    updateMapLootMarker(id: $id, x: $x, y: $y, label: $label, itemIds: $itemIds) {
      id mapId x y label itemIds items { id name type }
    }
  }
`
const DELETE_MARKER = gql`
  mutation DeleteMapLootMarker($id: ID!) { deleteMapLootMarker(id: $id) }
`
const CREATE_ITEM = gql`
  mutation CreateLootItem($input: CreateItemInput!) {
    createItem(input: $input) { id name type }
  }
`
const LINK_ITEM_MISSION = gql`
  mutation LinkItemToMission($id: ID!, $input: UpdateItemInput!) {
    updateItem(id: $id, input: $input) { id }
  }
`
const RENAME_MAP = gql`
  mutation RenameMissionMap($id: ID!, $name: String!) {
    renameMissionMap(id: $id, name: $name) { id name }
  }
`

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LootMarker {
  id: string
  mapId: string
  x: number
  y: number
  label: string | null
  itemIds: string[]
  items: Array<{ id: string; name: string; type: string }>
}

interface CampaignItem {
  id: string
  name: string
  type: string
}

interface Props {
  open: boolean
  onClose: () => void
  map: { id: string; name: string; url: string }
  initialMarkers: LootMarker[]
  allItems: CampaignItem[]
  missionId: string
  onMarkersChanged: () => void
}

// ── Chest icon SVG ─────────────────────────────────────────────────────────────

function ChestSvg({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="11" width="20" height="11" rx="2" fill="#7a5c1e" stroke="#c8a44a" strokeWidth="1.4"/>
      <path d="M2 13 C2 7 22 7 22 13" fill="#9b7526" stroke="#c8a44a" strokeWidth="1.4"/>
      <rect x="9.5" y="14" width="5" height="4" rx="1" fill="#c8a44a"/>
      <line x1="2" y1="13" x2="22" y2="13" stroke="#c8a44a" strokeWidth="1.2"/>
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MapLootOverlay({ open, onClose, map, initialMarkers, allItems, missionId, onMarkersChanged }: Props) {
  const { campaignId } = useCampaign()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [markers, setMarkers] = useState<LootMarker[]>(initialMarkers)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [search, setSearch] = useState('')
  const [quickName, setQuickName] = useState('')
  const [creating, setCreating] = useState(false)

  // Label edit
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')

  // Map name edit
  const [mapName, setMapName] = useState(map.name)
  const [editingMapName, setEditingMapName] = useState(false)
  const [mapNameDraft, setMapNameDraft] = useState(map.name)
  const [renameMap] = useMutation(RENAME_MAP)

  const handleSaveMapName = async () => {
    const trimmed = mapNameDraft.trim()
    if (!trimmed || trimmed === mapName) { setEditingMapName(false); return }
    setMapName(trimmed)
    setEditingMapName(false)
    await renameMap({ variables: { id: map.id, name: trimmed } })
  }

  // Sync markers when parent data changes (e.g. after refetch)
  useEffect(() => { setMarkers(initialMarkers) }, [initialMarkers])

  // On mobile, shift the map up so the selected marker isn't hidden behind the bottom sheet
  const [mapOffsetY, setMapOffsetY] = useState(0)
  useEffect(() => {
    if (!isMobile || !selectedId) { setMapOffsetY(0); return }
    const marker = markers.find((m) => m.id === selectedId)
    if (!marker || !containerRef.current) { setMapOffsetY(0); return }
    const rect = containerRef.current.getBoundingClientRect()
    const markerScreenY = rect.top + (marker.y / 100) * rect.height
    const sheetRatio = editMode ? 0.55 : 0.45
    const safeBottom = window.innerHeight * (1 - sheetRatio) - 72 // 72px clearance above sheet
    if (markerScreenY > safeBottom) {
      setMapOffsetY(-(markerScreenY - safeBottom))
    } else {
      setMapOffsetY(0)
    }
  }, [selectedId, isMobile, markers, editMode])

  // Close side panel when switching maps
  useEffect(() => {
    if (open) { setSelectedId(null); setEditMode(false); setSearch(''); setMapName(map.name); setMapNameDraft(map.name) }
  }, [open, map.id])

  const selected = markers.find((m) => m.id === selectedId) ?? null

  // ── Drag state ──────────────────────────────────────────────────────────────

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null)

  const getRelativePos = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  const [createMarkerMut] = useMutation(CREATE_MARKER)
  const [updateMarkerMut] = useMutation(UPDATE_MARKER)
  const [deleteMarkerMut] = useMutation(DELETE_MARKER)
  const [createItemMut] = useMutation(CREATE_ITEM)
  const [linkItemMission] = useMutation(LINK_ITEM_MISSION)

  // Global mouse handlers for drag
  useEffect(() => {
    if (!editMode) return
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      dragRef.current.moved = true
      const { x, y } = getRelativePos(e.clientX, e.clientY)
      setMarkers((prev) => prev.map((m) => m.id === dragRef.current!.id ? { ...m, x, y } : m))
    }
    const onUp = async (e: MouseEvent) => {
      if (!dragRef.current) return
      const { id, moved } = dragRef.current
      dragRef.current = null
      if (moved) {
        const marker = markers.find((m) => m.id === id)
        if (marker) {
          await updateMarkerMut({ variables: { id, x: marker.x, y: marker.y } })
          onMarkersChanged()
        }
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [editMode, markers, updateMarkerMut, getRelativePos, onMarkersChanged])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOuterClick = () => {
    // Clicking the dark area outside the image always deselects
    setSelectedId(null)
  }

  const handleImageClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (dragRef.current?.moved) return
    if (!editMode) {
      // In view mode, clicking the image deselects
      setSelectedId(null)
      return
    }
    const { x, y } = getRelativePos(e.clientX, e.clientY)
    const res = await createMarkerMut({ variables: { mapId: map.id, x, y } })
    const m: LootMarker = { ...res.data.createMapLootMarker, items: [] }
    setMarkers((prev) => [...prev, m])
    setSelectedId(m.id)
    onMarkersChanged()
  }

  const handleMarkerMouseDown = (e: React.MouseEvent, id: string) => {
    if (!editMode) return
    e.stopPropagation()
    dragRef.current = { id, moved: false }
  }

  const handleMarkerClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (dragRef.current?.moved) return
    setSelectedId((prev) => prev === id ? null : id)
    setSearch('')
  }

  const handleDeleteMarker = async () => {
    if (!selected) return
    await deleteMarkerMut({ variables: { id: selected.id } })
    setMarkers((prev) => prev.filter((m) => m.id !== selected.id))
    setSelectedId(null)
    onMarkersChanged()
  }

  const handleSaveLabel = async () => {
    if (!selected) return
    const res = await updateMarkerMut({ variables: { id: selected.id, label: labelDraft || null } })
    setMarkers((prev) => prev.map((m) => m.id === selected.id ? { ...m, label: res.data.updateMapLootMarker.label } : m))
    setEditingLabel(false)
    onMarkersChanged()
  }

  const handleAddItem = async (item: CampaignItem) => {
    if (!selected) return
    const newIds = [...selected.itemIds, item.id]
    const res = await updateMarkerMut({ variables: { id: selected.id, itemIds: newIds } })
    // Also link to mission if not already
    await linkItemMission({ variables: { id: item.id, input: { missionId } } })
    setMarkers((prev) => prev.map((m) => m.id === selected.id
      ? { ...m, itemIds: res.data.updateMapLootMarker.itemIds, items: res.data.updateMapLootMarker.items }
      : m))
    onMarkersChanged()
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!selected) return
    const newIds = selected.itemIds.filter((id) => id !== itemId)
    const res = await updateMarkerMut({ variables: { id: selected.id, itemIds: newIds } })
    setMarkers((prev) => prev.map((m) => m.id === selected.id
      ? { ...m, itemIds: res.data.updateMapLootMarker.itemIds, items: res.data.updateMapLootMarker.items }
      : m))
    onMarkersChanged()
  }

  const handleQuickCreate = async () => {
    if (!quickName.trim() || !selected) return
    setCreating(true)
    try {
      const res = await createItemMut({ variables: { input: { campaignId, name: quickName.trim(), type: 'ITEM' } } })
      const newItem: CampaignItem = res.data.createItem
      // Link to mission
      await linkItemMission({ variables: { id: newItem.id, input: { missionId } } })
      // Add to marker
      const newIds = [...selected.itemIds, newItem.id]
      const markerRes = await updateMarkerMut({ variables: { id: selected.id, itemIds: newIds } })
      setMarkers((prev) => prev.map((m) => m.id === selected.id
        ? { ...m, itemIds: markerRes.data.updateMapLootMarker.itemIds, items: markerRes.data.updateMapLootMarker.items }
        : m))
      setQuickName('')
      onMarkersChanged()
    } finally {
      setCreating(false)
    }
  }

  // ── Filtered items for search ───────────────────────────────────────────────

  const assignedIds = new Set(selected?.itemIds ?? [])
  const filteredItems = allItems.filter(
    (i) => !assignedIds.has(i.id) &&
      (i.name.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase()))
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} fullScreen onClose={onClose} PaperProps={{ sx: { bgcolor: '#0b0906' } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1.25, sm: 2 }, py: { xs: 0.75, sm: 1 }, borderBottom: '1px solid rgba(120,108,92,0.2)', flexShrink: 0, minHeight: 0 }}>
        {editingMapName ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
            <TextField
              size="small"
              value={mapNameDraft}
              onChange={(e) => setMapNameDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMapName(); if (e.key === 'Escape') setEditingMapName(false) }}
              onBlur={handleSaveMapName}
              sx={{ '& .MuiInputBase-root': { fontSize: '0.9rem', fontFamily: '"Cinzel", serif', color: '#e6d8c0' }, maxWidth: 400 }}
            />
          </Box>
        ) : (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0, cursor: 'text', '&:hover .rename-hint': { opacity: 1 } }}
            onClick={() => { setMapNameDraft(mapName); setEditingMapName(true) }}
          >
            <Typography sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: { xs: '0.78rem', sm: '0.9rem' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mapName}
            </Typography>
            <EditIcon className="rename-hint" sx={{ fontSize: 13, color: '#786c5c', opacity: 0, flexShrink: 0, transition: 'opacity 0.15s' }} />
          </Box>
        )}
        {!isMobile && (
          <Typography sx={{ color: '#786c5c', fontSize: '0.72rem', flexShrink: 0 }}>
            {markers.length} {markers.length === 1 ? 'marker' : 'markers'}
          </Typography>
        )}
        <Tooltip title={editMode ? 'Exit placement mode' : 'Place loot markers'}>
          <Button
            size="small"
            startIcon={<EditIcon sx={{ fontSize: 14 }} />}
            onClick={() => setEditMode((v) => !v)}
            variant={editMode ? 'contained' : 'outlined'}
            sx={{
              fontSize: '0.72rem', py: 0.4, px: { xs: 1, sm: 1.5 }, flexShrink: 0,
              ...(editMode ? {} : { borderColor: 'rgba(200,164,74,0.35)', color: '#c8a44a', '&:hover': { borderColor: '#c8a44a' } }),
            }}
          >
            {editMode ? 'Finish' : 'Edit'}
          </Button>
        </Tooltip>
        <IconButton onClick={onClose} size="small" sx={{ color: '#786c5c', '&:hover': { color: '#e6d8c0' }, flexShrink: 0 }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {editMode && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'rgba(200,164,74,0.06)', borderBottom: '1px solid rgba(200,164,74,0.12)' }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#c8a44a' }}>
            {isMobile ? 'Tap map to place a marker · Long-press to drag' : 'Click anywhere on the map to place a loot marker · Drag markers to reposition'}
          </Typography>
        </Box>
      )}

      {/* Body */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Map area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: editMode ? 'crosshair' : selectedId ? 'pointer' : 'default',
            bgcolor: '#050302',
            transform: `translateY(${mapOffsetY}px)`,
            transition: 'transform 0.3s ease',
          }}
          onClick={handleOuterClick}
        >
          {/* Image + markers container — inline-block so it shrinks to image size */}
          <Box
            ref={containerRef}
            onClick={handleImageClick}
            sx={{
              position: 'relative',
              display: 'inline-block',
              lineHeight: 0,
              maxWidth: '100%',
              maxHeight: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 120px)' },
              userSelect: 'none',
            }}
          >
            <Box
              component="img"
              src={map.url}
              alt={map.name}
              sx={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 120px)',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
            />

            {/* Markers */}
            {markers.map((m) => {
              const isSelected = m.id === selectedId
              return (
                <Box
                  key={m.id}
                  onMouseDown={(e) => handleMarkerMouseDown(e, m.id)}
                  onClick={(e) => handleMarkerClick(e, m.id)}
                  sx={{
                    position: 'absolute',
                    left: `${m.x}%`,
                    top: `${m.y}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: editMode ? 'grab' : 'pointer',
                    zIndex: isSelected ? 20 : 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:active': { cursor: editMode ? 'grabbing' : 'pointer' },
                  }}
                >
                  {/* Chest bubble */}
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: isSelected ? 'rgba(200,164,74,0.9)' : 'rgba(11,9,6,0.85)',
                      border: `2px solid ${isSelected ? '#fff' : '#c8a44a'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelected
                        ? '0 0 0 3px rgba(200,164,74,0.4), 0 2px 8px rgba(0,0,0,0.6)'
                        : '0 2px 8px rgba(0,0,0,0.6)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <ChestSvg size={20} />
                  </Box>

                  {/* Label + item count */}
                  <Box sx={{
                    bgcolor: 'rgba(11,9,6,0.85)',
                    border: '1px solid rgba(200,164,74,0.3)',
                    borderRadius: 0.75,
                    px: 0.75,
                    py: 0.25,
                    maxWidth: 120,
                    textAlign: 'center',
                  }}>
                    {m.label && (
                      <Typography sx={{ fontSize: '0.6rem', color: '#e6d8c0', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.label}
                      </Typography>
                    )}
                    {m.itemIds.length > 0 && (
                      <Typography sx={{ fontSize: '0.58rem', color: '#c8a44a', lineHeight: 1.3 }}>
                        {m.itemIds.length} item{m.itemIds.length !== 1 ? 's' : ''}
                      </Typography>
                    )}
                    {!m.label && m.itemIds.length === 0 && (
                      <Typography sx={{ fontSize: '0.58rem', color: '#4a4035', lineHeight: 1.3 }}>empty</Typography>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Info drawer — view mode, marker selected */}
        {!editMode && selected && (
          <Box
            sx={{
              // Desktop: right column
              width: { xs: '100%', sm: 280 },
              flexShrink: 0,
              borderLeft: { xs: 'none', sm: '1px solid rgba(120,108,92,0.2)' },
              borderTop: { xs: '1px solid rgba(120,108,92,0.2)', sm: 'none' },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              bgcolor: '#0f0d0a',
              // Mobile: bottom sheet overlaying the map
              ...(isMobile ? {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: '45%',
                zIndex: 30,
                boxShadow: '0 -4px 24px rgba(0,0,0,0.7)',
                borderRadius: '12px 12px 0 0',
              } : {}),
            }}
          >
            {isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pt: 1, pb: 0.5, position: 'relative' }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'rgba(120,108,92,0.4)' }} />
                <IconButton size="small" onClick={() => setSelectedId(null)} sx={{ position: 'absolute', right: 4, top: 0, color: '#786c5c', '&:hover': { color: '#e6d8c0' } }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            )}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(120,108,92,0.15)' }}>
              <Typography sx={{ fontSize: '0.62rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, fontFamily: '"JetBrains Mono"' }}>
                Loot marker
              </Typography>
              <Typography sx={{ fontSize: '1rem', color: '#e6d8c0', mt: 0.25, fontWeight: 600 }}>
                {selected.label || 'Unnamed chest'}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {selected.items.length === 0 ? (
                <Typography sx={{ fontSize: '0.78rem', color: '#4a4035', fontStyle: 'italic' }}>
                  No items assigned to this marker.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {selected.items.map((item) => (
                    <Box key={item.id} sx={{ px: 1.25, py: 0.75, borderRadius: 1, bgcolor: 'rgba(120,108,92,0.08)', border: '1px solid rgba(120,108,92,0.15)' }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#c8a44a', fontWeight: 500 }}>{item.name}</Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.6, mt: 0.25 }}>{item.type}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Edit drawer — edit mode */}
        {editMode && (
          <Box
            sx={{
              width: { xs: '100%', sm: 300 },
              flexShrink: 0,
              borderLeft: { xs: 'none', sm: '1px solid rgba(120,108,92,0.2)' },
              borderTop: { xs: '1px solid rgba(120,108,92,0.2)', sm: 'none' },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              bgcolor: '#0f0d0a',
              ...(isMobile ? {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: selected ? '55%' : '30%',
                zIndex: 30,
                boxShadow: '0 -4px 24px rgba(0,0,0,0.7)',
                borderRadius: '12px 12px 0 0',
              } : {}),
            }}
          >
            {isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pt: 1, pb: 0.5, position: 'relative' }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'rgba(120,108,92,0.4)' }} />
                {selected && (
                  <IconButton size="small" onClick={() => setSelectedId(null)} sx={{ position: 'absolute', right: 4, top: 0, color: '#786c5c', '&:hover': { color: '#e6d8c0' } }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            )}
            {!selected ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
                <Typography sx={{ color: '#4a4035', fontSize: '0.8rem', textAlign: 'center' }}>
                  Click a marker to edit its loot, or click anywhere on the map to place a new one.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Label */}
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75, fontFamily: '"JetBrains Mono"' }}>
                    Label
                  </Typography>
                  {editingLabel ? (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <TextField
                        size="small"
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        placeholder="e.g. Boss chest, Secret room…"
                        autoFocus
                        fullWidth
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLabel(); if (e.key === 'Escape') setEditingLabel(false) }}
                        onBlur={handleSaveLabel}
                        sx={{ '& .MuiInputBase-root': { fontSize: '0.82rem' } }}
                      />
                      <IconButton size="small" onClick={handleSaveLabel} sx={{ color: '#62a870' }}>✓</IconButton>
                    </Box>
                  ) : (
                    <Box
                      onClick={() => { setEditingLabel(true); setLabelDraft(selected.label ?? '') }}
                      sx={{ cursor: 'text', py: 0.5, px: 0.75, borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)', '&:hover': { borderColor: 'rgba(200,164,74,0.3)' } }}
                    >
                      <Typography sx={{ fontSize: '0.82rem', color: selected.label ? '#e6d8c0' : '#4a4035' }}>
                        {selected.label || 'Click to add label…'}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)' }} />

                {/* Assigned items */}
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75, fontFamily: '"JetBrains Mono"' }}>
                    Loot ({selected.items.length})
                  </Typography>
                  {selected.items.length === 0 ? (
                    <Typography sx={{ fontSize: '0.75rem', color: '#4a4035' }}>No items assigned yet.</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {selected.items.map((item) => (
                        <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1, bgcolor: 'rgba(120,108,92,0.08)', border: '1px solid rgba(120,108,92,0.15)' }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</Typography>
                            <Typography sx={{ fontSize: '0.62rem', color: '#786c5c' }}>{item.type}</Typography>
                          </Box>
                          <IconButton size="small" onClick={() => handleRemoveItem(item.id)}
                            sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, p: 0.25 }}>
                            <CloseIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>

                <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)' }} />

                {/* Search existing items */}
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75, fontFamily: '"JetBrains Mono"' }}>
                    Add existing item
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search items…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 15, color: '#786c5c', mr: 0.5 }} /> }}
                    sx={{ mb: 0.75, '& .MuiInputBase-root': { fontSize: '0.78rem' } }}
                  />
                  <Box sx={{ maxHeight: 180, overflow: 'auto', border: '1px solid rgba(120,108,92,0.2)', borderRadius: 1, bgcolor: '#0b0906' }}>
                    {filteredItems.length === 0 ? (
                      <Typography sx={{ px: 1.5, py: 1, fontSize: '0.72rem', color: '#4a4035' }}>
                        {search ? 'No matches.' : allItems.filter((i) => !assignedIds.has(i.id)).length === 0 ? 'All items assigned.' : 'Type to search…'}
                      </Typography>
                    ) : filteredItems.slice(0, 30).map((item) => (
                      <Box key={item.id} onClick={() => handleAddItem(item)}
                        sx={{ px: 1.5, py: 0.6, cursor: 'pointer', borderBottom: '1px solid rgba(120,108,92,0.1)', '&:hover': { bgcolor: 'rgba(200,164,74,0.08)' } }}>
                        <Typography sx={{ fontSize: '0.78rem', color: '#b4a48a' }}>{item.name}</Typography>
                        <Typography sx={{ fontSize: '0.62rem', color: '#786c5c' }}>{item.type}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)' }} />

                {/* Quick create item */}
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75, fontFamily: '"JetBrains Mono"' }}>
                    Create new item
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <TextField
                      size="small"
                      placeholder="Item name…"
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCreate() }}
                      fullWidth
                      sx={{ '& .MuiInputBase-root': { fontSize: '0.78rem' } }}
                    />
                    <IconButton
                      size="small"
                      onClick={handleQuickCreate}
                      disabled={!quickName.trim() || creating}
                      sx={{ bgcolor: 'rgba(200,164,74,0.15)', color: '#c8a44a', borderRadius: 1, px: 1, '&:hover': { bgcolor: 'rgba(200,164,74,0.25)' }, '&:disabled': { color: '#4a4035' } }}
                    >
                      {creating ? <CircularProgress size={14} sx={{ color: '#c8a44a' }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </Box>
                  <Typography sx={{ fontSize: '0.62rem', color: '#4a4035', mt: 0.5 }}>
                    Creates an ITEM type and links it here. Edit details in the Items page.
                  </Typography>
                </Box>

                {/* Delete marker */}
                <Box sx={{ mt: 'auto', pt: 1 }}>
                  <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)', mb: 1.5 }} />
                  <Button
                    size="small"
                    startIcon={<DeleteIcon sx={{ fontSize: 13 }} />}
                    onClick={handleDeleteMarker}
                    fullWidth
                    sx={{ fontSize: '0.72rem', color: '#b84848', borderColor: 'rgba(184,72,72,0.3)', border: '1px solid', '&:hover': { bgcolor: 'rgba(184,72,72,0.08)', borderColor: '#b84848' } }}
                  >
                    Remove marker
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Dialog>
  )
}
