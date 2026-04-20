import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CurrencyConverterApp from './CurrencyConverterApp';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';

// Create a custom QueryClient for tests with retries disabled
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const ProvidersTest = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// 1. Configure MSW (Mock Service Worker) for BFF endpoint
const server = setupServer(
  http.get('/api/exchange', () => {
    return HttpResponse.json({
      base: 'USD',
      timestamp: '2025-08-08',
      rates: [
        { code: 'USD', rate: 1, name: 'US Dollar', symbol: '$' },
        { code: 'EUR', rate: 0.85, name: 'Euro', symbol: '€' }
      ]
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CurrencyConverter Integration', () => {
  it('shows loading state and then renders conversion result', async () => {
    render(
      <ProvidersTest>
        <CurrencyConverterApp />
      </ProvidersTest>
    );

    expect(screen.getByRole('spinbutton', { name: /^Amount$/i })).toBeInTheDocument();

    // Wait for the mock API response to be processed
    await waitFor(() => {
      // The new UI uses "=" instead of "equals" according to the PDF design
      const resultElement = screen.getByText(/US Dollar =/i);
      expect(resultElement).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByRole('heading', { name: /0.85 Euro/i })).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get('/api/exchange', () => {
        return HttpResponse.json(
          {
            type: 'https://app.currency-converter.com/errors/internal_server_error',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Market connection lost',
            code: 'INTERNAL_SERVER_ERROR',
            severity: 'error',
          },
          { status: 500 }
        );
      })
    );

    render(
      <ProvidersTest>
        <CurrencyConverterApp />
      </ProvidersTest>
    );

    await waitFor(() => {
      expect(screen.getByText(/Market connection lost/i)).toBeInTheDocument();
    });
  });

  it('allows swapping currencies', async () => {
    const { container } = render(
      <ProvidersTest>
        <CurrencyConverterApp />
      </ProvidersTest>
    );

    // Wait for data
    await waitFor(() => screen.getByText(/US Dollar =/i));

    const swapButton = container.querySelector('button[aria-label="Swap currencies"]');
    if (!swapButton) throw new Error('Swap button not found');

    // Click swap
    fireEvent.click(swapButton);

    // Verify it swapped (should show Euro = US Dollar now)
    await waitFor(() => {
      expect(screen.getByText(/Euro =/i)).toBeInTheDocument();
    });
  });

  it('allows changing current base currency', async () => {
    render(
      <ProvidersTest>
        <CurrencyConverterApp />
      </ProvidersTest>
    );

    // Wait for data
    await waitFor(() => screen.getByText(/US Dollar =/i));

    // Get the first selector (From)
    const selectors = screen.getAllByRole('combobox');
    
    // Change "From" to EUR
    fireEvent.change(selectors[0], { target: { value: 'EUR' } });

    // Verify it changed
    await waitFor(() => {
      expect(screen.getByText(/Euro =/i)).toBeInTheDocument();
    });
  });
});
