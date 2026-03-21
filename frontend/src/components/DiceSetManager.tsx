import { useState, useRef, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, IconButton, TextField,
  Select, MenuItem, FormControl, InputLabel, Divider,
  Tooltip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  useDiceStore, PRESETS, MATERIAL_OPTIONS, SURFACE_OPTIONS, TEXTURE_OPTIONS,
  type DiceSet,
} from '../store/dice'

const MY_DICE_SETS = gql`
  query MyDiceSets { myDiceSets { id name colorset customBg customFg material surface texture } }
`
const SAVE_DICE_SET = gql`
  mutation SaveDiceSet($id: ID, $input: SaveDiceSetInput!) {
    saveDiceSet(id: $id, input: $input) { id name colorset customBg customFg material surface texture }
  }
`
const DELETE_DICE_SET = gql`
  mutation DeleteDiceSet($id: ID!) { deleteDiceSet(id: $id) }
`

const DEFAULT_NEW_SET: Omit<DiceSet, 'id' | 'isPreset'> = {
  name: '',
  colorset: '',
  customBg: '#8b0000',
  customFg: '#f5e6c8',
  material: 'metal',
  surface: 'green-felt',
  texture: '',
}

function SetPreview({ set }: { set: DiceSet }) {
  return (
    <Box sx={{
      width: 36, height: 36, borderRadius: 1,
      background: `linear-gradient(135deg, ${set.colorset ? '#c8a44a' : set.customBg}, ${set.colorset ? '#786c5c' : set.customFg})`,
      border: '1px solid rgba(120,108,92,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.6rem', color: set.colorset ? '#0b0906' : set.customFg }}>
        d20
      </Typography>
    </Box>
  )
}

interface SetFormProps {
  initial: Omit<DiceSet, 'id' | 'isPreset'>
  onSave: (data: Omit<DiceSet, 'id' | 'isPreset'>) => void
  onCancel: () => void
}

