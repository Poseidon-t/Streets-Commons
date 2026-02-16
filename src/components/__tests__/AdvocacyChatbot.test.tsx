/**
 * AdvocacyChatbot Component Tests
 *
 * Tests the floating chat widget: open/close, quick prompts, message sending,
 * SSE streaming, error handling, and UI state.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdvocacyChatbot from '../AdvocacyChatbot';
import type { Location, WalkabilityMetrics, DataQuality } from '../../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockLocation: Location = {
  lat: 40.7580,
  lon: -73.9855,
  displayName: 'Midtown Manhattan, New York, NY, USA',
};

const mockMetrics: WalkabilityMetrics = {
  crossingSafety: 7.5,
  sidewalkCoverage: 8.2,
  speedExposure: 6.0,
  destinationAccess: 9.0,
  nightSafety: 5.0,
  slope: 9,
  treeCanopy: 4,
  thermalComfort: 4.5,
  overallScore: 6.5,
  label: 'Good',
};

const mockDataQuality: DataQuality = {
  crossingCount: 45,
  streetCount: 80,
  sidewalkCount: 30,
  poiCount: 25,
  confidence: 'high',
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

/** Build a fake ReadableStream that sends SSE chunks */
function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

function mockStreamResponse(text: string) {
  const words = text.split(' ');
  const chunks = words.map(w => `data: ${JSON.stringify({ text: w + ' ' })}\n\n`);
  chunks.push('data: [DONE]\n\n');

  mockFetch.mockResolvedValueOnce({
    ok: true,
    body: createSSEStream(chunks),
  });
}

