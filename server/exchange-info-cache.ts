import type { AsterdexClient } from './asterdex-client';

interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
  maxLeverage?: number;
  minNotional?: string;
  filters?: any[];
}

interface ExchangeInfoData {
  symbols: SymbolInfo[];
  rateLimits: any[];
  exchangeFilters: any[];
  timestamp: number;
}

export class ExchangeInfoCache {
  private cache: ExchangeInfoData | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private fetchPromise: Promise<ExchangeInfoData> | null = null;

  constructor(private client: AsterdexClient) {}

  async getExchangeInfo(): Promise<ExchangeInfoData> {
    const now = Date.now();

    // Return cached data if still valid
    if (this.cache && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.cache;
    }

    // If already fetching, wait for that request
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Fetch new data
    this.fetchPromise = this.fetchExchangeInfoData();
    
    try {
      const data = await this.fetchPromise;
      this.cache = data;
      this.lastFetch = now;
      return data;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async fetchExchangeInfoData(): Promise<ExchangeInfoData> {
    const exchangeInfo = await this.client.getExchangeInfo();
    
    return {
      symbols: exchangeInfo.symbols || [],
      rateLimits: exchangeInfo.rateLimits || [],
      exchangeFilters: exchangeInfo.exchangeFilters || [],
      timestamp: Date.now(),
    };
  }

  async getAvailableMarkets(): Promise<Array<{
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    status: string;
    maxLeverage?: number;
    pricePrecision: number;
    quantityPrecision: number;
  }>> {
    const info = await this.getExchangeInfo();
    
    // Filter only TRADING symbols
    return info.symbols
      .filter(s => s.status === 'TRADING')
      .map(s => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        status: s.status,
        maxLeverage: s.maxLeverage,
        pricePrecision: s.pricePrecision,
        quantityPrecision: s.quantityPrecision,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  clearCache(): void {
    this.cache = null;
    this.lastFetch = 0;
  }
}
