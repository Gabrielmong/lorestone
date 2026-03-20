import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0b0906',
      paper: '#111009',
    },
    primary: {
      main: '#c8a44a',
      light: '#e6c76a',
      dark: '#a07830',
      contrastText: '#0b0906',
    },
    secondary: {
      main: '#c4561a',
      light: '#e07232',
      dark: '#8c3a10',
      contrastText: '#e6d8c0',
    },
    error: {
      main: '#b84848',
      dark: '#6e3030',
      light: '#d47070',
    },
    success: {
      main: '#62a870',
      dark: '#3d6b4a',
      light: '#8ac898',
    },
    info: {
      main: '#5090b0',
      dark: '#305868',
      light: '#80b8d0',
    },
    warning: {
      main: '#c8a44a',
      dark: '#a07830',
      light: '#e6c76a',
    },
    text: {
      primary: '#e6d8c0',
      secondary: '#b4a48a',
      disabled: '#786c5c',
    },
    divider: '#786c5c40',
  },
  typography: {
    fontFamily: '"Crimson Pro", serif',
    h1: { fontFamily: '"Cinzel", serif', color: '#c8a44a' },
    h2: { fontFamily: '"Cinzel", serif', color: '#c8a44a' },
    h3: { fontFamily: '"Cinzel", serif', color: '#e6d8c0' },
    h4: { fontFamily: '"Cinzel", serif', color: '#e6d8c0' },
    h5: { fontFamily: '"Cinzel", serif', color: '#e6d8c0' },
    h6: { fontFamily: '"Cinzel", serif', color: '#e6d8c0' },
    body1: { fontSize: '1.05rem', color: '#e6d8c0' },
    body2: { color: '#b4a48a' },
    caption: { color: '#786c5c', fontFamily: '"JetBrains Mono", monospace' },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0b0906',
          color: '#e6d8c0',
          fontFamily: '"Crimson Pro", serif',
        },
        '::-webkit-scrollbar': { width: 6 },
        '::-webkit-scrollbar-track': { background: '#111009' },
        '::-webkit-scrollbar-thumb': { background: '#786c5c', borderRadius: 3 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111009',
          borderRadius: 6,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a160f',
          backgroundImage: 'none',
          border: '1px solid rgba(120,108,92,0.3)',
          transition: 'border-color 0.2s',
          '&:hover': {
            borderColor: 'rgba(200,164,74,0.4)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'none',
        },
        containedPrimary: {
          backgroundColor: '#c8a44a',
          color: '#0b0906',
          '&:hover': { backgroundColor: '#e6c76a' },
        },
        containedSecondary: {
          backgroundColor: '#c4561a',
          color: '#e6d8c0',
          '&:hover': { backgroundColor: '#e07232' },
        },
        outlinedPrimary: {
          borderColor: '#c8a44a',
          color: '#c8a44a',
          '&:hover': { borderColor: '#e6c76a', color: '#e6c76a', backgroundColor: 'rgba(200,164,74,0.08)' },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#0b0906',
            '& fieldset': { borderColor: '#786c5c' },
            '&:hover fieldset': { borderColor: '#c8a44a' },
            '&.Mui-focused fieldset': { borderColor: '#c8a44a' },
          },
          '& .MuiInputLabel-root': { color: '#b4a48a' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#c8a44a' },
          '& .MuiOutlinedInput-input': { color: '#e6d8c0' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#0b0906',
          color: '#e6d8c0',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#786c5c' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#c8a44a' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#c8a44a' },
        },
        icon: { color: '#b4a48a' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          backgroundColor: '#111009',
          color: '#e6d8c0',
          '&:hover': { backgroundColor: '#1a160f' },
          '&.Mui-selected': { backgroundColor: '#1a160f', '&:hover': { backgroundColor: '#222018' } },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(120,108,92,0.3)' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: 'rgba(200,164,74,0.08)' },
          '&.Mui-selected': {
            backgroundColor: 'rgba(200,164,74,0.12)',
            borderLeft: '3px solid #c8a44a',
            '&:hover': { backgroundColor: 'rgba(200,164,74,0.16)' },
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(120,108,92,0.3)', borderRadius: 2 },
        bar: { borderRadius: 2 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { backgroundColor: '#1a160f' },
      },
    },
  },
})

export default theme
