// Streaming for Chef chat beta answers. No SDK or Express imports, so it runs in tests and the browser.

type TextChunk = { text?: string };

/**
 * Waits for the first chunk with text. Returns null when the stream ends without any, so the
 * caller can try another model. Errors before this point are thrown and can be retried too.
 */
export async function firstTextChunk(stream: AsyncIterable<TextChunk>): Promise<{ first: string; rest: AsyncIterator<TextChunk> } | null> {
  const rest = stream[Symbol.asyncIterator]();
  for (;;) {
    const { value, done } = await rest.next();
    if (done) return null;
    if (value?.text) return { first: value.text, rest };
  }
}

interface TextResponse {
  setHeader(name: string, value: string): unknown;
  flushHeaders?(): void;
  write(chunk: string): unknown;
  end(): unknown;
}

/**
 * Sends the answer as plain text while it is written. An error after the first chunk just ends the
 * response (the browser checks the answer and falls back). Returns the whole text that was sent.
 */
export async function writeTextStream(res: TextResponse, first: string, rest: AsyncIterator<TextChunk>, onError?: (err: unknown) => void): Promise<string> {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  let text = first;
  res.write(first);
  try {
    for (;;) {
      const { value, done } = await rest.next();
      if (done) break;
      if (value?.text) {
        text += value.text;
        res.write(value.text);
      }
    }
  } catch (err) {
    onError?.(err);
  }
  res.end();
  return text;
}

/** Reads a streamed text response, calling onText with everything so far after each chunk. */
export async function readTextStream(body: ReadableStream<Uint8Array>, onText: (soFar: string) => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    if (piece) {
      text += piece;
      onText(text);
    }
  }
  const tail = decoder.decode();
  if (tail) {
    text += tail;
    onText(text);
  }
  return text;
}
