import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NomLog',
    short_name: 'nomlog',
    description: 'Speak what you ate. See how it adds up.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F8F1E2',
    theme_color: '#F8F1E2',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
