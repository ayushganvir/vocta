const redacted = "[REDACTED]";
const redactedUrl = "[REDACTED_URL]";

const sensitiveKeyPattern =
  /(api[-_]?key|x[-_]?api[-_]?key|authorization|auth[-_]?header|access[-_]?token|refresh[-_]?token|id[-_]?token|token|secret|client[-_]?secret|password|credential|cookie|set[-_]?cookie|signed[-_]?url|signedUrl|signature|private[-_]?key)/i;

const sensitiveQueryParamPattern =
  /^(x-amz-signature|x-amz-credential|x-amz-security-token|x-goog-signature|x-goog-credential|signature|sig|token|access_token|refresh_token|id_token|client_secret|expires|policy|key-pair-id)$/i;

const secretValuePattern = /\b(bearer|basic)\s+[a-z0-9._~+/=-]+|\bsk-[a-z0-9_-]+/i;
const safeTokenTelemetryKeys = new Set([
  "max_output_tokens",
  "input_tokens",
  "output_tokens",
  "total_tokens",
  "prompt_tokens",
  "completion_tokens"
]);

function redactString(value: string) {
  if (secretValuePattern.test(value)) {
    return redacted;
  }

  try {
    const url = new URL(value);
    const hasSensitiveQuery = [...url.searchParams.keys()].some((key) => sensitiveQueryParamPattern.test(key));

    if (hasSensitiveQuery) {
      return redactedUrl;
    }
  } catch {
    // Not a URL.
  }

  return value;
}

export function redactPayload<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => redactPayload(item)) as T;
  }

  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        shouldRedactKey(key) ? redacted : redactPayload(value)
      ])
    ) as T;
  }

  if (typeof payload === "string") {
    return redactString(payload) as T;
  }

  return payload;
}

function shouldRedactKey(key: string) {
  return sensitiveKeyPattern.test(key) && !safeTokenTelemetryKeys.has(key);
}
