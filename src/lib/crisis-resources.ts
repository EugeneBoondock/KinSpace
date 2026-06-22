export type CrisisResource = {
  name: string
  description: string
  phone?: string
  sms?: string
  url?: string
  region: 'ZA' | 'INTL'
}

// Verified South African + international crisis lines. Shown in-app whenever
// distress is detected and on the public /crisis page.
export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: 'SADAG Suicide Crisis Helpline',
    region: 'ZA',
    phone: '0800 567 567',
    description: '24-hour suicide crisis support from the SA Depression & Anxiety Group.',
  },
  {
    name: 'SADAG Mental Health Line',
    region: 'ZA',
    phone: '011 234 4837',
    description: 'Counselling, referrals and support for any mental-health concern.',
  },
  {
    name: 'Lifeline South Africa',
    region: 'ZA',
    phone: '0861 322 322',
    description: '24-hour telephonic counselling and emotional support.',
  },
  {
    name: 'Gender-Based Violence Command Centre',
    region: 'ZA',
    phone: '0800 428 428',
    description: '24/7 support for gender-based violence and abuse.',
  },
  {
    name: 'SAPS Emergency',
    region: 'ZA',
    phone: '10111',
    description: 'Police emergency line for immediate danger.',
  },
  {
    name: 'Emergency Ambulance',
    region: 'ZA',
    phone: '10177',
    description: 'Medical emergencies, including overdose.',
  },
  {
    name: 'Befrienders Worldwide',
    region: 'INTL',
    url: 'https://www.befrienders.org',
    description: 'Find an emotional-support helpline in your country.',
  },
  {
    name: 'Find A Helpline',
    region: 'INTL',
    url: 'https://findahelpline.com',
    description: 'Free, confidential support lines worldwide.',
  },
]
