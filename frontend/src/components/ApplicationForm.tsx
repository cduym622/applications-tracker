import { useState, type FormEvent } from 'react'
import type { ApplicationInput } from '../api'
import { label, STATUSES, type Company, type Status } from '../types'

export interface ApplicationFormValues {
  jobTitle: string
  company: string
  location: string
  status: Status
  salary: string
  jobPostingUrl: string
  dateApplied: string
  description: string
}

export const emptyForm: ApplicationFormValues = {
  jobTitle: '',
  company: '',
  location: '',
  status: 'SAVED',
  salary: '',
  jobPostingUrl: '',
  dateApplied: '',
  description: '',
}

/** The form's company field is sent as company_name. */
export function toApplicationInput(values: ApplicationFormValues): ApplicationInput {
  const { company, ...rest } = values
  return { ...rest, companyName: company }
}

interface Props {
  initial: ApplicationFormValues
  submitLabel: string
  /** Null until GET /api/companies/ has finished. */
  companies: Company[] | null
  /** First API message per field, keyed by the API field name. */
  errors: Record<string, string>
  busy: boolean
  onSubmit: (values: ApplicationFormValues) => void
  onCancel: () => void
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="field-error">{message}</small> : null
}

export default function ApplicationForm({
  initial,
  submitLabel,
  companies,
  errors,
  busy,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState(initial)

  const set = <K extends keyof ApplicationFormValues>(key: K, value: ApplicationFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  const invalid = (field: string) => (errors[field] ? 'invalid' : '')

  const isNewCompany =
    companies !== null &&
    values.company.trim() !== '' &&
    !companies.some((c) => c.name.toLowerCase() === values.company.trim().toLowerCase())

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>Job title *</span>
          <input
            required
            className={invalid('job_title')}
            value={values.jobTitle}
            onChange={(e) => set('jobTitle', e.target.value)}
          />
          <FieldError message={errors.job_title} />
        </label>

        <label className="field">
          <span>Company *</span>
          <input
            required
            list="company-options"
            className={invalid('company_name')}
            placeholder="Choose or type a new name"
            value={values.company}
            onChange={(e) => set('company', e.target.value)}
          />
          <datalist id="company-options">
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <FieldError message={errors.company_name} />
          {isNewCompany && <small className="hint">A new company will be created.</small>}
        </label>

        <label className="field">
          <span>Location *</span>
          <input
            required
            placeholder="City, Remote, or Hybrid"
            className={invalid('location')}
            value={values.location}
            onChange={(e) => set('location', e.target.value)}
          />
          <FieldError message={errors.location} />
        </label>

        <label className="field">
          <span>Status *</span>
          <select
            className={invalid('status')}
            value={values.status}
            onChange={(e) => set('status', e.target.value as Status)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <FieldError message={errors.status} />
        </label>

        <label className="field">
          <span>Salary</span>
          <input
            placeholder="e.g. $110k or $100k – $120k"
            className={invalid('salary')}
            value={values.salary}
            onChange={(e) => set('salary', e.target.value)}
          />
          <FieldError message={errors.salary} />
        </label>

        <label className="field">
          <span>Date applied</span>
          <input
            type="date"
            className={invalid('date_applied')}
            value={values.dateApplied}
            onChange={(e) => set('dateApplied', e.target.value)}
          />
          <FieldError message={errors.date_applied} />
        </label>

        <label className="field span-2">
          <span>Job posting URL</span>
          <input
            type="url"
            placeholder="https://"
            className={invalid('job_posting_url')}
            value={values.jobPostingUrl}
            onChange={(e) => set('jobPostingUrl', e.target.value)}
          />
          <FieldError message={errors.job_posting_url} />
        </label>

        <label className="field span-2">
          <span>Description</span>
          <textarea
            rows={4}
            className={invalid('description')}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <FieldError message={errors.description} />
        </label>
      </div>

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
