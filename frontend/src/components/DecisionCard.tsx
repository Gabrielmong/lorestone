import { useState } from 'react'
import { useMutation, gql } from '@apollo/client'
import { motion } from 'framer-motion'
import { slideUp } from '../utils/motion'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Collapse,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  Divider,
  Tooltip,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import LockIcon from '@mui/icons-material/Lock'
import ReplayIcon from '@mui/icons-material/Replay'
import StatusBadge from './StatusBadge'

const UNRESOLVE = gql`
  mutation UnresolveDecision($id: ID!) {
    unresolveDecision(id: $id) { id status chosenBranch { id } }
  }
`

interface Branch {
  id: string
  label: string
  description?: string | null
  consequence?: string | null
  outcomeType: string
  orderIndex: number
}

interface DecisionLink {
  id: string
  fromDecision: { id: string }
  fromBranch?: { id: string; label: string } | null
}

interface Decision {
  id: string
  question: string
  status: string
  missionName?: string | null
  chapter?: { name: string } | null
  branches: Branch[]
  chosenBranch?: { id: string; label: string } | null
  incomingLinks?: DecisionLink[]
}

interface Props {
  decision: Decision
  onResolve?: (decisionId: string, branchId: string) => void
  onUnresolve?: () => void
}

const OUTCOME_COLORS: Record<string, string> = {
  GOOD: '#3d6b4a',
  BAD: '#6e3030',
  NEUTRAL: '#305868',
  VARIABLE: '#3a2e14',
}

export default function DecisionCard({ decision, onResolve, onUnresolve }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [unresolve, { loading: unresolving }] = useMutation(UNRESOLVE, {
    refetchQueries: ['Decisions', 'AllDecisionsTree', 'Dashboard'],
    onCompleted: () => onUnresolve?.(),
  })

  const isResolved = decision.status === 'RESOLVED'
  const links = decision.incomingLinks ?? []
  const isLocked = links.length > 0 && !links.some((link) =>
    link.fromDecision && (!link.fromBranch || decision.chosenBranch?.id === link.fromBranch.id)
  )

  const handleResolve = () => {
    if (selectedBranch && onResolve) {
      onResolve(decision.id, selectedBranch)
    }
  }

  return (
    <motion.div variants={slideUp}>
    <Card sx={{ opacity: isLocked ? 0.6 : 1 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ flex: 1, mr: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mb: 0.5 }}>
              <StatusBadge status={decision.status} />
              {isLocked && <LockIcon sx={{ fontSize: 14, color: '#786c5c' }} />}
              {decision.chapter && (
                <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.68rem' }}>
                  {decision.chapter.name}
                </Typography>
              )}
            </Box>
            {decision.missionName && (
              <Typography variant="caption" sx={{ color: '#c8a44a', fontSize: '0.7rem', display: 'block', mb: 0.25 }}>
                {decision.missionName}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: '#e6d8c0', fontSize: '0.9rem' }}>
              {decision.question}
            </Typography>
            {isResolved && decision.chosenBranch && (
              <Typography variant="caption" sx={{ color: '#c8a44a', fontSize: '0.75rem', fontStyle: 'italic' }}>
                → {decision.chosenBranch.label}
              </Typography>
            )}
          </Box>
          {expanded ? (
            <ExpandLessIcon sx={{ fontSize: 18, color: '#786c5c' }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 18, color: '#786c5c' }} />
          )}
        </Box>

        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />

          {isLocked && links.length > 0 && (
            <Box sx={{ mb: 1, p: 1, bgcolor: '#1a160f', borderRadius: 1, border: '1px solid #786c5c30' }}>
              <Typography variant="caption" sx={{ color: '#786c5c', fontSize: '0.75rem' }}>
                Locked — waiting on {links.length === 1 ? 'a prerequisite' : 'prerequisites'} to be resolved
                {links[0].fromBranch && ` (${links[0].fromBranch.label})`}
              </Typography>
            </Box>
          )}

          {!isResolved && !isLocked ? (
            <Box>
              <RadioGroup value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                {decision.branches.map((b) => (
                  <Box
                    key={b.id}
                    sx={{
                      mb: 0.75,
                      p: 1,
                      borderRadius: 1,
                      border: `1px solid ${OUTCOME_COLORS[b.outcomeType] ?? '#3a332a'}60`,
                      bgcolor: selectedBranch === b.id ? `${OUTCOME_COLORS[b.outcomeType] ?? '#3a332a'}30` : 'transparent',
                    }}
                  >
                    <FormControlLabel
                      value={b.id}
                      control={<Radio size="small" sx={{ color: '#786c5c', '&.Mui-checked': { color: '#c8a44a' }, p: 0.5 }} />}
                      label={
                        <Box>
                          <Typography sx={{ fontSize: '0.85rem', color: '#e6d8c0' }}>{b.label}</Typography>
                          {b.consequence && (
                            <Typography variant="caption" sx={{ color: '#b4a48a', fontSize: '0.75rem' }}>
                              {b.consequence}
                            </Typography>
                          )}
                        </Box>
                      }
                      sx={{ m: 0, alignItems: 'flex-start' }}
                    />
                  </Box>
                ))}
              </RadioGroup>
              <Button
                variant="contained"
                size="small"
                disabled={!selectedBranch}
                onClick={handleResolve}
                sx={{ mt: 0.5 }}
              >
                Resolve
              </Button>
            </Box>
          ) : (
            <Box>
              {decision.branches.map((b) => (
                <Box
                  key={b.id}
                  sx={{
                    mb: 0.5,
                    p: 0.75,
                    borderRadius: 1,
                    border: `1px solid ${decision.chosenBranch?.id === b.id ? '#c8a44a60' : '#3a332a'}`,
                    bgcolor: decision.chosenBranch?.id === b.id ? '#3a2e14' : 'transparent',
                  }}
                >
                  <Typography sx={{ fontSize: '0.85rem', color: decision.chosenBranch?.id === b.id ? '#c8a44a' : '#786c5c' }}>
                    {decision.chosenBranch?.id === b.id ? '✓ ' : ''}{b.label}
                  </Typography>
                </Box>
              ))}
              {isResolved && (
                <Tooltip title="Reset decision back to pending">
                  <Button
                    size="small"
                    startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
                    onClick={() => unresolve({ variables: { id: decision.id } })}
                    disabled={unresolving}
                    sx={{ mt: 0.5, color: '#786c5c', fontSize: '0.72rem', '&:hover': { color: '#c8a44a' } }}
                  >
                    Reset
                  </Button>
                </Tooltip>
              )}
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
    </motion.div>
  )
}
