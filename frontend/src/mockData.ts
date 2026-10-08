// Static stand-in data. Replaced by API calls once the backend exists.
import type { Application, Company, Interview, Note } from './types'

function daysFromNow(days: number, hour = 10): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const companies: Company[] = [
  { id: 1, name: 'Stripe' },
  { id: 2, name: 'Datadog' },
  { id: 3, name: 'Shopify' },
  { id: 4, name: 'Cloudflare' },
  { id: 5, name: 'Plaid' },
  { id: 6, name: 'Notion' },
]

export const applications: Application[] = [
  {
    id: 1,
    jobTitle: 'Backend Engineer I',
    companyId: 1,
    location: 'Remote',
    status: 'INTERVIEW',
    salary: '$120k – $140k',
    jobPostingUrl: 'https://example.com/jobs/1',
    dateApplied: '2026-09-02',
    description: 'Payments platform team. Python and Go.',
  },
  {
    id: 2,
    jobTitle: 'Software Engineer, New Grad',
    companyId: 2,
    location: 'New York',
    status: 'SCREENING',
    dateApplied: '2026-09-10',
  },
  {
    id: 3,
    jobTitle: 'Junior Python Developer',
    companyId: 3,
    location: 'Hybrid',
    status: 'APPLIED',
    salary: '$95k',
    dateApplied: '2026-09-18',
  },
  {
    id: 4,
    jobTitle: 'Systems Engineer',
    companyId: 4,
    location: 'Austin',
    status: 'SAVED',
    jobPostingUrl: 'https://example.com/jobs/4',
  },
  {
    id: 5,
    jobTitle: 'API Engineer',
    companyId: 5,
    location: 'San Francisco',
    status: 'REJECTED',
    dateApplied: '2026-08-21',
  },
  {
    id: 6,
    jobTitle: 'Backend Engineer, Platform',
    companyId: 6,
    location: 'Remote',
    status: 'OFFER',
    salary: '$135k',
    dateApplied: '2026-08-05',
  },
  {
    id: 7,
    jobTitle: 'Data Engineer',
    companyId: 2,
    location: 'Boston',
    status: 'APPLIED',
    dateApplied: '2026-09-25',
  },
  {
    id: 8,
    jobTitle: 'Infrastructure Engineer',
    companyId: 1,
    location: 'Seattle',
    status: 'SAVED',
  },
  {
    id: 9,
    jobTitle: 'Software Engineer I',
    companyId: 3,
    location: 'Remote',
    status: 'APPLIED',
    dateApplied: '2026-10-01',
  },
  {
    id: 10,
    jobTitle: 'Django Developer',
    companyId: 5,
    location: 'Hybrid',
    status: 'SCREENING',
    dateApplied: '2026-09-28',
  },
  {
    id: 11,
    jobTitle: 'Platform Engineer',
    companyId: 4,
    location: 'Remote',
    status: 'APPLIED',
    dateApplied: '2026-09-14',
  },
  {
    id: 12,
    jobTitle: 'Backend Developer',
    companyId: 6,
    location: 'New York',
    status: 'SAVED',
  },
]

export const interviews: Interview[] = [
  {
    id: 1,
    applicationId: 1,
    scheduledAt: daysFromNow(-7, 14),
    type: 'PHONE',
    outcome: 'PASSED',
    roundName: 'Recruiter screen',
    interviewerName: 'Dana Lee',
  },
  {
    id: 2,
    applicationId: 1,
    scheduledAt: daysFromNow(3, 11),
    type: 'VIDEO',
    outcome: 'SCHEDULED',
    roundName: 'Technical',
  },
  {
    id: 3,
    applicationId: 1,
    scheduledAt: daysFromNow(10, 9),
    type: 'ONSITE',
    outcome: 'SCHEDULED',
    roundName: 'Final loop',
  },
  {
    id: 4,
    applicationId: 2,
    scheduledAt: daysFromNow(1, 15),
    type: 'PHONE',
    outcome: 'SCHEDULED',
    roundName: 'Recruiter screen',
  },
  {
    id: 5,
    applicationId: 10,
    scheduledAt: daysFromNow(5, 13),
    type: 'VIDEO',
    outcome: 'SCHEDULED',
  },
  {
    id: 6,
    applicationId: 5,
    scheduledAt: daysFromNow(-20, 10),
    type: 'VIDEO',
    outcome: 'FAILED',
    roundName: 'Technical',
  },
]

export const notes: Note[] = [
  {
    id: 1,
    applicationId: 1,
    text: 'Recruiter said the team is hiring two people this quarter.',
    createdAt: daysFromNow(-8, 16),
    updatedAt: daysFromNow(-8, 16),
  },
  {
    id: 2,
    applicationId: 1,
    text: 'Technical round covers system design and a short coding exercise. Review rate limiting.',
    createdAt: daysFromNow(-6, 9),
    updatedAt: daysFromNow(-2, 18),
  },
]

/** Stands in for DELETE /api/applications/{id}/: removes its interviews and notes too, keeps the company. */
export function deleteApplication(id: number): void {
  const remove = <T,>(list: T[], match: (item: T) => boolean) => {
    for (let i = list.length - 1; i >= 0; i--) if (match(list[i])) list.splice(i, 1)
  }
  remove(applications, (a) => a.id === id)
  remove(interviews, (i) => i.applicationId === id)
  remove(notes, (n) => n.applicationId === id)
}

export function companyName(companyId: number): string {
  return companies.find((c) => c.id === companyId)?.name ?? 'Unknown'
}

export function isUpcoming(i: Interview): boolean {
  return i.outcome === 'SCHEDULED' && new Date(i.scheduledAt) > new Date()
}

export function nextInterview(applicationId: number): Interview | undefined {
  return interviews
    .filter((i) => i.applicationId === applicationId && isUpcoming(i))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