function SetForm({ initial, onSave, onCancel }: SetFormProps) {
  const [form, setForm] = useState(initial)
  const upd = (key: keyof typeof form, val: unknown) => setForm((f) => ({ ...f, [key]: val }))

  // Color inputs use defaultValue (uncontrolled) to avoid the infinite re-render
  // loop caused by React repositioning the browser's color picker ring on every render.
  // We track display value separately in local state.
  const bgHexRef = useRef<HTMLSpanElement>(null)
  const fgHexRef = useRef<HTMLSpanElement>(null)
  const bgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (bgHexRef.current) bgHexRef.current.textContent = val
    if (bgTimer.current) clearTimeout(bgTimer.current)
    bgTimer.current = setTimeout(() => setForm((f) => ({ ...f, customBg: val, colorset: '' })), 150)
  }

  const handleFgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (fgHexRef.current) fgHexRef.current.textContent = val
    if (fgTimer.current) clearTimeout(fgTimer.current)
    fgTimer.current = setTimeout(() => setForm((f) => ({ ...f, customFg: val, colorset: '' })), 150)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Name" size="small" fullWidth value={form.name}
        onChange={(e) => upd('name', e.target.value)}
        inputProps={{ maxLength: 24 }}
      />

      {/* Color pickers — uncontrolled (defaultValue) to prevent infinite loop */}
      <Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#786c5c', mb: 1 }}>Die Colors</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', mb: 0.5 }}>Background</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="color"
                defaultValue={initial.customBg}
                onChange={handleBgChange}
                style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              <span ref={bgHexRef} style={{ fontFamily: '"JetBrains Mono"', fontSize: '0.7rem', color: '#786c5c' }}>
                {initial.customBg}
              </span>
            </Box>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', mb: 0.5 }}>Numbers</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="color"
                defaultValue={initial.customFg}
                onChange={handleFgChange}
                style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              <span ref={fgHexRef} style={{ fontFamily: '"JetBrains Mono"', fontSize: '0.7rem', color: '#786c5c' }}>
                {initial.customFg}
              </span>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Material</InputLabel>
          <Select label="Material" value={form.material} onChange={(e) => upd('material', e.target.value)}
            MenuProps={{ sx: { zIndex: 1600 } }}>
            {MATERIAL_OPTIONS.map((m) => (
              <MenuItem key={m} value={m} sx={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{m}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Surface</InputLabel>
          <Select label="Surface" value={form.surface} onChange={(e) => upd('surface', e.target.value as DiceSet['surface'])}
            MenuProps={{ sx: { zIndex: 1600 } }}>
            {SURFACE_OPTIONS.map((s) => (
              <MenuItem key={s.value} value={s.value} sx={{ fontSize: '0.85rem' }}>{s.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <FormControl size="small" fullWidth>
        <InputLabel>Texture</InputLabel>
        <Select label="Texture" value={form.texture} onChange={(e) => upd('texture', e.target.value)}
          MenuProps={{ sx: { zIndex: 1600 } }}>
          {TEXTURE_OPTIONS.map((t) => (
            <MenuItem key={t.value} value={t.value} sx={{ fontSize: '0.85rem' }}>{t.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button
          size="small" variant="contained"
          disabled={!form.name.trim()}
          onClick={() => onSave(form)}
          sx={{ bgcolor: '#c8a44a', color: '#0b0906', '&:hover': { bgcolor: '#d4b05a' } }}
        >
          Save
        </Button>
      </Box>
    </Box>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  /** When true, skip backend sync — sets are stored only in localStorage */
  localOnly?: boolean
}

export default function DiceSetManager({ open, onClose, localOnly = false }: Props) {
  const {
    activeDiceSetId, customSets, setActiveDiceSet,
    addCustomSet, updateCustomSet, deleteCustomSet,
  } = useDiceStore()

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: remoteData } = useQuery(MY_DICE_SETS, { skip: localOnly || !open, fetchPolicy: 'network-only' })
  const [saveDiceSet] = useMutation(SAVE_DICE_SET)
  const [deleteDiceSetMutation] = useMutation(DELETE_DICE_SET)

  // Sync remote sets into local store whenever we load them (skipped in localOnly mode)
  useEffect(() => {
    if (!remoteData?.myDiceSets) return
    const remote: DiceSet[] = remoteData.myDiceSets.map((s: DiceSet) => ({ ...s, isPreset: false }))
    // Replace custom sets with remote, preserving order
    const store = useDiceStore.getState()
    remote.forEach((s) => {
      if (store.customSets.find((c) => c.id === s.id)) {
        store.updateCustomSet(s)
      } else {
        store.addCustomSet(s)
      }
    })
    // Remove local sets that no longer exist on backend
    store.customSets
      .filter((c) => !remote.find((r) => r.id === c.id))
      .forEach((c) => store.deleteCustomSet(c.id))
  }, [remoteData])

  const handleCreate = async (data: Omit<DiceSet, 'id' | 'isPreset'>) => {
    if (localOnly) {
      const saved: DiceSet = { ...data, id: crypto.randomUUID(), isPreset: false }
      addCustomSet(saved)
      setActiveDiceSet(saved.id)
    } else {
      const res = await saveDiceSet({ variables: { input: data } })
      const saved: DiceSet = { ...res.data.saveDiceSet, isPreset: false }
      addCustomSet(saved)
      setActiveDiceSet(saved.id)
    }
    setCreating(false)
  }

  const handleUpdate = async (id: string, data: Omit<DiceSet, 'id' | 'isPreset'>) => {
    if (!localOnly) await saveDiceSet({ variables: { id, input: data } })
    updateCustomSet({ ...data, id })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!localOnly) await deleteDiceSetMutation({ variables: { id } })
    deleteCustomSet(id)
    if (activeDiceSetId === id) setActiveDiceSet('classic')
  }

  const allPresets = PRESETS

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      sx={{ zIndex: 1500 }}
      PaperProps={{ sx: { bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.3)' } }}>
      <DialogTitle sx={{ fontFamily: '"Cinzel", serif', color: '#c8a44a', fontSize: '1rem', pb: 1 }}>
        Dice Sets
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {/* Presets */}
        <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
          Presets
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
          {allPresets.map((s) => (
            <Box key={s.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              p: 1, borderRadius: 1,
              bgcolor: activeDiceSetId === s.id ? 'rgba(200,164,74,0.08)' : 'transparent',
              border: activeDiceSetId === s.id ? '1px solid rgba(200,164,74,0.3)' : '1px solid transparent',
              cursor: 'pointer', '&:hover': { bgcolor: 'rgba(200,164,74,0.06)' },
            }} onClick={() => setActiveDiceSet(s.id)}>
              <SetPreview set={s} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.85rem', color: '#e6d8c0' }}>{s.name}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                  {s.surface} · {s.material}
                </Typography>
              </Box>
              {activeDiceSetId === s.id && <CheckIcon sx={{ fontSize: 16, color: '#c8a44a' }} />}
            </Box>
          ))}
        </Box>

        {/* Custom sets */}
        {customSets.length > 0 && (
          <>
            <Divider sx={{ mb: 1.5, borderColor: 'rgba(120,108,92,0.2)' }} />
            <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
              Custom
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
              {customSets.map((s) => (
                <Box key={s.id}>
                  {editingId === s.id ? (
                    <Box sx={{ p: 1, border: '1px solid rgba(200,164,74,0.3)', borderRadius: 1 }}>
                      <SetForm
                        initial={{ name: s.name, colorset: s.colorset, customBg: s.customBg, customFg: s.customFg, material: s.material, surface: s.surface, texture: s.texture }}
                        onSave={(data) => handleUpdate(s.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    </Box>
                  ) : (
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1, borderRadius: 1,
                      bgcolor: activeDiceSetId === s.id ? 'rgba(200,164,74,0.08)' : 'transparent',
                      border: activeDiceSetId === s.id ? '1px solid rgba(200,164,74,0.3)' : '1px solid transparent',
                      cursor: 'pointer', '&:hover': { bgcolor: 'rgba(200,164,74,0.06)' },
                    }} onClick={() => setActiveDiceSet(s.id)}>
                      <SetPreview set={s} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: '0.85rem', color: '#e6d8c0' }}>{s.name}</Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: '#786c5c', fontFamily: '"JetBrains Mono"' }}>
                          {s.surface} · {s.material}
                        </Typography>
                      </Box>
                      {activeDiceSetId === s.id && <CheckIcon sx={{ fontSize: 16, color: '#c8a44a' }} />}
                      <Box sx={{ display: 'flex', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setEditingId(s.id)}
                            sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 24, height: 24 }}>
                            <EditIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDelete(s.id)}
                            sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, width: 24, height: 24 }}>
                            <DeleteIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* Create new */}
        <Divider sx={{ mb: 1.5, borderColor: 'rgba(120,108,92,0.2)' }} />
        {creating ? (
          <SetForm
            initial={DEFAULT_NEW_SET}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <Button
            startIcon={<AddIcon />} size="small" fullWidth
            onClick={() => setCreating(true)}
            sx={{ color: '#c8a44a', borderColor: 'rgba(200,164,74,0.3)', border: '1px dashed' }}
          >
            New Dice Set
          </Button>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: '#786c5c' }}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