function mockErrorResponse(status: number, message: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdvocacyChatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Floating button and toggle', () => {
    it('should render the floating button when closed', () => {
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      expect(screen.getByLabelText('Open urbanist advocate')).toBeInTheDocument();
    });

    it('should show notification dot for first-time users', () => {
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      // The span with bg-red-500 is the notification dot
      const button = screen.getByLabelText('Open urbanist advocate');
      const dot = button.querySelector('.bg-red-500');
      expect(dot).toBeTruthy();
    });

    it('should open the chat panel when button is clicked', () => {
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      expect(screen.getByText('Meridian')).toBeInTheDocument();
    });

    it('should close the chat panel when close button is clicked', () => {
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      expect(screen.getByText('Meridian')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close chat'));
      expect(screen.queryByText('Meridian')).not.toBeInTheDocument();
    });
  });

  describe('Welcome state and quick prompts', () => {
    it('should show welcome message with location name', () => {
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      expect(screen.getByText('Streets belong to people.')).toBeInTheDocument();
      expect(screen.getByText('Midtown Manhattan')).toBeInTheDocument();
    });

    it('should display all 8 quick prompts', () => {
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));

      const expectedPrompts = [
        'What story do my scores tell?',
        'What would Jane Jacobs say about this street?',
        "What's the single biggest win for this neighborhood?",
        'Help me build a case for my city council',
        'How does this compare to global standards?',
        'Draft a sharp social media post',
        'What tactical urbanism could work here?',
        'Who is being failed by this street design?',
      ];

      expectedPrompts.forEach(prompt => {
        expect(screen.getByText(prompt)).toBeInTheDocument();
      });
    });

    it('should send a quick prompt when clicked', async () => {
      mockStreamResponse('Great question about your scores.');

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('What story do my scores tell?'));

      // User message should appear
      await waitFor(() => {
        expect(screen.getByText('What story do my scores tell?')).toBeInTheDocument();
      });

      // Verify fetch was called with correct payload
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/chat');
      const body = JSON.parse(options.body);
      expect(body.messages[0].content).toBe('What story do my scores tell?');
      expect(body.context.locationName).toBe('Midtown Manhattan, New York, NY, USA');
      expect(body.context.metrics).toEqual(mockMetrics);
    });
  });

  describe('Message sending', () => {
    it('should send typed message on submit', async () => {
      mockStreamResponse('Here is my response.');

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));

      const input = screen.getByPlaceholderText('Ask about streets, standards, advocacy...');
      fireEvent.change(input, { target: { value: 'How walkable is this area?' } });

      const form = input.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('How walkable is this area?')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not send empty messages', () => {
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));

      const input = screen.getByPlaceholderText('Ask about streets, standards, advocacy...');
      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not send whitespace-only messages', () => {
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));

      const input = screen.getByPlaceholderText('Ask about streets, standards, advocacy...');
      fireEvent.change(input, { target: { value: '   ' } });
      const form = input.closest('form')!;
      fireEvent.submit(form);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should clear input after sending', async () => {
      mockStreamResponse('Response text.');

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));

      const input = screen.getByPlaceholderText('Ask about streets, standards, advocacy...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('SSE streaming', () => {
    it('should stream assistant response into the chat', async () => {
      mockStreamResponse('Walking infrastructure matters for equity.');

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('What story do my scores tell?'));

      // Wait for streamed response to appear
      await waitFor(() => {
        const text = document.body.textContent || '';
        expect(text).toContain('Walking');
      }, { timeout: 3000 });
    });

    it('should show loading dots while streaming', async () => {
      // Use a fetch that never resolves to keep streaming state
      mockFetch.mockReturnValueOnce(new Promise(() => {}));

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('What story do my scores tell?'));

      // While streaming, input placeholder should change
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Thinking...')).toBeInTheDocument();
      });
    });

    it('should disable input while streaming', async () => {
      mockFetch.mockReturnValueOnce(new Promise(() => {}));

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('What story do my scores tell?'));

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Thinking...');
        expect(input).toBeDisabled();
      });
    });
  });

  describe('Error handling', () => {
    it('should show error message on API failure', async () => {
      mockErrorResponse(500, 'Internal server error');

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('What story do my scores tell?'));

      await waitFor(() => {
        const text = document.body.textContent || '';
        expect(text).toContain("couldn't respond");
      }, { timeout: 3000 });
    });

    it('should show error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('What story do my scores tell?'));

      await waitFor(() => {
        const text = document.body.textContent || '';
        expect(text).toContain("couldn't respond");
      }, { timeout: 3000 });
    });
  });

  describe('Context passing', () => {
    it('should pass metrics and location to the API', async () => {
      mockStreamResponse('Analysis complete.');

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('How does this compare to global standards?'));

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.context).toEqual({
        locationName: 'Midtown Manhattan, New York, NY, USA',
        metrics: mockMetrics,
        dataQuality: mockDataQuality,
      });
    });

    it('should include full message history in subsequent requests', async () => {
      // First message
      mockStreamResponse('First response.');

      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('What story do my scores tell?'));

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      // Wait for streaming to finish
      await waitFor(() => {
        const input = screen.queryByPlaceholderText('Ask about streets, standards, advocacy...');
        expect(input).toBeTruthy();
      }, { timeout: 3000 });

      // Second message
      mockStreamResponse('Follow up response.');

      const input = screen.getByPlaceholderText('Ask about streets, standards, advocacy...');
      fireEvent.change(input, { target: { value: 'Tell me more' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      // Should have 3 messages: user1, assistant1, user2
      expect(secondBody.messages.length).toBe(3);
      expect(secondBody.messages[0].role).toBe('user');
      expect(secondBody.messages[1].role).toBe('assistant');
      expect(secondBody.messages[2].role).toBe('user');
      expect(secondBody.messages[2].content).toBe('Tell me more');
    });
  });

  describe('Multi-turn conversation', () => {
    it('should handle 3 turns of conversation', async () => {
      // Turn 1
      mockStreamResponse('Answer one.');
      render(
        <AdvocacyChatbot location={mockLocation} metrics={mockMetrics} dataQuality={mockDataQuality} />
      );
      fireEvent.click(screen.getByLabelText('Open urbanist advocate'));
      fireEvent.click(screen.getByText('What story do my scores tell?'));

      await waitFor(() => {
        const input = screen.queryByPlaceholderText('Ask about streets, standards, advocacy...');
        return input && !((input as HTMLInputElement).disabled);
      }, { timeout: 3000 });

      // Turn 2
      mockStreamResponse('Answer two.');
      const input2 = screen.getByPlaceholderText('Ask about streets, standards, advocacy...');
      fireEvent.change(input2, { target: { value: 'What about safety?' } });
      fireEvent.submit(input2.closest('form')!);

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
      await waitFor(() => {
        const input = screen.queryByPlaceholderText('Ask about streets, standards, advocacy...');
        return input && !((input as HTMLInputElement).disabled);
      }, { timeout: 3000 });

      // Turn 3
      mockStreamResponse('Answer three.');
      const input3 = screen.getByPlaceholderText('Ask about streets, standards, advocacy...');
      fireEvent.change(input3, { target: { value: 'Draft a letter' } });
      fireEvent.submit(input3.closest('form')!);

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));

      // Verify 3rd call has full history (5 messages: u1, a1, u2, a2, u3)
      const thirdBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(thirdBody.messages.length).toBe(5);
    });
  });
});
