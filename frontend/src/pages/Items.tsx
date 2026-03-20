import { useState } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Divider, CircularProgress, Alert,
  List, ListItem, ListItemText, IconButton, Chip, Tooltip, Button,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useCampaign } from '../context/campaign'
import RelicGrid from '../components/RelicGrid'
import StatusBadge from '../components/StatusBadge'
import ItemFormDialog from '../components/ItemFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

const ITEMS = gql`
  query Items($campaignId: ID!) {
    items(campaignId: $campaignId) {
      id name type description narrativeWeight locationFound requiredFor inPossession
      holder { id name }
    }
  }
`

const TOGGLE_POSSESSION = gql`
  mutation UpdateItemPossession($id: ID!, $inPossession: Boolean!) {
    updateItemPossession(id: $id, inPossession: $inPossession) { id inPossession }
  }
`

const DELETE_ITEM = gql`
  mutation DeleteItem($id: ID!) {
    deleteItem(id: $id)
  }
`

type ItemType = {
  id: string; name: string; type: string; description?: string | null
  narrativeWeight?: string | null; locationFound?: string | null; requiredFor?: string | null
  inPossession: boolean; holder?: { id: string; name: string } | null
}

export default function Items() {
  const { campaignId } = useCampaign()
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<ItemType | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const { data, loading, error, refetch } = useQuery(ITEMS, {
    variables: { campaignId },
    skip: !campaignId,
  })

  const [toggle] = useMutation(TOGGLE_POSSESSION)
  const [deleteItem, { loading: deleting }] = useMutation(DELETE_ITEM)

  const handleToggle = async (id: string, current: boolean) => {
    await toggle({ variables: { id, inPossession: !current } })
    refetch()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteItem({ variables: { id: deleteId } })
    setDeleteId(null)
    refetch()
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  const items = data?.items ?? []
  const CRITICAL_WEIGHTS = ['critical', 'high']
  const storyCritical = items.filter((i: ItemType) => CRITICAL_WEIGHTS.includes((i.narrativeWeight ?? '').toLowerCase()))
  const storyCriticalIds = new Set(storyCritical.map((i: ItemType) => i.id))
  const keyItems = items.filter((i: ItemType) => i.type === 'KEY_ITEM' && !storyCriticalIds.has(i.id))
  const other = items.filter((i: ItemType) => !['KEY_ITEM'].includes(i.type) && !storyCriticalIds.has(i.id))

  const ItemActions = ({ item }: { item: ItemType }) => (
    <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
      <Tooltip title="Edit">
        <IconButton size="small" onClick={() => { setEditItem(item); setFormOpen(true) }}
          sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' }, width: 26, height: 26 }}>
          <EditIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton size="small" onClick={() => { setDeleteId(item.id); setDeleteName(item.name) }}
          sx={{ color: '#786c5c', '&:hover': { color: '#b84848' }, width: 26, height: 26 }}>
          <DeleteIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Items & Relics</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />}
          onClick={() => { setEditItem(null); setFormOpen(true) }}>
          New Item
        </Button>
      </Box>

      {/* Story-Critical Items */}
      {storyCritical.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1.5, color: '#c8a44a' }}>Story-Critical Items</Typography>
          <RelicGrid items={storyCritical} onToggle={handleToggle} />
        </Box>
      )}

      {/* Key items */}
      {keyItems.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1.5, color: '#c8a44a' }}>Key Items</Typography>
          <List disablePadding>
            {keyItems.map((item: ItemType) => (
              <ListItem
                key={item.id}
                sx={{
                  bgcolor: '#111009', borderRadius: 1, mb: 0.75, pr: 1,
                  border: '1px solid rgba(120,108,92,0.3)',
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.9rem', color: item.inPossession ? '#e6d8c0' : '#786c5c', fontFamily: '"Cinzel", serif' }}>
                        {item.name}
                      </Typography>
                      {item.holder && (
                        <Chip label={`Held by ${item.holder.name}`} size="small" sx={{ bgcolor: '#305868', color: '#5090b0', fontSize: '0.65rem', height: 18 }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.78rem' }}>
                      {item.description}
                      {item.locationFound && !item.inPossession && ` — Found: ${item.locationFound}`}
                    </Typography>
                  }
                />
                <ItemActions item={item} />
                <Tooltip title={item.inPossession ? 'Mark as not in possession' : 'Mark as obtained'}>
                  <IconButton size="small" onClick={() => handleToggle(item.id, item.inPossession)}
                    sx={{ color: item.inPossession ? '#62a870' : '#786c5c' }}>
                    {item.inPossession ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Other items */}
      {other.length > 0 && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1.5, color: '#b4a48a' }}>Other Items</Typography>
          <List disablePadding>
            {other.map((item: ItemType) => (
              <ListItem key={item.id} sx={{ bgcolor: '#111009', borderRadius: 1, mb: 0.5, border: '1px solid rgba(120,108,92,0.2)', pr: 1 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <StatusBadge status={item.type} />
                      <Typography sx={{ fontSize: '0.9rem', color: '#e6d8c0' }}>{item.name}</Typography>
                    </Box>
                  }
                  secondary={item.description && <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.78rem' }}>{item.description}</Typography>}
                />
                <ItemActions item={item} />
                <IconButton size="small" onClick={() => handleToggle(item.id, item.inPossession)}
                  sx={{ color: item.inPossession ? '#62a870' : '#786c5c' }}>
                  {item.inPossession ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                </IconButton>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {items.length === 0 && (
        <Typography sx={{ color: '#786c5c', textAlign: 'center', py: 4 }}>No items yet.</Typography>
      )}

      <ItemFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditItem(null) }}
        onSaved={() => refetch()}
        item={editItem}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        title={`Delete "${deleteName}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        loading={deleting}
      />
    </Box>
  )
}
