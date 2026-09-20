export function ErrorAlert({
  message,
  retry,
}: {
  message: string
  retry?: () => void | Promise<void>
}) {
  return (
    <div className="error-alert" role="alert">
      <strong>Request failed</strong>
      <span>{message}</span>
      {retry && (
        <button type="button" onClick={() => void retry()}>
          Try again
        </button>
      )}
    </div>
  )
}
