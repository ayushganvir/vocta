export async function GET(_request: Request, context: { params: Promise<{ previewId: string }> }) {
  const { previewId } = await context.params;
  const bytes = new TextEncoder().encode(`FAKE_GOOGLE_TTS_PREVIEW\n${previewId}\n`);

  return new Response(bytes, {
    headers: {
      "content-type": "audio/wav",
      "cache-control": "no-store"
    }
  });
}

