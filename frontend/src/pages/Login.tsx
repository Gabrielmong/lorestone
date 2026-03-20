import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, gql } from '@apollo/client'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useAuthStore } from '../store/auth'
import { useCampaign } from '../context/campaign'

const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user { id email name }
    }
  }
`

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [login, { loading }] = useMutation(LOGIN)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const { data } = await login({ variables: { email, password } })
      setAuth(data.login.user, data.login.token)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0b0906',
        backgroundImage: 'radial-gradient(ellipse at center, #1a160f 0%, #0b0906 70%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 380, border: '1px solid rgba(200,164,74,0.3)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" sx={{ mb: 0.5, textAlign: 'center', color: '#c8a44a' }}>
            The Companion
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', color: '#786c5c', mb: 3, fontSize: '0.85rem' }}>
            TTRPG Campaign Manager
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              required
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ py: 1.25 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Enter the table'}
            </Button>
          </Box>

          <Typography variant="body2" sx={{ textAlign: 'center', mt: 2, color: '#786c5c', fontSize: '0.85rem' }}>
            No account?{' '}
            <Link to="/register" style={{ color: '#c8a44a', textDecoration: 'none' }}>
              Register
            </Link>
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', mt: 1.5, fontSize: '0.78rem' }}>
            <Link to="/landing" style={{ color: '#4a4035', textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
