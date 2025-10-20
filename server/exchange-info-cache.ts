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

interface TickerInfo {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
}

interface ExchangeInfoData {
  symbols: SymbolInfo[];
  rateLimits: any[];
  exchangeFilters: any[];
  timestamp: number;
}

interface EnrichedMarket {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  maxLeverage?: number;
  pricePrecision: number;
  quantityPrecision: number;
  volume24h: number;
  quoteVolume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  lastPrice: number;
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

  async getAvailableMarkets(): Promise<EnrichedMarket[]> {
    const info = await this.getExchangeInfo();
    
    // Fetch 24hr ticker data for all symbols
    let tickers: TickerInfo[] = [];
    try {
      const tickerData = await this.client.get24hrTicker();
      tickers = Array.isArray(tickerData) ? tickerData : [tickerData];
    } catch (error) {
      console.error('Failed to fetch 24hr ticker data:', error);
      // Continue without ticker data if it fails
    }
    
    // Create a map of symbol to ticker data for quick lookup
    const tickerMap = new Map<string, TickerInfo>();
    tickers.forEach(t => tickerMap.set(t.symbol, t));
    
    // Filter only TRADING symbols and enrich with ticker data
    const enrichedMarkets = info.symbols
      .filter(s => s.status === 'TRADING')
      .map(s => {
        const ticker = tickerMap.get(s.symbol);
        return {
          symbol: s.symbol,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          status: s.status,
          maxLeverage: s.maxLeverage,
          pricePrecision: s.pricePrecision,
          quantityPrecision: s.quantityPrecision,
          volume24h: ticker ? parseFloat(ticker.volume) : 0,
          quoteVolume24h: ticker ? parseFloat(ticker.quoteVolume) : 0,
          priceChange24h: ticker ? parseFloat(ticker.priceChange) : 0,
          priceChangePercent24h: ticker ? parseFloat(ticker.priceChangePercent) : 0,
          lastPrice: ticker ? parseFloat(ticker.lastPrice) : 0,
        };
      });
    
    // Sort by 24h quote volume (highest first)
    return enrichedMarkets.sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
  }

  clearCache(): void {
    this.cache = null;
    this.lastFetch = 0;
  }
}
