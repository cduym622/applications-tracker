import { useState, type FormEvent } from 'react'
import { companies } from '../mockData'
import { label, STATUSES, type Status } from '../types'

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

interface Props {
  initial: ApplicationFormValues
  submitLabel: string
  onSubmit: (values: ApplicationFormValues) => void
  onCancel: () => void
}

export default function ApplicationForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState(initial)

  const set = <K extends keyof ApplicationFormValues>(key: K, value: ApplicationFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  const isNewCompany =
    values.company.trim() !== '' &&
    !companies.some((c) => c.name.toLowerCase() === values.company.trim().toLowerCase())

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>Job title *</span>
          <input required value={values.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
        </label>

        <label className="field">
          <span>Company *</span>
          <input
            required
            list="company-options"
            placeholder="Choose or type a new name"
            value={values.company}
            onChange={(e) => set('company', e.target.value)}
          />
          <datalist id="company-options">
            {companies.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          {isNewCompany && <small className="hint">A new company will be created.</small>}
        </label>

        <label className="field">
          <span>Location *</span>
          <input
            required
            placeholder="City, Remote, or Hybrid"
            value={values.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </label>

        <label className="field">
          <span>Status *</span>
          <select value={values.status} onChange={(e) => set('status', e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Salary</span>
          <input
            placeholder="e.g. $110k or $100k – $120k"
            value={values.salary}
            onChange={(e) => set('salary', e.target.value)}
          />
        </label>

        <label className="field">
          <span>Date applied</span>
          <input
            type="date"
            value={values.dateApplied}
            onChange={(e) => set('dateApplied', e.target.value)}
          />
        </label>

        <label className="field span-2">
          <span>Job posting URL</span>
          <input
            type="url"
            placeholder="https://"
            value={values.jobPostingUrl}
            onChange={(e) => set('jobPostingUrl', e.target.value)}
          />
        </label>

        <label className="field span-2">
          <span>Description</span>
          <textarea
            rows={4}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>
      </div>

      <div className="actions">
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
