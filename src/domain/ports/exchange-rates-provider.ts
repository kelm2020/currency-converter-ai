import type { ExchangeSnapshot } from '@/domain/entities/exchange-snapshot';

export interface ExchangeRatesProviderPort {
  getExchangeSnapshot(baseCurrency: string): Promise<ExchangeSnapshot>;
}
