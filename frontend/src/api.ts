// API client. The only module that reads or writes snake_case keys.
// Every URL is relative to /api, which Vite proxies to Django in development.
import type {
  Application,
  ApplicationPage,
  Company,
  DashboardData,
  Interview,
  InterviewOutcome,
  InterviewType,
  NextInterview,
  Note,
  Status,
  UpcomingInterview,
} from './types'

export const TOKEN_KEY = 'access'
const FAILED = 'The request failed.'

let onUnauthorized: () => void = () => {}

/** AuthProvider registers what to do when an authenticated call returns 401. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

export class ApiError extends Error {
  status: number
  /** First message for each field in a 400 body. */
  fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/** One line for an alert: the message, or the first message of each field. */
export function errorText(err: unknown): string {
  if (!(err instanceof ApiError)) return FAILED
  return err.message || Object.values(err.fieldErrors).join(' ') || FAILED
}

function toApiError(status: number, body: unknown): ApiError {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return new ApiError(status, FAILED)
  let message = ''
  const fieldErrors: Record<string, string> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first !== 'string') continue
    if (key === 'detail' || key === 'non_field_errors') message ||= first
    else fieldErrors[key] = first
  }
  if (!message && Object.keys(fieldErrors).length === 0) message = FAILED
  return new ApiError(status, message, fieldErrors)
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    // Read on every call so a token stored by a login just now is used.
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, FAILED)
  }

  if (auth && res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    onUnauthorized()
  }
  if (res.status === 204) return undefined as T

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new ApiError(res.status, FAILED)
  }
  if (!res.ok) throw toApiError(res.status, data)
  return data as T
}

// Read shapes as the API sends them.

interface RawCompany {
  id: number
  name: string
}

interface RawNextInterview {
  id: number
  scheduled_at: string
  type: InterviewType
}

interface RawApplication {
  id: number
  job_title: string
  company: RawCompany
  location: string
  status: Status
  salary: string | null
  job_posting_url: string | null
  date_applied: string | null
  description: string | null
  next_interview: RawNextInterview | null
  created_at: string
  updated_at: string
}

interface RawPage {
  count: number
  next: string | null
  previous: string | null
  results: RawApplication[]
}

interface RawInterview {
  id: number
  scheduled_at: string
  type: InterviewType
  outcome: InterviewOutcome
  round_name: string | null
  interviewer_name: string | null
}

interface RawNote {
  id: number
  text: string
  created_at: string
  updated_at: string
}

interface RawUpcomingInterview {
  id: number
  job_title: string
  company_name: string
  scheduled_at: string
  type: InterviewType
  application_id: number
}

interface RawDashboard {
  counts: Record<Status, number>
  upcoming_interviews: RawUpcomingInterview[]
}

function toCompany(c: RawCompany): Company {
  return { id: c.id, name: c.name }
}

function toNextInterview(i: RawNextInterview): NextInterview {
  return { id: i.id, scheduledAt: i.scheduled_at, type: i.type }
}

function toApplication(a: RawApplication): Application {
  return {
    id: a.id,
    jobTitle: a.job_title,
    company: toCompany(a.company),
    location: a.location,
    status: a.status,
    salary: a.salary,
    jobPostingUrl: a.job_posting_url,
    dateApplied: a.date_applied,
    description: a.description,
    nextInterview: a.next_interview ? toNextInterview(a.next_interview) : null,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }
}

function toPage(p: RawPage): ApplicationPage {
  return { count: p.count, next: p.next, previous: p.previous, results: p.results.map(toApplication) }
}

function toInterview(i: RawInterview): Interview {
  return {
    id: i.id,
    scheduledAt: i.scheduled_at,
    type: i.type,
    outcome: i.outcome,
    roundName: i.round_name,
    interviewerName: i.interviewer_name,
  }
}

function toNote(n: RawNote): Note {
  return { id: n.id, text: n.text, createdAt: n.created_at, updatedAt: n.updated_at }
}

function toUpcoming(i: RawUpcomingInterview): UpcomingInterview {
  return {
    id: i.id,
    jobTitle: i.job_title,
    companyName: i.company_name,
    scheduledAt: i.scheduled_at,
    type: i.type,
    applicationId: i.application_id,
  }
}

function toDashboard(d: RawDashboard): DashboardData {
  return { counts: d.counts, upcomingInterviews: d.upcoming_interviews.map(toUpcoming) }
}

/** Blank optional text goes out as null. An empty string is not a valid URL. */
function orNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

// Auth

