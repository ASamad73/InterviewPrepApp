import { dark } from '@clerk/themes'

const clerkAppearance = {
  baseTheme: dark,
  layout: {
    logoPlacement: 'inside',
    logoImageUrl: '',
  },
  variables: {
    colorPrimary: '#3ecf8e',
    colorText: '#ffffff',
    colorBackground: '#121212',
    colorInputBackground: '#0c0c0c',
    colorInputText: '#ffffff',
    colorDanger: '#ef4444',
    colorSurface: '#121212',
    colorMuted: '#9ca3af',

    spacingUnit: '8px',
    borderRadius: '0.5rem',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue"',
    fontSizeBase: '16px',
    controlHeight: '44px',
    controlBorderRadius: '0.375rem',
  },
  styles: {
    '.cl-card': {
      backgroundColor: '#121212',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },
    '.cl-headerTitle': {
      color: '#ffffff',
      fontWeight: '700',
    },
    '.cl-headerSubtitle': {
      color: '#d1d5db',
    },
    '.cl-formFieldLabel': {
      color: '#d1d5db',
      fontWeight: '500',
    },
    '.cl-formFieldInput': {
      backgroundColor: '#0c0c0c',
      border: '1px solid #374151',
      color: '#ffffff',
      borderRadius: '0.375rem',
      padding: '0.5rem 0.75rem',
    },
    '.cl-formFieldInput:focus': {
      borderColor: '#3ecf8e',
      boxShadow: '0 0 0 1px #3ecf8e',
      outline: 'none',
    },
    '.cl-formButtonPrimary': {
      backgroundColor: '#3ecf8e',
      color: '#000000',
      fontWeight: '600',
      borderRadius: '0.375rem',
      textTransform: 'none',
    },
    '.cl-formButtonPrimary:hover': {
      backgroundColor: '#36be81',
    },
    '.cl-footerActionLink': {
      color: '#3ecf8e',
    },
    '.cl-identityPreviewEditButton': {
      color: '#3ecf8e',
    },
  },
} as const

export default clerkAppearance
