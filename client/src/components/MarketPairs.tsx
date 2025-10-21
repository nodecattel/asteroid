import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Market {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  maxLeverage: number;
  pricePrecision: number;
  quantityPrecision: number;
  volume24h: number;
  quoteVolume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  lastPrice: number;
  fundingRate?: number;
}

type SortField = 'volume' | 'change' | 'symbol' | 'funding';
type SortDirection = 'asc' | 'desc';

export default function MarketPairs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch markets data
  const { data: marketsData, isLoading } = useQuery<{ success: boolean; data: Market[] }>({
    queryKey: ['/api/markets'],
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  const markets = marketsData?.data || [];

  // Filter and sort markets
  const filteredAndSortedMarkets = useMemo(() => {
    let filtered = markets.filter(market =>
      market.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      market.baseAsset.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'volume':
          comparison = b.quoteVolume24h - a.quoteVolume24h;
          break;
        case 'change':
          comparison = b.priceChangePercent24h - a.priceChangePercent24h;
          break;
        case 'funding':
          const aFunding = a.fundingRate || 0;
          const bFunding = b.fundingRate || 0;
          comparison = bFunding - aFunding;
          break;
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
      }

      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }, [markets, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(2)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    }
    return `$${num.toFixed(decimals)}`;
  };

  const formatFundingRate = (rate: number | undefined) => {
    if (rate === undefined || rate === null) return 'N/A';
    const percentage = rate * 100;
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(4)}%`;
  };

  return (
    <Card data-testid="card-market-pairs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold">Market Pairs</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-markets"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading markets...
          </div>
        ) : (
          <>
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('symbol')}
                  className="h-6 px-2 -ml-2 hover-elevate"
                  data-testid="button-sort-symbol"
                >
                  Symbol
                  {sortField === 'symbol' && (
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('change')}
                  className="h-6 px-2 -ml-2 hover-elevate"
                  data-testid="button-sort-change"
                >
                  24h Change
                  {sortField === 'change' && (
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="col-span-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('volume')}
                  className="h-6 px-2 -ml-2 hover-elevate"
                  data-testid="button-sort-volume"
                >
                  24h Volume
                  {sortField === 'volume' && (
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="col-span-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('funding')}
                  className="h-6 px-2 -ml-2 hover-elevate"
                  data-testid="button-sort-funding"
                >
                  Funding Rate
                  {sortField === 'funding' && (
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Market Rows */}
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {filteredAndSortedMarkets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No markets found matching your search' : 'No markets available'}
                </div>
              ) : (
                filteredAndSortedMarkets.map((market) => (
                  <div
                    key={market.symbol}
                    className="grid grid-cols-12 gap-3 px-3 py-3 hover-elevate transition-colors"
                    data-testid={`market-row-${market.symbol}`}
                  >
                    {/* Symbol with Leverage Badge */}
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm" data-testid={`text-symbol-${market.symbol}`}>
                            {market.baseAsset}
                            <span className="text-muted-foreground">/{market.quoteAsset}</span>
                          </span>
                          <Badge variant="secondary" className="font-mono text-xs h-5" data-testid={`badge-leverage-${market.symbol}`}>
                            {market.maxLeverage}x
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="col-span-2 flex items-center justify-end">
                      <span className="font-mono text-sm" data-testid={`text-price-${market.symbol}`}>
                        ${market.lastPrice.toFixed(market.pricePrecision)}
                      </span>
                    </div>

                    {/* 24h Change */}
                    <div className="col-span-2 flex items-center">
                      <div className="flex items-center gap-1">
                        {market.priceChangePercent24h >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span
                          className={`font-mono text-sm font-medium ${
                            market.priceChangePercent24h >= 0 ? 'text-primary' : 'text-destructive'
                          }`}
                          data-testid={`text-change-${market.symbol}`}
                        >
                          {market.priceChangePercent24h >= 0 ? '+' : ''}
                          {market.priceChangePercent24h.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* 24h Volume */}
                    <div className="col-span-3 flex items-center">
                      <span className="font-mono text-sm" data-testid={`text-volume-${market.symbol}`}>
                        {formatNumber(market.quoteVolume24h)}
                      </span>
                    </div>

                    {/* Funding Rate */}
                    <div className="col-span-2 flex items-center">
                      <span 
                        className={`font-mono text-sm ${
                          market.fundingRate !== undefined && market.fundingRate !== null
                            ? market.fundingRate >= 0 
                              ? 'text-primary' 
                              : 'text-destructive'
                            : 'text-muted-foreground'
                        }`}
                        data-testid={`text-funding-${market.symbol}`}
                      >
                        {formatFundingRate(market.fundingRate)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Summary */}
            {filteredAndSortedMarkets.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-muted-foreground mt-2">
                <span>
                  Showing {filteredAndSortedMarkets.length} of {markets.length} markets
                </span>
                <span>
                  Updated: {new Date().toLocaleTimeString()}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
