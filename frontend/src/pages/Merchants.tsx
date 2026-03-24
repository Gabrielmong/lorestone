import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Button, IconButton, Tooltip, CircularProgress, Alert,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Chip, Divider,
  Collapse,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import RefreshIcon from '@mui/icons-material/Refresh'
import RemoveIcon from '@mui/icons-material/Remove'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useCampaign } from '../context/campaign'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

// ── GraphQL ───────────────────────────────────────────────────────────────────

const MERCHANTS = gql`
  query Merchants($campaignId: ID!) {
    merchants(campaignId: $campaignId) {
      id name type region description
      wares { id name category description price stock maxStock rarity available haggleCD notes }
    }
  }
`
const CREATE_MERCHANT = gql`
  mutation CreateMerchant($input: CreateMerchantInput!) {
    createMerchant(input: $input) { id name type region description wares { id } }
  }
`
const UPDATE_MERCHANT = gql`
  mutation UpdateMerchant($id: ID!, $input: UpdateMerchantInput!) {
    updateMerchant(id: $id, input: $input) { id name type region description }
  }
`
const DELETE_MERCHANT = gql`
  mutation DeleteMerchant($id: ID!) { deleteMerchant(id: $id) }
`
const CREATE_WARE = gql`
  mutation CreateWare($input: CreateWareInput!) {
    createWare(input: $input) { id name category price stock maxStock rarity available haggleCD notes }
  }
`
const UPDATE_WARE = gql`
  mutation UpdateWare($id: ID!, $input: UpdateWareInput!) {
    updateWare(id: $id, input: $input) { id name category price stock maxStock rarity available haggleCD notes }
  }
`
const DELETE_WARE = gql`
  mutation DeleteWare($id: ID!) { deleteWare(id: $id) }
`
const SELL_WARE = gql`
  mutation SellWare($id: ID!) { sellWare(id: $id) { id stock } }
`
const RESTOCK = gql`
  mutation RestockMerchant($id: ID!) {
    restockMerchant(id: $id) { id wares { id stock } }
  }
`
const DUPLICATE_MERCHANT = gql`
  mutation DuplicateMerchant($id: ID!) {
    duplicateMerchant(id: $id) { id name type region description wares { id } }
  }
`

// ── Types ─────────────────────────────────────────────────────────────────────

