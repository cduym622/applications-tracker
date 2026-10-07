export const STATUSES = [
  'SAVED',
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
] as const
export type Status = (typeof STATUSES)[number]

export const INTERVIEW_TYPES = ['PHONE', 'VIDEO', 'ONSITE'] as const
export type InterviewType = (typeof INTERVIEW_TYPES)[number]

export const INTERVIEW_OUTCOMES = [
  'SCHEDULED',
  'COMPLETED',
  'PASSED',
  'FAILED',
  'CANCELLED',
] as const
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number]

export interface Company {
  id: number
  name: string
}

export interface Interview {
  id: number
  applicationId: number
  scheduledAt: string // ISO date-time
  type: InterviewType
  outcome: InterviewOutcome
  roundName?: string
  interviewerName?: string
}

export interface Note {
  id: number
  applicationId: number
  text: string
  createdAt: string
  updatedAt: string
}

export interface Application {
  id: number
  jobTitle: string
  companyId: number
  location: string
  status: Status
  salary?: string
  jobPostingUrl?: string
  dateApplied?: string // YYYY-MM-DD
  description?: string
}

/** "SCREENING" -> "Screening" */
export function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}
