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
});

