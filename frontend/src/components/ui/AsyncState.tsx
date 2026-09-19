export function ErrorAlert({ error }: { error: string }) {
  return (
    <div className="error-alert" role="alert">
      <strong>Request failed</strong>
      <span>{error}</span>
    </div>
  )
}

export function Loading() {
  return (
    <div className="empty-state" role="status">
      <span className="loading-spinner" />
      <p>Loading…</p>
    </div>
  )
}
