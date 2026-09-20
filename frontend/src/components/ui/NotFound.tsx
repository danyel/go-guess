import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <section className="empty-page">
      <span className="eyebrow">404</span>
      <h1>Page not found</h1>
      <p>The page you requested is not available.</p>
      <Link className="button primary" to="/jobs">
        Back to jobs
      </Link>
    </section>
  )
}
