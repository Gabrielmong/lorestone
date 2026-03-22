import { useState, useRef } from 'react'
import { useQuery, useMutation, gql } from '@apollo/client'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fadeIn, slideUp } from '../utils/motion'
import {
  Box, Typography, TextField, Button, Alert, Divider,
  CircularProgress, IconButton, Tooltip, Paper,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import LockIcon from '@mui/icons-material/Lock'
import PersonIcon from '@mui/icons-material/Person'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { useAuthStore } from '../store/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const ME = gql`
  query MeProfile {
    me { id email name dateOfBirth avatarUrl createdAt }
  }
`

const UPDATE_PROFILE = gql`
  mutation UpdateProfile($name: String, $dateOfBirth: Date, $avatarUrl: String) {
    updateProfile(name: $name, dateOfBirth: $dateOfBirth, avatarUrl: $avatarUrl) {
      id name dateOfBirth avatarUrl
    }
  }
`

const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`

function FieldRow({
  label,
  value,
  editValue,
  editing,
  onEdit,
  onSave,
  onCancel,
  onChange,
  type = 'text',
  readOnly = false,
}: {
  label: string
  value: string
  editValue: string
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onChange: (v: string) => void
  type?: string
  readOnly?: boolean
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25 }}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '0.72rem', color: '#786c5c', mb: 0.25, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </Typography>
        {editing ? (
          <TextField
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            type={type}
            size="small"
            autoFocus
            sx={{ '& .MuiInputBase-input': { fontSize: '0.9rem', py: 0.75 } }}
            fullWidth
          />
        ) : (
          <Typography sx={{ fontSize: '0.9rem', color: value ? '#e6d8c0' : '#4a4035' }}>
            {value || '—'}
          </Typography>
        )}
      </Box>
      {!readOnly && (
        <Box sx={{ display: 'flex', gap: 0.5, alignSelf: 'flex-end', pb: 0.25 }}>
          {editing ? (
            <>
              <Tooltip title="Save">
                <IconButton size="small" onClick={onSave} sx={{ color: '#62a870', '&:hover': { bgcolor: 'rgba(98,168,112,0.1)' } }}>
                  <CheckIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton size="small" onClick={onCancel} sx={{ color: '#786c5c', '&:hover': { bgcolor: 'rgba(120,108,92,0.1)' } }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={onEdit} sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a', bgcolor: 'rgba(200,164,74,0.1)' } }}>
                <EditIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const { data, loading, refetch } = useQuery(ME)
  const [updateProfile, { loading: saving }] = useMutation(UPDATE_PROFILE)
  const [changePassword, { loading: changingPw }] = useMutation(CHANGE_PASSWORD)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Profile editing state
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDob, setEditDob] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')

  // Password state
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  const me = data?.me

  const startEdit = (field: string) => {
    setEditingField(field)
    setProfileError('')
    setProfileSuccess('')
    if (field === 'name') setEditName(me?.name ?? '')
    if (field === 'dateOfBirth') setEditDob(me?.dateOfBirth ? me.dateOfBirth.slice(0, 10) : '')
  }

  const cancelEdit = () => setEditingField(null)

  const saveField = async (field: string) => {
    try {
      const vars: Record<string, string> = {}
      if (field === 'name') vars.name = editName
      if (field === 'dateOfBirth') vars.dateOfBirth = editDob || ''
      const { data: result } = await updateProfile({ variables: vars })
      // update store name if changed
      if (field === 'name' && result?.updateProfile) {
        const token = localStorage.getItem('ttrpg_token')
        if (token) setAuth({ id: me.id, email: me.email, name: result.updateProfile.name }, token)
      }
      setEditingField(null)
      setProfileSuccess('Profile updated.')
      refetch()
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    setPwSuccess('')
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    try {
      await changePassword({ variables: { currentPassword: currentPw, newPassword: newPw } })
      setPwSuccess('Password changed successfully.')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Failed to change password')
    }
  }

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/api/upload/image?folder=avatars`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()
      await updateProfile({ variables: { avatarUrl: url } })
      refetch()
    } catch { /* silent */ } finally { setAvatarUploading(false) }
  }

  const dobDisplay = me?.dateOfBirth ? new Date(me.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : ''
  const memberSince = me?.createdAt ? new Date(me.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''

  return (
    <Box
      component={motion.div}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      sx={{ minHeight: '100svh', bgcolor: '#0b0906', p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 560 }}>
        {/* Back */}
        <Box sx={{ mb: 3 }}>
          <Tooltip title="Back to campaigns">
            <IconButton onClick={() => navigate(-1)} sx={{ color: '#786c5c', '&:hover': { color: '#c8a44a' } }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress sx={{ color: '#c8a44a' }} />
          </Box>
        ) : (
          <Box component={motion.div} variants={slideUp}>
            {/* Profile info section */}
            <Paper
              elevation={0}
              sx={{ p: 3, mb: 2.5, bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.25)', borderRadius: 2 }}
            >
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = '' }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                {/* Clickable avatar */}
                <Tooltip title="Change photo">
                  <Box
                    onClick={() => avatarInputRef.current?.click()}
                    sx={{
                      width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                      bgcolor: '#1a160f', border: '1px solid rgba(200,164,74,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden', position: 'relative',
                      '&:hover .avatar-overlay': { opacity: 1 },
                    }}
                  >
                    {avatarUploading ? (
                      <CircularProgress size={20} sx={{ color: '#c8a44a' }} />
                    ) : me?.avatarUrl ? (
                      <>
                        <Box component="img" src={me.avatarUrl} alt=""
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <Box className="avatar-overlay" sx={{
                          position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.55)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity 0.15s',
                        }}>
                          <PhotoCameraIcon sx={{ fontSize: 18, color: '#e6d8c0' }} />
                        </Box>
                      </>
                    ) : (
                      <>
                        <PersonIcon sx={{ color: '#c8a44a', fontSize: 24 }} />
                        <Box className="avatar-overlay" sx={{
                          position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.55)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity 0.15s',
                        }}>
                          <PhotoCameraIcon sx={{ fontSize: 18, color: '#e6d8c0' }} />
                        </Box>
                      </>
                    )}
                  </Box>
                </Tooltip>
                <Box>
                  <Typography variant="h6" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: '1rem' }}>
                    Profile
                  </Typography>
                  {memberSince && (
                    <Typography sx={{ fontSize: '0.72rem', color: '#786c5c' }}>
                      Member since {memberSince}
                    </Typography>
                  )}
                </Box>
              </Box>

              {profileError && <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>{profileError}</Alert>}
              {profileSuccess && <Alert severity="success" sx={{ mb: 1.5, py: 0 }}>{profileSuccess}</Alert>}

              <FieldRow
                label="Display Name"
                value={me?.name ?? ''}
                editValue={editName}
                editing={editingField === 'name'}
                onEdit={() => startEdit('name')}
                onSave={() => saveField('name')}
                onCancel={cancelEdit}
                onChange={setEditName}
              />
              <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)' }} />
              <FieldRow
                label="Email"
                value={me?.email ?? ''}
                editValue={''}
                editing={false}
                onEdit={() => {}}
                onSave={() => {}}
                onCancel={() => {}}
                onChange={() => {}}
                readOnly
              />
              <Divider sx={{ borderColor: 'rgba(120,108,92,0.15)' }} />
              <FieldRow
                label="Date of Birth"
                value={dobDisplay}
                editValue={editDob}
                editing={editingField === 'dateOfBirth'}
                onEdit={() => startEdit('dateOfBirth')}
                onSave={() => saveField('dateOfBirth')}
                onCancel={cancelEdit}
                onChange={setEditDob}
                type="date"
              />

              {saving && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <CircularProgress size={16} sx={{ color: '#c8a44a' }} />
                </Box>
              )}
            </Paper>

            {/* Security section */}
            <Paper
              elevation={0}
              sx={{ p: 3, bgcolor: '#111009', border: '1px solid rgba(120,108,92,0.25)', borderRadius: 2 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#1a160f', border: '1px solid rgba(184,72,72,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LockIcon sx={{ color: '#b84848', fontSize: 18 }} />
                </Box>
                <Typography variant="h6" sx={{ fontFamily: '"Cinzel", serif', color: '#e6d8c0', fontSize: '1rem' }}>
                  Security
                </Typography>
              </Box>

              <Typography sx={{ fontSize: '0.82rem', color: '#786c5c', mb: 2 }}>
                Change your password. You'll need your current password to confirm.
              </Typography>

              {pwError && <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>{pwError}</Alert>}
              {pwSuccess && <Alert severity="success" sx={{ mb: 1.5, py: 0 }}>{pwSuccess}</Alert>}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  label="Current Password"
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="New Password"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  size="small"
                  fullWidth
                  helperText="At least 8 characters"
                />
                <TextField
                  label="Confirm New Password"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  size="small"
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={handleChangePassword}
                  disabled={changingPw || !currentPw || !newPw || !confirmPw}
                  size="small"
                  sx={{ alignSelf: 'flex-start', borderColor: 'rgba(184,72,72,0.4)', color: '#b84848', '&:hover': { borderColor: '#b84848', bgcolor: 'rgba(184,72,72,0.08)' } }}
                >
                  {changingPw ? <CircularProgress size={14} sx={{ color: '#b84848' }} /> : 'Change Password'}
                </Button>
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  )
}
