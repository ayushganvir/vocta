const sensitiveKeyPattern = /(api[-_]?key|authorization|auth|token|secret|signedUrl|signature)/i;

export function redactPayload<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => redactPayload(item)) as T;
  }

  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[REDACTED]" : redactPayload(value)
      ])
    ) as T;
  }

  return payload;
}

