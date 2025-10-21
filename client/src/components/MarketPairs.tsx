import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Star, ArrowUpDown } from "lucide-react";
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

type SortField = 'volume' | 'change' | 'symbol' | 'funding' | 'price';
type SortDirection = 'asc' | 'desc';
type TabFilter = 'favorites' | 'all';

const FAVORITES_KEY = 'astroid_favorite_markets';

export default function MarketPairs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        setFavorites(new Set(JSON.parse(saved)));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }, [favorites]);

  // Fetch markets data with 1 minute cache
  const { data: marketsData, isLoading } = useQuery<{ success: boolean; data: Market[] }>({
    queryKey: ['/api/markets'],
    refetchInterval: 60 * 1000,
    staleTime: 0,
  });

  const markets = marketsData?.data || [];

  const toggleFavorite = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(symbol)) {
        newFavorites.delete(symbol);
      } else {
        newFavorites.add(symbol);
      }
      return newFavorites;
    });
  };

  // Filter and sort markets
  const filteredAndSortedMarkets = useMemo(() => {
    let filtered = markets.filter(market => {
      const matchesSearch = market.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.baseAsset.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = activeTab === 'all' || favorites.has(market.symbol);
      
      return matchesSearch && matchesTab;
    });

    // Sort
    filtered.sort((a, b) => {
      // Always sort favorites first when on "all" tab
      if (activeTab === 'all') {
        const aIsFav = favorites.has(a.symbol);
        const bIsFav = favorites.has(b.symbol);
        
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
      }
      
      // Then sort by selected field
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
        case 'price':
          comparison = b.lastPrice - a.lastPrice;
          break;
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
      }

      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }, [markets, searchQuery, sortField, sortDirection, favorites, activeTab]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatVolume = (num: number) => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(2)}B`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  const formatPrice = (price: number, precision: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: Math.min(precision, 2),
      maximumFractionDigits: precision
    });
  };

  const formatFundingRate = (rate: number | undefined) => {
    if (rate === undefined || rate === null) return 'N/A';
    const percentage = rate * 100;
    return `${percentage >= 0 ? '' : ''}${percentage.toFixed(4)}%`;
  };

  return (
    <Card data-testid="card-market-pairs" className="border-border">
      <CardContent className="p-0">
        {/* Tabs */}
        <div className="flex items-center gap-6 px-4 sm:px-6 pt-4 sm:pt-6 border-b border-border">
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === 'favorites'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-favorites"
          >
            <Star className={`w-4 h-4 ${activeTab === 'favorites' ? 'fill-primary' : ''}`} />
            <span className="font-medium">Favorites</span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 border-b-2 transition-colors font-medium ${
              activeTab === 'all'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-all-markets"
          >
            All markets
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-border h-10 sm:h-11"
              data-testid="input-search-markets"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading markets...
          </div>
        ) : (
          <>
            {/* Desktop Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 sm:px-6 py-3 border-b border-border text-sm text-muted-foreground">
              <div className="col-span-4 lg:col-span-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('symbol')}
                  className="h-7 px-2 -ml-2 hover-elevate text-muted-foreground hover:text-foreground"
                  data-testid="button-sort-symbol"
                >
                  Symbols / Volume
                  {sortField === 'symbol' && (
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="col-span-3 lg:col-span-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('price')}
                  className="h-7 px-2 hover-elevate text-muted-foreground hover:text-foreground"
                  data-testid="button-sort-price"
                >
                  Last price
                  {sortField === 'price' && (
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="col-span-2 lg:col-span-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('change')}
                  className="h-7 px-2 hover-elevate text-muted-foreground hover:text-foreground"
                  data-testid="button-sort-change"
                >
                  24h change
                  {sortField === 'change' && (
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="col-span-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('funding')}
                  className="h-7 px-2 hover-elevate text-muted-foreground hover:text-foreground"
                  data-testid="button-sort-funding"
                >
                  Funding Rate
                  {sortField === 'funding' && (
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Mobile Table Header */}
            <div className="md:hidden grid grid-cols-12 gap-2 px-4 py-2 border-b border-border text-xs text-muted-foreground">
              <div className="col-span-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('symbol')}
                  className="h-6 px-1 -ml-1 text-xs hover-elevate text-muted-foreground"
                  data-testid="button-sort-symbol-mobile"
                >
                  Symbols / Volume
                </Button>
              </div>
              <div className="col-span-6 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('change')}
                  className="h-6 px-1 text-xs hover-elevate text-muted-foreground"
                  data-testid="button-sort-change-mobile"
                >
                  Price / 24h change
                </Button>
              </div>
            </div>

            {/* Market Rows */}
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {filteredAndSortedMarkets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery ? 'No markets found' : activeTab === 'favorites' ? 'No favorites yet' : 'No markets available'}
                </div>
              ) : (
                filteredAndSortedMarkets.map((market) => {
                  const isFavorite = favorites.has(market.symbol);
                  return (
                    <div
                      key={market.symbol}
                      className="hover-elevate transition-colors cursor-pointer"
                      data-testid={`market-row-${market.symbol}`}
                    >
                      {/* Desktop Layout */}
                      <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 sm:px-6 py-3 items-center">
                        {/* Symbol + Volume */}
                        <div className="col-span-4 lg:col-span-3 flex items-center gap-2.5">
                          <button
                            onClick={(e) => toggleFavorite(market.symbol, e)}
                            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                            data-testid={`button-favorite-${market.symbol}`}
                          >
                            <Star 
                              className={`w-4 h-4 ${isFavorite ? 'fill-primary text-primary' : ''}`}
                            />
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm" data-testid={`text-symbol-${market.symbol}`}>
                                {market.symbol}
                              </span>
                              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                                {market.maxLeverage}x
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatVolume(market.quoteVolume24h)}
                            </div>
                          </div>
                        </div>

                        {/* Last Price */}
                        <div className="col-span-3 lg:col-span-3 text-right">
                          <span className="font-mono text-sm" data-testid={`text-price-${market.symbol}`}>
                            {formatPrice(market.lastPrice, market.pricePrecision)}
                          </span>
                        </div>

                        {/* 24h Change */}
                        <div className="col-span-2 lg:col-span-3 text-right">
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

                        {/* Funding Rate */}
                        <div className="col-span-3 text-right">
                          <span 
                            className={`font-mono text-sm ${
                              market.fundingRate !== undefined && market.fundingRate !== null
                                ? market.fundingRate >= 0 
                                  ? 'text-foreground' 
                                  : 'text-foreground'
                                : 'text-muted-foreground'
                            }`}
                            data-testid={`text-funding-${market.symbol}`}
                          >
                            {formatFundingRate(market.fundingRate)}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Layout */}
                      <div className="md:hidden grid grid-cols-12 gap-2 px-4 py-3 items-center">
                        {/* Symbol + Volume */}
                        <div className="col-span-6 flex items-center gap-2">
                          <button
                            onClick={(e) => toggleFavorite(market.symbol, e)}
                            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                            data-testid={`button-favorite-mobile-${market.symbol}`}
                          >
                            <Star 
                              className={`w-3.5 h-3.5 ${isFavorite ? 'fill-primary text-primary' : ''}`}
                            />
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs" data-testid={`text-symbol-mobile-${market.symbol}`}>
                                {market.symbol}
                              </span>
                              <Badge variant="secondary" className="text-xs h-4 px-1">
                                {market.maxLeverage}x
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatVolume(market.quoteVolume24h)}
                            </div>
                          </div>
                        </div>

                        {/* Price + 24h Change */}
                        <div className="col-span-6 text-right">
                          <div className="font-mono text-xs mb-0.5">
                            {formatPrice(market.lastPrice, market.pricePrecision)}
                          </div>
                          <div
                            className={`font-mono text-xs font-medium ${
                              market.priceChangePercent24h >= 0 ? 'text-primary' : 'text-destructive'
                            }`}
                          >
                            {market.priceChangePercent24h >= 0 ? '+' : ''}
                            {market.priceChangePercent24h.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary */}
            {filteredAndSortedMarkets.length > 0 && (
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-border text-xs text-muted-foreground">
                <span>
                  {filteredAndSortedMarkets.length} market{filteredAndSortedMarkets.length !== 1 ? 's' : ''}
                </span>
                <span className="hidden sm:inline">
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
