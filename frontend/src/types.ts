export const STATUSES = ['SAVED', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'] as const
export type Status = (typeof STATUSES)[number]

export const INTERVIEW_TYPES = ['PHONE', 'VIDEO', 'ONSITE'] as const
export type InterviewType = (typeof INTERVIEW_TYPES)[number]

export const INTERVIEW_OUTCOMES = ['SCHEDULED', 'COMPLETED', 'PASSED', 'FAILED', 'CANCELLED'] as const
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number]

export interface Company {
  id: number
  name: string
}

export interface NextInterview {
  id: number
  scheduledAt: string // ISO date-time
  type: InterviewType
}

export interface Interview {
  id: number
  scheduledAt: string // ISO date-time
  type: InterviewType
  outcome: InterviewOutcome
  roundName: string | null
  interviewerName: string | null
}

export interface Note {
  id: number
  text: string
  createdAt: string
  updatedAt: string
}

export interface Application {
  id: number
  jobTitle: string
  company: Company
  location: string
  status: Status
  salary: string | null
  jobPostingUrl: string | null
  dateApplied: string | null // YYYY-MM-DD
  description: string | null
  nextInterview: NextInterview | null
  createdAt: string
  updatedAt: string
}

export interface UpcomingInterview {
  id: number
  jobTitle: string
  companyName: string
  scheduledAt: string
  type: InterviewType
  applicationId: number
}

export interface DashboardData {
  counts: Record<Status, number>
  upcomingInterviews: UpcomingInterview[]
}

export interface ApplicationPage {
  count: number
  next: string | null
  previous: string | null
  results: Application[]
}

/** "SCREENING" -> "Screening" */
export function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}
