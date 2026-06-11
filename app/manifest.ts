import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NomLog',
    short_name: 'nomlog',
    description: 'Speak what you ate. See how it adds up.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#faf6f0',
    theme_color: '#faf6f0',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
