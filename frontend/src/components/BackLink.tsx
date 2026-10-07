import { Link } from 'react-router-dom'

export default function BackLink() {
  return (
    <Link to="/dashboard" className="back-link">
      ← Dashboard
    </Link>
  )
}
