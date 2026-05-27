import { describe, it, expect, vi } from 'vitest';
import { parseSSEStream } from '../store/hooks/useSSEStream';

// Helper to mock readable stream
function createMockResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });

  return {
    body: stream,
  } as unknown as Response;
}

describe('parseSSEStream', () => {
  it('correctly dispatches different event types', async () => {
    const chunks = [
      'event: text\ndata: "Hello"\n\n',
      'event: thinking\ndata: "Analyzing request..."\n\n',
      'event: status\ndata: "Deploying agent"\n\n',
      'event: done\ndata: {}\n\n'
    ];

    const response = createMockResponse(chunks);

    const handlers = {
      onText: vi.fn(),
      onThinking: vi.fn(),
      onStatus: vi.fn(),
      onMetadata: vi.fn(),
      onToolApproval: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    };

    await parseSSEStream(response, handlers);

    expect(handlers.onText).toHaveBeenCalledWith('Hello');
    expect(handlers.onThinking).toHaveBeenCalledWith('Analyzing request...');
    expect(handlers.onStatus).toHaveBeenCalledWith('Deploying agent');
    expect(handlers.onDone).toHaveBeenCalled();
  });

  it('gracefully handles malformed JSON data', async () => {
    const chunks = [
      'event: text\ndata: {invalid json}\n\n',
      'event: text\ndata: "Valid text"\n\n'
    ];

    const response = createMockResponse(chunks);

    const handlers = {
      onText: vi.fn(),
      onThinking: vi.fn(),
      onStatus: vi.fn(),
      onMetadata: vi.fn(),
      onToolApproval: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    };

    await parseSSEStream(response, handlers);

    expect(handlers.onText).toHaveBeenCalledTimes(1);
    expect(handlers.onText).toHaveBeenCalledWith('Valid text');
  });
});
