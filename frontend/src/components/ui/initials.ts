/**
 * The person's initials, used until a picture loads and whenever there is none.
 * The first letter of the first two words reads better than one letter, so
 * "Ada Lovelace" gives AL rather than A.
 */
export function initialsFor(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? '').trim() || (email ?? '').trim()
  if (!source) return '?'
  // An address is not a name: "ada@example.test" must not become AE, so only the
  // part before the @ counts.
  const local = source.includes('@') ? source.slice(0, source.indexOf('@')) : source
  const words = local.split(/[\s._-]+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]!.slice(0, 1) + words[1]!.slice(0, 1)).toUpperCase()
}
