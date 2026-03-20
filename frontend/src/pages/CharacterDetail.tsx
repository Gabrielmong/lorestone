import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, gql } from '@apollo/client'
import {
  Box, Typography, Grid, Card, CardContent, Chip, CircularProgress,
  Alert, Button, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PrintIcon from '@mui/icons-material/Print'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import StatusBadge from '../components/StatusBadge'
import HPTracker from '../components/HPTracker'
import CharacterFormDialog from '../components/CharacterFormDialog'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'

const CHARACTER = gql`
  query CharacterDetail($id: ID!) {
    character(id: $id) {
      id name role description location status
      hpMax hpCurrent armorClass speed
      stats attacks specialAbilities
      corruptionStage corruptionMax narrativeNotes
      miniPrinted miniStlSource miniSearchHint tags extra
      chapterIntroduced { id name }
      heldItems { id name type description }
      decisionStates {
        id stateLabel description
        branch { id label decision { id question } }
      }
    }
  }
`

const UPDATE_HP = gql`
  mutation UpdateHP($id: ID!, $hpCurrent: Int!) {
    updateCharacterHP(id: $id, hpCurrent: $hpCurrent) { id hpCurrent }
  }
`

const DELETE_CHARACTER = gql`
  mutation DeleteCharacter($id: ID!) {
    deleteCharacter(id: $id)
  }
`

export default function CharacterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data, loading, error, refetch } = useQuery(CHARACTER, { variables: { id }, skip: !id })
  const [updateHP] = useMutation(UPDATE_HP)
  const [deleteCharacter, { loading: deleting }] = useMutation(DELETE_CHARACTER)

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress sx={{ color: '#c8a44a' }} /></Box>
  if (error) return <Alert severity="error">{error.message}</Alert>

  const c = data?.character
  if (!c) return null

  const stats = c.stats as Record<string, number> | null
  const attacks = (c.attacks as Array<{ name: string; bonus: number; damage: string }>) ?? []
  const abilities = (c.specialAbilities as Array<{ name: string; description: string }>) ?? []

  const handleDelete = async () => {
    await deleteCharacter({ variables: { id: c.id } })
    navigate('/characters')
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/characters')}
          sx={{ color: '#786c5c', fontSize: '0.85rem' }}>
          Characters
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<EditIcon />} variant="outlined"
            onClick={() => setFormOpen(true)}
            sx={{ color: '#c8a44a', borderColor: 'rgba(200,164,74,0.4)', fontSize: '0.8rem' }}>
            Edit
          </Button>
          <Button size="small" startIcon={<DeleteIcon />}
            onClick={() => setDeleteOpen(true)}
            sx={{ color: '#b84848', borderColor: 'rgba(184,72,72,0.4)', fontSize: '0.8rem' }}
            variant="outlined">
            Delete
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h3" sx={{ mb: 0.75 }}>{c.name}</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <StatusBadge status={c.status} />
            <StatusBadge status={c.role} />
            {c.chapterIntroduced && (
              <Chip label={`Intro: ${c.chapterIntroduced.name}`} size="small"
                sx={{ bgcolor: '#1a160f', color: '#786c5c', fontSize: '0.7rem' }} />
            )}
            {c.miniPrinted && (
              <Chip icon={<PrintIcon style={{ fontSize: 12 }} />} label="Mini printed" size="small"
                sx={{ bgcolor: '#3d6b4a', color: '#62a870', fontSize: '0.7rem' }} />
            )}
            {c.tags?.length > 0 && c.tags.map((tag: string) => (
              <Chip key={tag} label={tag} size="small"
                sx={{ bgcolor: '#1a160f', color: '#786c5c', fontSize: '0.7rem' }} />
            ))}
          </Box>
        </Box>
      </Box>

      <Grid container spacing={2.5}>
        {/* Left column */}
        <Grid item xs={12} md={4}>
          {/* HP & Combat */}
          {c.hpMax && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>Combat</Typography>
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#786c5c', mb: 0.5, display: 'block' }}>Hit Points</Typography>
                  <HPTracker
                    characterId={c.id}
                    current={c.hpCurrent ?? 0}
                    max={c.hpMax}
                    onChange={(hp) => updateHP({ variables: { id: c.id, hpCurrent: hp } })}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {c.armorClass && (
                    <Box>
                      <Typography variant="caption" sx={{ color: '#786c5c', display: 'block' }}>AC</Typography>
                      <Typography sx={{ fontFamily: '"JetBrains Mono"', color: '#c8a44a', fontSize: '1.1rem' }}>{c.armorClass}</Typography>
                    </Box>
                  )}
                  {c.speed && (
                    <Box>
                      <Typography variant="caption" sx={{ color: '#786c5c', display: 'block' }}>Speed</Typography>
                      <Typography sx={{ fontFamily: '"JetBrains Mono"', color: '#e6d8c0', fontSize: '1.1rem' }}>{c.speed} ft</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Ability Scores */}
          {stats && Object.keys(stats).length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>Ability Scores</Typography>
                <Grid container spacing={1}>
                  {Object.entries(stats).map(([key, val]) => {
                    const mod = Math.floor((Number(val) - 10) / 2)
                    return (
                      <Grid item xs={4} key={key}>
                        <Box sx={{ textAlign: 'center', p: 0.5, bgcolor: '#0b0906', borderRadius: 1 }}>
                          <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '1rem', color: '#c8a44a' }}>{val}</Typography>
                          <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.6rem', color: '#786c5c' }}>
                            {mod >= 0 ? '+' : ''}{mod}
                          </Typography>
                          <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.6rem', color: '#786c5c', textTransform: 'uppercase' }}>{key}</Typography>
                        </Box>
                      </Grid>
                    )
                  })}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Corruption */}
          {c.corruptionMax > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6" sx={{ fontSize: '0.9rem' }}>Corruption</Typography>
                  <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.8rem', color: '#b84848' }}>
                    {c.corruptionStage}/{c.corruptionMax}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {Array.from({ length: c.corruptionMax }, (_, i) => (
                    <Box key={i} sx={{ width: 16, height: 16, borderRadius: '50%',
                      bgcolor: i < c.corruptionStage ? '#b84848' : '#3a332a',
                      border: '1px solid #6e303060' }} />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Mini info */}
          {(c.miniStlSource || c.miniSearchHint) && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1, fontSize: '0.9rem' }}>Miniature</Typography>
                {c.miniStlSource && (
                  <Typography variant="body2" sx={{ color: '#b4a48a', fontSize: '0.85rem' }}>
                    Source: {c.miniStlSource}
                  </Typography>
                )}
                {c.miniSearchHint && (
                  <Typography variant="caption" sx={{ color: '#786c5c', fontStyle: 'italic' }}>
                    Search: {c.miniSearchHint}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={8}>
          {c.description && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="body1" sx={{ color: '#b4a48a', lineHeight: 1.7 }}>{c.description}</Typography>
              </CardContent>
            </Card>
          )}

          {c.narrativeNotes && (
            <Card sx={{ mb: 2, border: '1px solid rgba(200,164,74,0.2)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1, fontSize: '0.9rem', color: '#c8a44a' }}>DM Notes</Typography>
                <Typography variant="body2" sx={{ color: '#b4a48a', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                  {c.narrativeNotes}
                </Typography>
              </CardContent>
            </Card>
          )}

          {attacks.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>Attacks</Typography>
                {attacks.map((atk, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: i < attacks.length - 1 ? '1px solid rgba(120,108,92,0.2)' : 'none' }}>
                    <Typography sx={{ fontSize: '0.9rem', color: '#e6d8c0' }}>{atk.name}</Typography>
                    <Typography sx={{ fontFamily: '"JetBrains Mono"', fontSize: '0.8rem', color: '#c8a44a' }}>
                      {atk.bonus >= 0 ? '+' : ''}{atk.bonus} / {atk.damage}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {abilities.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2, pb: '8px !important' }}>
                <Typography variant="h6" sx={{ mb: 1, fontSize: '0.9rem' }}>Special Abilities</Typography>
                {abilities.map((ability, i) => (
                  <Accordion key={i} sx={{ bgcolor: '#0b0906', '&:before': { display: 'none' }, mb: 0.5 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18, color: '#786c5c' }} />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                      <Typography sx={{ fontSize: '0.85rem', color: '#c8a44a' }}>{ability.name}</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <Typography variant="body2" sx={{ color: '#b4a48a', fontSize: '0.85rem' }}>{ability.description}</Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          )}

          {c.decisionStates?.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>Reaction to Decisions</Typography>
                {c.decisionStates.map((ds: { id: string; stateLabel?: string | null; description: string; branch: { label: string; decision: { question: string } } }) => (
                  <Box key={ds.id} sx={{ mb: 1, p: 1, bgcolor: '#0b0906', borderRadius: 1, border: '1px solid rgba(120,108,92,0.2)' }}>
                    <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.7rem', display: 'block' }}>
                      {ds.branch.decision.question} → {ds.branch.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#b4a48a', fontSize: '0.85rem', mt: 0.25 }}>
                      {ds.description}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {c.heldItems?.length > 0 && (
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontSize: '0.9rem' }}>Held Items</Typography>
                {c.heldItems.map((item: { id: string; name: string; type: string; description?: string | null }) => (
                  <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <StatusBadge status={item.type} />
                    <Typography sx={{ fontSize: '0.9rem', color: '#e6d8c0' }}>{item.name}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      <CharacterFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); refetch() }}
        character={c}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Delete "${c.name}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleting}
      />
    </Box>
  )
}
