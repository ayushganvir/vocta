import type { JobPayload, JobResult } from "../jobs/types";
import type { ProviderAdapter, ProviderBuiltRequest } from "./types";

export async function runProvider<
  TInput extends JobPayload,
  TBuiltRequest extends ProviderBuiltRequest,
  TRawResponse,
  TResult extends JobResult
>(adapter: ProviderAdapter<TInput, TBuiltRequest, TRawResponse, TResult>, input: TInput): Promise<TResult> {
  const validation = adapter.validateInput(input);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const request = adapter.buildRequest(input);
  const response = await adapter.execute(request);
  return adapter.parseResponse(response, request);
}
