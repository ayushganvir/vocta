import { describe, expect, it } from "vitest";
import { redactPayload } from "./redaction";

describe("redactPayload", () => {
  it("redacts nested sensitive keys", () => {
    const result = redactPayload({
      apiKey: "secret",
      headers: {
        authorization: "Bearer secret",
        safe: "visible"
      },
      nested: [{ signedUrl: "https://example.com?signature=secret" }]
    });

    expect(result).toEqual({
      apiKey: "[REDACTED]",
      headers: {
        authorization: "[REDACTED]",
        safe: "visible"
      },
      nested: [{ signedUrl: "[REDACTED]" }]
    });
  });

  it("redacts bearer values and signed urls even under safe-looking keys", () => {
    const result = redactPayload({
      callbackUrl: "https://storage.example.com/file.png?X-Amz-Signature=abc&X-Amz-Credential=def",
      passthroughHeader: "Bearer secret-token",
      publicUrl: "https://example.com/file.png",
      nested: {
        tokenValue: "visible-by-key-redaction"
      }
    });

    expect(result).toEqual({
      callbackUrl: "[REDACTED_URL]",
      passthroughHeader: "[REDACTED]",
      publicUrl: "https://example.com/file.png",
      nested: {
        tokenValue: "[REDACTED]"
      }
    });
  });

  it("keeps non-secret token budget and usage fields visible", () => {
    const result = redactPayload({
      max_output_tokens: 8,
      usage: {
        input_tokens: 12,
        output_tokens: 1,
        total_tokens: 13
      },
      access_token: "secret"
    });

    expect(result).toEqual({
      max_output_tokens: 8,
      usage: {
        input_tokens: 12,
        output_tokens: 1,
        total_tokens: 13
      },
      access_token: "[REDACTED]"
    });
  });
});
