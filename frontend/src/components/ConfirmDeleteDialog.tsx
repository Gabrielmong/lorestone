import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'

interface Props {
  open: boolean
  title?: string
  message?: string
  onConfirm: () => void
  onClose: () => void
  loading?: boolean
}

export default function ConfirmDeleteDialog({ open, title = 'Delete', message, onConfirm, onClose, loading }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ color: '#e6d8c0', fontFamily: '"Cinzel", serif', fontSize: '1rem' }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#b4a48a', fontSize: '0.9rem' }}>
          {message ?? 'Are you sure? This action cannot be undone.'}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#786c5c' }}>Cancel</Button>
        <Button onClick={onConfirm} disabled={loading} variant="contained" color="error" size="small">
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}