type Ware = {
  id: string; name: string; category: string; description?: string | null
  price: number; stock: number; maxStock: number; rarity?: string | null
  available: boolean; haggleCD?: number | null; notes?: string | null
}
type Merchant = {
  id: string; name: string; type: string; region: string; description?: string | null
  wares: Ware[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MERCHANT_TYPES = ['general', 'blacksmith', 'apothecary', 'tavern', 'magic shop', 'fletcher', 'jeweler', 'stable', 'shipwright', 'other']
const CATEGORIES = ['armor', 'weapon', 'munition', 'food', 'component', 'magic item', 'tool', 'clothing', 'mount', 'misc','service', 'material', 'lodging']
const RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary']

const CATEGORY_COLORS: Record<string, string> = {
  armor: '#6ea8d4', weapon: '#c87050', food: '#62a870',
  component: '#a862a8', 'magic item': '#c8a44a', tool: '#786c5c',
  clothing: '#a8c862', mount: '#d47c50', misc: '#5c6a78',
  service: '#4a4235', material: '#6ea8d4', munition: '#c87050',
  lodging: '#786c5c'  
}

function formatPrice(gp: number) {
  if (gp === 0) return 'free'
  if (Number.isInteger(gp)) return `${gp} gp`
  const totalSp = Math.round(gp * 10)
  const gpPart = Math.floor(totalSp / 10)
  const spPart = totalSp % 10
  if (gpPart > 0 && spPart > 0) return `${gpPart} gp ${spPart} sp`
  if (gpPart > 0) return `${gpPart} gp`
  return `${spPart} sp`
}

function stockColor(stock: number, available: boolean) {
  if (!available) return '#4a4235'
  if (stock === -1) return '#62a870'
  if (stock === 0) return '#b84848'
  if (stock <= 2) return '#c8a44a'
  return '#62a870'
}

function stockLabel(stock: number) {
  if (stock === -1) return '∞'
  return String(stock)
}

// ── Ware Form Dialog ──────────────────────────────────────────────────────────

type WareFormProps = {
  open: boolean
  merchantId: string
  initial?: Ware | null
  onClose: () => void
  onSaved: () => void
}

export function WareFormDialog({ open, merchantId, initial, onClose, onSaved }: WareFormProps) {
  const blank = { name: '', category: 'misc', description: '', price: 0, stock: -1, maxStock: -1, rarity: '', available: true, haggleCD: '', notes: '' }
  const [form, setForm] = useState(blank)
  const [createWare] = useMutation(CREATE_WARE)
  const [updateWare] = useMutation(UPDATE_WARE)

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const handleOpen = () => {
    if (initial) {
      setForm({
        name: initial.name, category: initial.category, description: initial.description ?? '',
        price: initial.price, stock: initial.stock, maxStock: initial.maxStock,
        rarity: initial.rarity ?? '', available: initial.available,
        haggleCD: initial.haggleCD != null ? String(initial.haggleCD) : '',
        notes: initial.notes ?? '',
      })
    } else {
      setForm(blank)
    }
  }

  const handleSave = async () => {
    const input = {
      name: form.name.trim(),
      category: form.category,
      description: form.description || undefined,
      price: Number(form.price),
      stock: Number(form.stock),
      maxStock: Number(form.maxStock) === -1 ? Number(form.stock) : Number(form.maxStock),
      rarity: form.rarity || undefined,
      available: form.available,
      haggleCD: form.haggleCD !== '' ? Number(form.haggleCD) : undefined,
      notes: form.notes || undefined,
    }
    if (initial) {
      await updateWare({ variables: { id: initial.id, input } })
    } else {
      await createWare({ variables: { input: { merchantId, ...input } } })
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} TransitionProps={{ onEnter: handleOpen }}
      PaperProps={{ sx: { bgcolor: '#111009', border: '1px solid rgba(200,164,74,0.2)', minWidth: 380 } }}>
      <DialogTitle sx={{ fontFamily: '"Cinzel"', fontSize: '1rem', color: '#c8a44a' }}>
        {initial ? 'Edit Ware' : 'Add Ware'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <TextField label="Name" size="small" value={form.name} onChange={(e) => set('name', e.target.value)} fullWidth />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Category</InputLabel>
            <Select label="Category" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Rarity</InputLabel>
            <Select label="Rarity" value={form.rarity} onChange={(e) => set('rarity', e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {RARITIES.map((r) => <MenuItem key={r} value={r} sx={{ textTransform: 'capitalize' }}>{r}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <TextField label="Description" size="small" value={form.description}
          onChange={(e) => set('description', e.target.value)} multiline minRows={2} fullWidth />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField label="Price (gp)" size="small" type="number" value={form.price}
            onChange={(e) => set('price', e.target.value)} sx={{ flex: 1 }}
            helperText="0.5 = 5sp, 0.1 = 1sp" />
          <TextField label="Stock (-1 = ∞)" size="small" type="number" value={form.stock}
            onChange={(e) => set('stock', e.target.value)} sx={{ flex: 1 }} />
          <TextField label="Max Stock" size="small" type="number" value={form.maxStock}
            onChange={(e) => set('maxStock', e.target.value)} sx={{ flex: 1 }}
            helperText="For restock" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField label="Haggle DC" size="small" type="number" value={form.haggleCD}
            onChange={(e) => set('haggleCD', e.target.value)} sx={{ flex: 1 }}
            helperText="Optional" />
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Available</InputLabel>
            <Select label="Available" value={form.available ? 'yes' : 'no'}
              onChange={(e) => set('available', e.target.value === 'yes')}>
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No (hidden)</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <TextField label="DM Notes" size="small" value={form.notes}
          onChange={(e) => set('notes', e.target.value)} multiline minRows={1} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!form.name.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Merchant Form Dialog ──────────────────────────────────────────────────────

type MerchantFormProps = {
  open: boolean; campaignId: string; initial?: Merchant | null
  onClose: () => void; onSaved: () => void
}

export function MerchantFormDialog({ open, campaignId, initial, onClose, onSaved }: MerchantFormProps) {
  const blank = { name: '', type: 'general', region: '', description: '' }
  const [form, setForm] = useState(blank)
  const [createMerchant] = useMutation(CREATE_MERCHANT)
  const [updateMerchant] = useMutation(UPDATE_MERCHANT)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleOpen = () => {
    setForm(initial
      ? { name: initial.name, type: initial.type, region: initial.region, description: initial.description ?? '' }
      : blank)
  }

  const handleSave = async () => {
    const input = { name: form.name.trim(), type: form.type, region: form.region.trim(), description: form.description || undefined }
    if (initial) await updateMerchant({ variables: { id: initial.id, input } })
    else await createMerchant({ variables: { input: { campaignId, ...input } } })
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} TransitionProps={{ onEnter: handleOpen }}
      PaperProps={{ sx: { bgcolor: '#111009', border: '1px solid rgba(200,164,74,0.2)', minWidth: 340 } }}>
      <DialogTitle sx={{ fontFamily: '"Cinzel"', fontSize: '1rem', color: '#c8a44a' }}>
        {initial ? 'Edit Merchant' : 'New Merchant'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <TextField label="Name" size="small" value={form.name} onChange={(e) => set('name', e.target.value)} fullWidth />
        <TextField label="Region" size="small" value={form.region} onChange={(e) => set('region', e.target.value)} fullWidth
          helperText="e.g. Woodhall, Khardûm" />
        <FormControl size="small" fullWidth>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={form.type} onChange={(e) => set('type', e.target.value)}>
            {MERCHANT_TYPES.map((t) => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="Description" size="small" value={form.description}
          onChange={(e) => set('description', e.target.value)} multiline minRows={2} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!form.name.trim() || !form.region.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Merchant Panel ────────────────────────────────────────────────────────────

function MerchantPanel({ merchant, onEdit, onDelete, onRefetch }: {
  merchant: Merchant
  onEdit: () => void
  onDelete: () => void
  onRefetch: () => void
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [wareForm, setWareForm] = useState(false)
  const [editWare, setEditWare] = useState<Ware | null>(null)
  const [deleteWareId, setDeleteWareId] = useState<string | null>(null)
  const [deleteWareName, setDeleteWareName] = useState('')

  const [sellWare] = useMutation(SELL_WARE)
  const [deleteWare, { loading: deletingWare }] = useMutation(DELETE_WARE)
  const [restock] = useMutation(RESTOCK)
  const [duplicate] = useMutation(DUPLICATE_MERCHANT)

  const handleSell = async (wareId: string) => {
    await sellWare({ variables: { id: wareId } })
    onRefetch()
  }
  const handleRestock = async () => {
    await restock({ variables: { id: merchant.id } })
    onRefetch()
  }
  const handleDuplicate = async () => {
    await duplicate({ variables: { id: merchant.id } })
    onRefetch()
  }
  const handleDeleteWare = async () => {
    if (!deleteWareId) return
    await deleteWare({ variables: { id: deleteWareId } })
    setDeleteWareId(null)
    onRefetch()
  }

  // Group wares by category
  const waresByCategory = useMemo(() => {
    const map = new Map<string, Ware[]>()
    merchant.wares.forEach((w) => {
      const arr = map.get(w.category) ?? []
      arr.push(w)
      map.set(w.category, arr)
    })
    return map
  }, [merchant.wares])

  const outOfStock = merchant.wares.filter((w) => w.stock === 0 && w.available).length
  const unavailable = merchant.wares.filter((w) => !w.available).length

  return (
    <Box sx={{ bgcolor: '#0d0b07', border: '1px solid rgba(120,108,92,0.25)', borderRadius: 1, mb: 1.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1, gap: 1 }}>
        <StorefrontIcon sx={{ fontSize: 15, color: '#786c5c', flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            onClick={() => navigate(`/merchants/${merchant.id}`)}
            sx={{ fontFamily: '"Cinzel"', fontSize: '0.9rem', color: '#c8a44a', lineHeight: 1.2, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            {merchant.name}
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: '#786c5c', textTransform: 'capitalize' }}>
            {merchant.type} · {merchant.wares.length} wares
            {outOfStock > 0 && <Box component="span" sx={{ color: '#b84848', ml: 0.75 }}>· {outOfStock} out of stock</Box>}
            {unavailable > 0 && <Box component="span" sx={{ color: '#4a4235', ml: 0.75 }}>· {unavailable} unavailable</Box>}
          </Typography>
        </Box>
        <Tooltip title="Restock all">
          <IconButton size="small" onClick={handleRestock}
            sx={{ color: '#786c5c', '&:hover': { color: '#62a870' }, p: 0.4 }}>
            <RefreshIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add ware">
          <IconButton size="small" onClick={() => { setEditWare(null); setWareForm(true) }}
            sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.4 }}>
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Duplicate merchant">
          <IconButton size="small" onClick={handleDuplicate}
            sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.4 }}>
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit merchant">
          <IconButton size="small" onClick={onEdit}
            sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.4 }}>
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete merchant">
          <IconButton size="small" onClick={onDelete}
            sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, p: 0.4 }}>
            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={() => setExpanded((v) => !v)}
          sx={{ color: '#786c5c', p: 0.4 }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Box>

      {/* Wares */}
      <Collapse in={expanded}>
        {merchant.wares.length === 0 ? (
          <Typography sx={{ px: 2, pb: 1.5, fontSize: '0.72rem', color: '#4a4235', fontStyle: 'italic' }}>
            No wares yet — click + to add.
          </Typography>
        ) : (
          <Box sx={{ px: 1.5, pb: 1.5 }}>
            {[...waresByCategory.entries()].map(([cat, wares]) => (
              <Box key={cat} sx={{ mb: 1 }}>
                <Typography sx={{
                  fontSize: '0.65rem', fontFamily: '"Cinzel"', letterSpacing: 1, textTransform: 'uppercase',
                  color: CATEGORY_COLORS[cat] ?? '#786c5c', mb: 0.5,
                }}>
                  {cat}
                </Typography>
                {wares.map((ware) => (
                  <Box key={ware.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75, py: 0.35,
                    borderBottom: '1px solid rgba(120,108,92,0.08)',
                    opacity: ware.available ? 1 : 0.45,
                  }}>
                    {/* Stock badge */}
                    <Box sx={{
                      minWidth: 28, textAlign: 'center', fontSize: '0.7rem', fontFamily: '"JetBrains Mono"',
                      color: stockColor(ware.stock, ware.available),
                      border: `1px solid ${stockColor(ware.stock, ware.available)}44`,
                      borderRadius: 0.5, px: 0.4, lineHeight: '18px', flexShrink: 0,
                    }}>
                      {stockLabel(ware.stock)}
                    </Box>
                    {/* Name + rarity */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: ware.available ? '#b4a48a' : '#786c5c',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ware.name}
                        {ware.rarity && (
                          <Box component="span" sx={{ ml: 0.75, fontSize: '0.62rem', color: '#786c5c', textTransform: 'capitalize' }}>
                            ({ware.rarity})
                          </Box>
                        )}
                      </Typography>
                      {ware.haggleCD != null && (
                        <Typography sx={{ fontSize: '0.62rem', color: '#786c5c' }}>
                          Haggle DC {ware.haggleCD}
                        </Typography>
                      )}
                    </Box>
                    {/* Price */}
                    <Typography sx={{ fontSize: '0.75rem', color: '#c8a44a', fontFamily: '"JetBrains Mono"', flexShrink: 0 }}>
                      {formatPrice(ware.price)}
                    </Typography>
                    {/* Sell -1 */}
                    {ware.stock !== -1 && ware.available && (
                      <Tooltip title="Sold 1">
                        <IconButton size="small" onClick={() => handleSell(ware.id)}
                          disabled={ware.stock === 0}
                          sx={{ color: '#786c5c', '&:hover': { color: '#c87050' }, p: 0.25 }}>
                          <RemoveIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => { setEditWare(ware); setWareForm(true) }}
                        sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, p: 0.25 }}>
                        <EditIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => { setDeleteWareId(ware.id); setDeleteWareName(ware.name) }}
                        sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, p: 0.25 }}>
                        <DeleteOutlineIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        )}
      </Collapse>

      {/* Ware form */}
      <WareFormDialog
        open={wareForm} merchantId={merchant.id} initial={editWare}
        onClose={() => setWareForm(false)} onSaved={onRefetch}
      />
      <ConfirmDeleteDialog
        open={!!deleteWareId} title={deleteWareName} loading={deletingWare}
        onClose={() => setDeleteWareId(null)} onConfirm={handleDeleteWare}
      />
    </Box>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Merchants() {
  const { campaignId } = useCampaign()
  const [merchantForm, setMerchantForm] = useState(false)
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [regionFilter, setRegionFilter] = useState<string | null>(null)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const { data, loading, error, refetch } = useQuery(MERCHANTS, {
    variables: { campaignId }, skip: !campaignId,
  })
  const [deleteMerchant, { loading: deleting }] = useMutation(DELETE_MERCHANT)

  const merchants: Merchant[] = data?.merchants ?? []

  const regions = useMemo(() => {
    const set = new Set(merchants.map((m) => m.region))
    return [...set].sort()
  }, [merchants])

  const filtered = regionFilter ? merchants.filter((m) => m.region === regionFilter) : merchants

  // Group by region
  const byRegion = useMemo(() => {
    const map = new Map<string, Merchant[]>()
    filtered.forEach((m) => {
      const arr = map.get(m.region) ?? []
      arr.push(m)
      map.set(m.region, arr)
    })
    return map
  }, [filtered])

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteMerchant({ variables: { id: deleteId } })
    setDeleteId(null)
    refetch()
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: isMobile ? 1 : 0 }}>
      {/* Page header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography variant="h4">Merchants</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />}
          onClick={() => { setEditMerchant(null); setMerchantForm(true) }}>
            {isMobile ? 'New' : 'New Merchant'}
        </Button>
      </Box>

      {/* Region filter chips */}
      {regions.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.5 }}>
          <Chip label="All" size="small" onClick={() => setRegionFilter(null)}
            sx={{
              bgcolor: !regionFilter ? 'rgba(200,164,74,0.15)' : 'transparent',
              border: '1px solid', borderColor: !regionFilter ? 'rgba(200,164,74,0.5)' : 'rgba(120,108,92,0.3)',
              color: !regionFilter ? '#c8a44a' : '#786c5c',
            }} />
          {regions.map((r) => (
            <Chip key={r} label={r} size="small" onClick={() => setRegionFilter(r === regionFilter ? null : r)}
              sx={{
                bgcolor: regionFilter === r ? 'rgba(200,164,74,0.15)' : 'transparent',
                border: '1px solid', borderColor: regionFilter === r ? 'rgba(200,164,74,0.5)' : 'rgba(120,108,92,0.3)',
                color: regionFilter === r ? '#c8a44a' : '#786c5c',
              }} />
          ))}
        </Box>
      )}

      {merchants.length === 0 ? (
        <Box sx={{ textAlign: 'center', pt: 8 }}>
          <StorefrontIcon sx={{ fontSize: 40, color: '#4a4235', mb: 1 }} />
          <Typography sx={{ color: '#786c5c' }}>No merchants yet.</Typography>
          <Typography sx={{ color: '#4a4235', fontSize: '0.8rem', mt: 0.5 }}>
            Create storefronts for your towns, taverns, and traders.
          </Typography>
        </Box>
      ) : (
        [...byRegion.entries()].map(([region, regionMerchants]) => (
          <Box key={region} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontFamily: '"Cinzel"', fontSize: '0.75rem', color: '#c8a44a', letterSpacing: 1, textTransform: 'uppercase' }}>
                {region}
              </Typography>
              <Divider sx={{ flex: 1, borderColor: 'rgba(200,164,74,0.15)' }} />
              <Typography sx={{ fontSize: '0.65rem', color: '#4a4235' }}>{regionMerchants.length} merchants</Typography>
            </Box>
            {regionMerchants.map((m) => (
              <MerchantPanel
                key={m.id} merchant={m}
                onEdit={() => { setEditMerchant(m); setMerchantForm(true) }}
                onDelete={() => { setDeleteId(m.id); setDeleteName(m.name) }}
                onRefetch={() => refetch()}
              />
            ))}
          </Box>
        ))
      )}

      <MerchantFormDialog
        open={merchantForm} campaignId={campaignId!} initial={editMerchant}
        onClose={() => setMerchantForm(false)} onSaved={() => refetch()}
      />
      <ConfirmDeleteDialog
        open={!!deleteId} title={`Delete ${deleteName}?`} loading={deleting}
        onClose={() => setDeleteId(null)} onConfirm={handleDelete}
      />
    </Box>
  )
}