export function login(email: string, password: string): Promise<{ access: string }> {
  return request('POST', '/auth/login/', { email, password }, false)
}

export function register(email: string, password: string): Promise<{ access: string }> {
  return request('POST', '/auth/register/', { email, password }, false)
}

// Dashboard

export async function getDashboard(): Promise<DashboardData> {
  return toDashboard(await request<RawDashboard>('GET', '/dashboard/'))
}

// Applications

export interface ApplicationInput {
  jobTitle: string
  companyName: string
  location: string
  status: Status
  salary: string
  jobPostingUrl: string
  dateApplied: string
  description: string
}

function applicationBody(values: Partial<ApplicationInput>): Record<string, string | null> {
  const body: Record<string, string | null> = {}
  if (values.jobTitle !== undefined) body.job_title = values.jobTitle
  if (values.companyName !== undefined) body.company_name = values.companyName
  if (values.location !== undefined) body.location = values.location
  if (values.status !== undefined) body.status = values.status
  if (values.salary !== undefined) body.salary = orNull(values.salary)
  if (values.jobPostingUrl !== undefined) body.job_posting_url = orNull(values.jobPostingUrl)
  if (values.dateApplied !== undefined) body.date_applied = orNull(values.dateApplied)
  if (values.description !== undefined) body.description = orNull(values.description)
  return body
}

export interface ListParams {
  q: string
  from: string
  to: string
  status: Status | ''
  page: number
}

export async function listApplications(params: ListParams): Promise<ApplicationPage> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.status) query.set('status', params.status)
  if (params.page > 1) query.set('page', String(params.page))
  const qs = query.toString()
  return toPage(await request<RawPage>('GET', `/applications/${qs ? `?${qs}` : ''}`))
}

export async function getApplication(id: number): Promise<Application> {
  return toApplication(await request<RawApplication>('GET', `/applications/${id}/`))
}

export async function createApplication(values: ApplicationInput): Promise<Application> {
  return toApplication(await request<RawApplication>('POST', '/applications/', applicationBody(values)))
}

export async function updateApplication(id: number, values: Partial<ApplicationInput>): Promise<Application> {
  return toApplication(await request<RawApplication>('PATCH', `/applications/${id}/`, applicationBody(values)))
}

export function deleteApplication(id: number): Promise<void> {
  return request('DELETE', `/applications/${id}/`)
}

// Companies

export async function listCompanies(): Promise<Company[]> {
  return (await request<RawCompany[]>('GET', '/companies/')).map(toCompany)
}

// Interviews

export interface InterviewInput {
  scheduledAt: string // ISO date-time
  type: InterviewType
  outcome: InterviewOutcome
  roundName: string
  interviewerName: string
}

export async function listInterviews(applicationId: number): Promise<Interview[]> {
  return (await request<RawInterview[]>('GET', `/applications/${applicationId}/interviews/`)).map(toInterview)
}

export async function createInterview(applicationId: number, values: InterviewInput): Promise<Interview> {
  const body = {
    scheduled_at: values.scheduledAt,
    type: values.type,
    outcome: values.outcome,
    round_name: orNull(values.roundName),
    interviewer_name: orNull(values.interviewerName),
  }
  return toInterview(await request<RawInterview>('POST', `/applications/${applicationId}/interviews/`, body))
}

export async function updateInterviewOutcome(
  applicationId: number,
  interviewId: number,
  outcome: InterviewOutcome,
): Promise<Interview> {
  return toInterview(
    await request<RawInterview>('PATCH', `/applications/${applicationId}/interviews/${interviewId}/`, { outcome }),
  )
}

export function deleteInterview(applicationId: number, interviewId: number): Promise<void> {
  return request('DELETE', `/applications/${applicationId}/interviews/${interviewId}/`)
}

// Notes

export async function listNotes(applicationId: number): Promise<Note[]> {
  return (await request<RawNote[]>('GET', `/applications/${applicationId}/notes/`)).map(toNote)
}

export async function createNote(applicationId: number, text: string): Promise<Note> {
  return toNote(await request<RawNote>('POST', `/applications/${applicationId}/notes/`, { text }))
}

export async function updateNote(applicationId: number, noteId: number, text: string): Promise<Note> {
  return toNote(await request<RawNote>('PATCH', `/applications/${applicationId}/notes/${noteId}/`, { text }))
}

export function deleteNote(applicationId: number, noteId: number): Promise<void> {
  return request('DELETE', `/applications/${applicationId}/notes/${noteId}/`)
}
