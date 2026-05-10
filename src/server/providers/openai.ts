import { redactPayload } from "./redaction";
import type { ImageJobPayload, ImageJobResult, PromptJobPayload, PromptJobResult } from "../jobs/types";
import type { ProviderAdapter, ProviderBuiltRequest } from "./types";

type OpenAiImageRequest = ProviderBuiltRequest & {
  metadata: {
    providerMode: "real";
    configuredProvider: "openai";
    api: "images";
  };
};

type OpenAiTextRequest = ProviderBuiltRequest & {
  metadata: {
    providerMode: "real";
    configuredProvider: "openai";
    api: "responses";
  };
};

type OpenAiImageRawResponse = {
  created?: number;
  data?: Array<{ b64_json?: string; url?: string }>;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
};

type OpenAiTextRawResponse = {
  id?: string;
  output_text?: string;
  usage?: Record<string, unknown>;
  output?: Array<{
    content?: Array<{ text?: string; type?: string }>;
  }>;
  [key: string]: unknown;
};

export function createOpenAiImageProvider(model: string): ProviderAdapter<ImageJobPayload, OpenAiImageRequest, OpenAiImageRawResponse, ImageJobResult> {
  return {
    provider: "openai",
    model,
    kind: "image",
    capabilities: ["image-generation", "image-9-16", "image-references"],
    validateInput(input) {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (input.jobType !== "image") errors.push("OpenAI image provider only accepts image jobs.");
      if (!input.prompt.trim()) errors.push("Image prompt is required.");
      if (input.references?.length) {
        warnings.push("Reference image editing is not wired in MVP; this adapter uses text-to-image generation.");
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    buildRequest(input) {
      return {
        url: "https://api.openai.com/v1/images/generations",
        method: "POST",
        headers: {
          authorization: `Bearer ${openAiApiKey()}`,
          "content-type": "application/json"
        },
        body: {
          model,
          prompt: input.negativePrompt ? `${input.prompt}\n\nNegative prompt: ${input.negativePrompt}` : input.prompt,
          n: 1,
          size: openAiImageSize(input.aspectRatio),
          quality: "low",
          output_format: "png",
          response_format: "b64_json",
          user: input.projectId
        },
        metadata: {
          providerMode: "real",
          configuredProvider: "openai",
          api: "images"
        }
      };
    },
    async execute(request) {
      if (!openAiApiKey()) {
        throw new Error("OPENAI_KEY or OPENAI_API_KEY is required when real OpenAI image generation is enabled.");
      }

      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body)
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(`OpenAI image request failed with ${response.status}: ${JSON.stringify(body)}`);
      }

      return body as OpenAiImageRawResponse;
    },
    parseResponse(response, request) {
      const image = response.data?.[0];
      const bytes = image?.b64_json ? Uint8Array.from(Buffer.from(image.b64_json, "base64")) : undefined;
      const size = String(request.body.size ?? "1024x1536");
      const { width, height } = sizeToDimensions(size);

      return {
        jobType: "image",
        provider: "openai",
        model,
        completedAt: new Date().toISOString(),
        summary: "OpenAI image generation completed.",
        warnings: bytes ? [] : [{ code: "openai.image_missing", message: "No b64 image payload was found in the OpenAI response.", severity: "warning" }],
        metadata: {
          providerMode: "real",
          responseId: response.created,
          usage: response.usage ?? null
        },
        assets: [
          {
            assetType: "image",
            fileName: "openai-image.png",
            mimeType: "image/png",
            bytes,
            metadata: {
              width,
              height,
              size,
              promptPreview: String(request.body.prompt ?? "").slice(0, 180),
              usage: response.usage ?? null
            }
          }
        ],
        costEstimate: {
          currency: "USD",
          amount: 0,
          billableUnits: {}
        }
      };
    },
    estimateCost() {
      return {
        currency: "USD",
        amount: 0,
        billableUnits: {}
      };
    },
    redactPayload
  };
}

export function createOpenAiTextProvider(model: string): ProviderAdapter<PromptJobPayload, OpenAiTextRequest, OpenAiTextRawResponse, PromptJobResult> {
  return {
    provider: "openai",
    model,
    kind: "text",
    capabilities: ["text-json", "text-responses"],
    validateInput(input) {
      const errors: string[] = [];

      if (input.jobType !== "prompt") errors.push("OpenAI text adapter currently supports prompt jobs only.");
      if (!input.promptLayers.length) errors.push("Prompt layers are required.");

      return { valid: errors.length === 0, errors, warnings: [] };
    },
    buildRequest(input) {
      const sortedLayers = [...input.promptLayers].sort((a, b) => a.orderIndex - b.orderIndex);

      return {
        url: "https://api.openai.com/v1/responses",
        method: "POST",
        headers: {
          authorization: `Bearer ${openAiApiKey()}`,
          "content-type": "application/json"
        },
        body: {
          model,
          instructions: "Compile the provided production prompt layers into a concise final generation prompt. Return only the compiled prompt text.",
          input: sortedLayers.map((layer) => `[${layer.label}] ${layer.content}`).join("\n\n"),
          max_output_tokens: 300
        },
        metadata: {
          providerMode: "real",
          configuredProvider: "openai",
          api: "responses"
        }
      };
    },
    async execute(request) {
      if (!openAiApiKey()) {
        throw new Error("OPENAI_KEY or OPENAI_API_KEY is required when real OpenAI text generation is enabled.");
      }

      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body)
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(`OpenAI text request failed with ${response.status}: ${JSON.stringify(body)}`);
      }

      return body as OpenAiTextRawResponse;
    },
    parseResponse(response, request) {
      const compiledPrompt = response.output_text ?? extractOutputText(response) ?? "";
      const input = String(request.body.input ?? "");

      return {
        jobType: "prompt",
        provider: "openai",
        model,
        completedAt: new Date().toISOString(),
        summary: "OpenAI prompt compilation completed.",
        warnings: compiledPrompt ? [] : [{ code: "openai.text_missing", message: "No text output was found in the OpenAI response.", severity: "warning" }],
        metadata: {
          providerMode: "real",
          responseId: response.id ?? null
        },
        compiledPrompt,
        layerBreakdown: input.split("\n\n").map((content) => ({
          label: content.match(/^\[([^\]]+)\]/)?.[1] ?? "Layer",
          included: content.trim().length > 0,
          tokenEstimate: Math.ceil(content.length / 4)
        })),
        costEstimate: {
          currency: "USD",
          amount: 0,
          billableUnits: {}
        }
      };
    },
    estimateCost(input) {
      const inputCharacters = input.promptLayers.reduce((sum, layer) => sum + layer.content.length, 0);

      return {
        currency: "USD",
        amount: 0,
        billableUnits: {
          inputCharacters
        }
      };
    },
    redactPayload
  };
}

function openAiApiKey() {
  return process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? "";
}

function openAiImageSize(aspectRatio: ImageJobPayload["aspectRatio"]) {
  if (aspectRatio === "16:9") return "1536x1024";
  if (aspectRatio === "1:1") return "1024x1024";
  return "1024x1536";
}

function sizeToDimensions(size: string) {
  const [width, height] = size.split("x").map((value) => Number.parseInt(value, 10));
  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null
  };
}

function extractOutputText(response: OpenAiTextRawResponse) {
  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }
  return null;
}
