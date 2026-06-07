const SENSITIVE_KEYS = ['access_token', 'app_secret', 'AppSecret']

export function redact(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(redact)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))
      ? '***redacted***'
      : redact(value)
  }
  return result
}

export function logInfo(message: string, data?: unknown): void {
  const payload = data ? redact(data) : ''
  console.error(`[INFO] ${message}`, payload === '' ? '' : JSON.stringify(payload))
}

export function logError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    console.error(`[ERROR] ${message}`, error.message)
  } else {
    console.error(`[ERROR] ${message}`, error ?? '')
  }
}
