import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Play, Pause, Square, Trash2, Info, TrendingUp, Target, Settings, Zap, Pencil } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface BotSelectorProps {
  bots: any[];
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
  initialSymbol?: string;
  onSymbolUsed?: () => void;
}

export default function BotSelector({ bots, selectedBotId, onSelectBot, initialSymbol, onSymbolUsed }: BotSelectorProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { toast } = useToast();

  // Fetch available markets from exchange info
  const { data: marketsData } = useQuery<{ success: boolean; data: Array<{
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
  }> }>({
    queryKey: ['/api/markets'],
    refetchInterval: 60 * 1000, // Refresh every 60 seconds for fresh data
    staleTime: 0, // Consider data stale immediately
  });

  const availableMarkets = marketsData?.data || [];

  // Format large numbers (volume)
  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toFixed(2);
  };

  const [formData, setFormData] = useState({
    marketSymbol: '',
    leverage: 5,
    investmentUsdt: 10,
    targetVolume: 100000,
    maxLoss: 10,
    targetHours: 24,
    firstOrderSpreadBps: 5,
    orderSpacingBps: 2,
    ordersPerSide: 3,
    orderSizePercent: 25,
    refreshInterval: 60,
    tradingBias: 'neutral' as 'neutral' | 'long' | 'short',
    longBiasPercent: 50,
    delayBetweenOrders: 0.05,
    delayAfterCancel: 0.3,
    maxOrdersToPlace: 10,
    usePostOnly: false,
    tradingFeePercent: 0.2,
    // Risk Management
    enableStopLoss: true,
    stopLossPercent: 2.0,
    enableTakeProfit: true,
    takeProfitPercent: 5.0,
    enableTrailingStop: false,
    trailingStopCallbackRate: 1.0,
    trailingStopActivationPercent: 2.0,
    circuitBreakerEnabled: true,
    circuitBreakerThreshold: 20.0,
    earlyWarningThreshold50: true,
    earlyWarningThreshold75: true,
  });

  // Get selected market info for max leverage
  const selectedMarket = availableMarkets.find(m => m.symbol === formData.marketSymbol);
  const maxLeverage = selectedMarket?.maxLeverage || 125;

  // Initialize market selection when markets data loads
  useEffect(() => {
    if (availableMarkets.length > 0 && !formData.marketSymbol) {
      setFormData(prev => ({
        ...prev,
        marketSymbol: availableMarkets[0].symbol,
      }));
    }
  }, [availableMarkets.length]);

  // Handle initialSymbol prop - open create dialog with pre-selected symbol
  useEffect(() => {
    if (initialSymbol && availableMarkets.length > 0) {
      const symbolExists = availableMarkets.some(m => m.symbol === initialSymbol);
      if (symbolExists) {
        setFormData(prev => ({
          ...prev,
          marketSymbol: initialSymbol,
        }));
        setIsCreateOpen(true);
        if (onSymbolUsed) {
          onSymbolUsed();
        }
      }
    }
  }, [initialSymbol, availableMarkets, onSymbolUsed]);

  // When market changes, ensure leverage doesn't exceed new market's max
  useEffect(() => {
    if (selectedMarket?.maxLeverage && formData.leverage > selectedMarket.maxLeverage) {
      setFormData(prev => ({
        ...prev,
        leverage: selectedMarket.maxLeverage || 5,
      }));
    }
  }, [formData.marketSymbol, selectedMarket?.maxLeverage]);

  const createBotMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/bots', data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      setIsCreateOpen(false);
      toast({ title: "Bot created successfully" });
      if (data?.data?.botId) {
        onSelectBot(data.data.botId);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create bot", description: error.message, variant: "destructive" });
    },
  });

  const startBotMutation = useMutation({
    mutationFn: async (botId: string) => {
      await apiRequest('POST', `/api/bots/${botId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      toast({ title: "Bot started" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start bot", description: error.message, variant: "destructive" });
    },
  });

  const pauseBotMutation = useMutation({
    mutationFn: async (botId: string) => {
      await apiRequest('POST', `/api/bots/${botId}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      toast({ title: "Bot paused" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to pause bot", description: error.message, variant: "destructive" });
    },
  });

  const stopBotMutation = useMutation({
    mutationFn: async (botId: string) => {
      await apiRequest('POST', `/api/bots/${botId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      toast({ title: "Bot stopped" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to stop bot", description: error.message, variant: "destructive" });
    },
  });

  const deleteBotMutation = useMutation({
    mutationFn: async (botId: string) => {
      await apiRequest('DELETE', `/api/bots/${botId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      toast({ title: "Bot deleted" });
      if (selectedBotId === deleteBotMutation.variables) {
        onSelectBot(bots[0]?.instance?.id || '');
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete bot", description: error.message, variant: "destructive" });
    },
  });

  const updateBotMutation = useMutation({
    mutationFn: async ({ botId, config }: { botId: string; config: any }) => {
      const res = await apiRequest('PATCH', `/api/bots/${botId}/config`, config);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      setIsEditOpen(false);
      toast({ title: "Bot updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update bot", description: error.message, variant: "destructive" });
    },
  });

  const selectedBotData = bots.find((b: any) => b.id === selectedBotId);
  const selectedBotStatus = selectedBotData?.status;
  
  // Pre-fill edit form when opening edit dialog
  const handleOpenEdit = () => {
    if (selectedBotData?.config) {
      setFormData(selectedBotData.config);
      setIsEditOpen(true);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <Select value={selectedBotId || undefined} onValueChange={onSelectBot}>
          <SelectTrigger data-testid="select-bot" className="font-mono">
            <SelectValue placeholder="Select a bot" />
          </SelectTrigger>
          <SelectContent>
            {bots.filter((bot: any) => bot.id).map((bot: any) => (
              <SelectItem key={bot.id} value={bot.id}>
                {bot.marketSymbol} - {bot.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedBotId && (
        <>
          <Button
            data-testid="button-edit-bot"
            size="sm"
            variant="outline"
            onClick={handleOpenEdit}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          
          {selectedBotStatus === 'stopped' && (
            <Button
              data-testid="button-start-bot"
              size="sm"
              onClick={() => startBotMutation.mutate(selectedBotId)}
              disabled={startBotMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          )}
          
          {selectedBotStatus === 'running' && (
            <Button
              data-testid="button-pause-bot"
              size="sm"
              variant="outline"
              onClick={() => pauseBotMutation.mutate(selectedBotId)}
              disabled={pauseBotMutation.isPending}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          
          {selectedBotStatus === 'paused' && (
            <Button
              data-testid="button-resume-bot"
              size="sm"
              onClick={() => startBotMutation.mutate(selectedBotId)}
              disabled={startBotMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}

          {(selectedBotStatus === 'running' || selectedBotStatus === 'paused') && (
            <Button
              data-testid="button-stop-bot"
              size="sm"
              variant="outline"
              onClick={() => stopBotMutation.mutate(selectedBotId)}
              disabled={stopBotMutation.isPending}
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          )}

          {selectedBotStatus === 'stopped' && (
            <Button
              data-testid="button-delete-bot"
              size="sm"
              variant="destructive"
              onClick={() => deleteBotMutation.mutate(selectedBotId)}
              disabled={deleteBotMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button data-testid="button-create-bot" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Bot
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[96vw] w-full sm:max-w-3xl lg:max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden font-mono p-3 sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg sm:text-xl lg:text-2xl">Create New Trading Bot</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Configure your automated volume generation bot for Asterdex perpetual futures
            </DialogDescription>
          </DialogHeader>
          
          <TooltipProvider>
            <div className="space-y-4 sm:space-y-6">
              {/* Market Selection Section - Full Width */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    <CardTitle className="text-lg">Market Selection</CardTitle>
                  </div>
                  <CardDescription>Choose trading pair and view market statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="marketSymbol">Trading Pair</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Select the perpetual futures market. Markets are sorted by 24h trading volume. Higher volume = better liquidity.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={formData.marketSymbol}
                      onValueChange={(value) => setFormData({ ...formData, marketSymbol: value })}
                    >
                      <SelectTrigger data-testid="select-market" className="w-full h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        {availableMarkets.length === 0 ? (
                          <SelectItem value="ETHUSDT">Loading markets...</SelectItem>
                        ) : (
                          availableMarkets.map((market) => (
                            <SelectItem key={market.symbol} value={market.symbol}>
                              <div className="flex items-center justify-between w-full gap-2 py-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="font-bold text-sm sm:text-base truncate">{market.symbol}</span>
                                  {market.maxLeverage && (
                                    <Badge variant="secondary" className="text-xs shrink-0">
                                      {market.maxLeverage}x
                                    </Badge>
                                  )}
                                  {market.priceChangePercent24h !== undefined && market.priceChangePercent24h !== null && (
                                    <span className={`text-xs sm:text-sm font-semibold shrink-0 ${market.priceChangePercent24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {market.priceChangePercent24h >= 0 ? '+' : ''}{market.priceChangePercent24h.toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                                <div className="hidden sm:flex items-center gap-3 text-sm text-muted-foreground shrink-0">
                                  {market.quoteVolume24h > 0 && (
                                    <span className="font-medium whitespace-nowrap">Vol: <span className="text-foreground">${formatVolume(market.quoteVolume24h)}</span></span>
                                  )}
                                  {market.lastPrice > 0 && (
                                    <span className="font-medium whitespace-nowrap">Price: <span className="text-foreground">${market.lastPrice.toFixed(market.pricePrecision)}</span></span>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Trading Configuration */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    <CardTitle className="text-lg">Trading Configuration</CardTitle>
                  </div>
                  <CardDescription>Set leverage and capital allocation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="leverage">Leverage</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Leverage multiplier for your positions. Higher leverage = higher risk. Current market max: {maxLeverage}x</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Max {maxLeverage}x
                        </Badge>
                      </div>
                      <Input
                        id="leverage"
                        data-testid="input-leverage"
                        type="number"
                        min="1"
                        max={maxLeverage}
                        value={formData.leverage}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), maxLeverage);
                          setFormData({ ...formData, leverage: val });
                        }}
                        className="text-base h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="investment">Investment (USDT)</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Base capital in USDT. Effective capital = Investment × Leverage</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="investment"
                        data-testid="input-investment"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.investmentUsdt}
                        onChange={(e) => setFormData({ ...formData, investmentUsdt: Number(e.target.value) })}
                        className="text-base h-11"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Volume Targets */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    <CardTitle className="text-lg">Volume Targets & Limits</CardTitle>
                  </div>
                  <CardDescription>Define trading volume goals and risk limits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="targetVolume">Target Volume</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Total trading volume to generate in USDT over the target timeframe</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="targetVolume"
                        data-testid="input-target-volume"
                        type="number"
                        min="1"
                        value={formData.targetVolume}
                        onChange={(e) => setFormData({ ...formData, targetVolume: Number(e.target.value) })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="maxLoss">Max Loss (USDT)</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Maximum acceptable loss in USDT. Bot will stop if total loss exceeds this amount</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="maxLoss"
                        data-testid="input-max-loss"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.maxLoss}
                        onChange={(e) => setFormData({ ...formData, maxLoss: Number(e.target.value) })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="targetHours">Target Hours</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Timeframe in hours to achieve the target volume (e.g., 24 hours)</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="targetHours"
                        data-testid="input-target-hours"
                        type="number"
                        min="1"
                        value={formData.targetHours}
                        onChange={(e) => setFormData({ ...formData, targetHours: Number(e.target.value) })}
                        className="h-11"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Strategy Parameters */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    <CardTitle className="text-lg">Strategy Parameters</CardTitle>
                  </div>
                  <CardDescription>Fine-tune order placement and trading behavior</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="firstOrderSpreadBps">First Order Spread (bps)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Distance in basis points from current price to first buy/sell order (1 bps = 0.01%)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="firstOrderSpreadBps"
                          data-testid="input-first-order-spread"
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={formData.firstOrderSpreadBps}
                          onChange={(e) => setFormData({ ...formData, firstOrderSpreadBps: Number(e.target.value) })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="orderSpacingBps">Order Spacing (bps)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Distance in basis points between subsequent orders to avoid large exponential spreads</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="orderSpacingBps"
                          data-testid="input-order-spacing"
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={formData.orderSpacingBps}
                          onChange={(e) => setFormData({ ...formData, orderSpacingBps: Number(e.target.value) })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="ordersPerSide">Orders/Side</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Number of buy and sell orders to place simultaneously. More orders = better coverage</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="ordersPerSide"
                          data-testid="input-orders-per-side"
                          type="number"
                          min="1"
                          max="20"
                          value={formData.ordersPerSide}
                          onChange={(e) => setFormData({ ...formData, ordersPerSide: Number(e.target.value) })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="orderSize">Order Size (%)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Percentage of effective capital per order (Effective Capital = Investment × Leverage)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="orderSize"
                          data-testid="input-order-size"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          value={formData.orderSizePercent}
                          onChange={(e) => setFormData({ ...formData, orderSizePercent: Number(e.target.value) })}
                          className="h-11"
                        />
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="tradingBias">Trading Bias</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Preferred trading direction. Neutral = equal buy/sell orders. Long = favor buy side. Short = favor sell side.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select
                          value={formData.tradingBias}
                          onValueChange={(value: 'neutral' | 'long' | 'short') => {
                            const longPercent = value === 'long' ? 70 : value === 'short' ? 30 : 50;
                            setFormData({ ...formData, tradingBias: value, longBiasPercent: longPercent });
                          }}
                        >
                          <SelectTrigger data-testid="select-trading-bias" className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="neutral">Neutral (50/50)</SelectItem>
                            <SelectItem value="long">Long Bias (70/30)</SelectItem>
                            <SelectItem value="short">Short Bias (30/70)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="longBiasPercent">Long Allocation (%)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Percentage of orders on buy side. 50% = neutral, 70% = long bias, 30% = short bias</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="longBiasPercent"
                          data-testid="input-long-bias"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.longBiasPercent}
                          onChange={(e) => setFormData({ ...formData, longBiasPercent: Number(e.target.value) })}
                          className="h-11"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Management */}
              <Card className="border-orange-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-500" />
                    <CardTitle className="text-lg">Risk Management</CardTitle>
                  </div>
                  <CardDescription>Configure stop-loss, take-profit, trailing stops, and emergency protection</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Stop-Loss & Take-Profit */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="stopLossPercent">Stop-Loss (%)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Maximum loss percentage from entry price. Native STOP_MARKET order will be placed automatically. Layer 2 manual fallback included.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="stopLossPercent"
                          data-testid="input-stop-loss"
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="100"
                          value={formData.stopLossPercent}
                          onChange={(e) => setFormData({ ...formData, stopLossPercent: Number(e.target.value) })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="takeProfitPercent">Take-Profit (%)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Target profit percentage from entry price. Native TAKE_PROFIT_MARKET order will be placed automatically. Layer 2 manual fallback included.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="takeProfitPercent"
                          data-testid="input-take-profit"
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="1000"
                          value={formData.takeProfitPercent}
                          onChange={(e) => setFormData({ ...formData, takeProfitPercent: Number(e.target.value) })}
                          className="h-11"
                        />
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Trailing Stop */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label>Trailing Stop-Loss</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Automatically adjusts stop-loss as profit increases. Locks in profits while allowing upside. Uses native TRAILING_STOP_MARKET orders.</p>
                          </TooltipContent>
                        </Tooltip>
                        <div className="ml-auto">
                          <Button
                            type="button"
                            variant={formData.enableTrailingStop ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, enableTrailingStop: !formData.enableTrailingStop })}
                            data-testid="toggle-trailing-stop"
                          >
                            {formData.enableTrailingStop ? 'Enabled' : 'Disabled'}
                          </Button>
                        </div>
                      </div>
                      {formData.enableTrailingStop && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-3 sm:pl-6 border-l-2 border-orange-500/30">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="trailingStopActivation">Activation (%)</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>Profit threshold to activate trailing stop. e.g., 2% means trailing stop activates after 2% profit</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              id="trailingStopActivation"
                              data-testid="input-trailing-activation"
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={formData.trailingStopActivationPercent}
                              onChange={(e) => setFormData({ ...formData, trailingStopActivationPercent: Number(e.target.value) })}
                              className="h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="trailingStopCallback">Callback Rate (%)</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>Trailing distance percentage. e.g., 1% means stop-loss trails 1% below peak price</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              id="trailingStopCallback"
                              data-testid="input-trailing-callback"
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="10"
                              value={formData.trailingStopCallbackRate}
                              onChange={(e) => setFormData({ ...formData, trailingStopCallbackRate: Number(e.target.value) })}
                              className="h-11"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator className="my-3" />

                    {/* Circuit Breaker */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label>Emergency Circuit Breaker</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Automatic emergency shutdown. Closes all positions and pauses bot if total unrealized loss exceeds threshold.</p>
                          </TooltipContent>
                        </Tooltip>
                        <div className="ml-auto">
                          <Button
                            type="button"
                            variant={formData.circuitBreakerEnabled ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, circuitBreakerEnabled: !formData.circuitBreakerEnabled })}
                            data-testid="toggle-circuit-breaker"
                          >
                            {formData.circuitBreakerEnabled ? 'Enabled' : 'Disabled'}
                          </Button>
                        </div>
                      </div>
                      {formData.circuitBreakerEnabled && (
                        <div className="pl-6 border-l-2 border-red-500/30">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="circuitBreakerThreshold">Max Loss Threshold (USDT)</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>Maximum total unrealized loss in USDT. If exceeded, bot closes all positions immediately and stops.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              id="circuitBreakerThreshold"
                              data-testid="input-circuit-breaker"
                              type="number"
                              step="1"
                              min="1"
                              value={formData.circuitBreakerThreshold}
                              onChange={(e) => setFormData({ ...formData, circuitBreakerThreshold: Number(e.target.value) })}
                              className="h-11"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              <Button
                data-testid="button-submit-bot"
                className="w-full h-12 text-base"
                onClick={() => createBotMutation.mutate(formData)}
                disabled={createBotMutation.isPending}
              >
                {createBotMutation.isPending ? 'Creating Bot...' : 'Create Trading Bot'}
              </Button>
            </div>
          </TooltipProvider>
        </DialogContent>
      </Dialog>

      {/* Edit Bot Dialog - Same as Create but with disabled market selector and update mutation */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[96vw] w-full sm:max-w-3xl lg:max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden font-mono p-3 sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg sm:text-xl lg:text-2xl">Edit Bot Configuration</DialogTitle>
            <DialogDescription className="text-sm">
              Modify parameters for {selectedBotData?.marketSymbol} bot (running bots will apply changes immediately)
            </DialogDescription>
          </DialogHeader>
          
          <TooltipProvider>
            <div className="space-y-6">
              {/* Market Selection Section - Disabled for edit */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    <CardTitle className="text-lg">Market (Read-Only)</CardTitle>
                  </div>
                  <CardDescription>Market cannot be changed after bot creation</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    value={formData.marketSymbol}
                    disabled
                    className="text-base h-11 font-bold"
                  />
                </CardContent>
              </Card>

              {/* Trading Configuration - Copy from create dialog */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    <CardTitle className="text-lg">Trading Configuration</CardTitle>
                  </div>
                  <CardDescription>Set leverage and capital allocation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="edit-leverage">Leverage</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Leverage multiplier for your positions. Higher leverage = higher risk. Current market max: {maxLeverage}x</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Max {maxLeverage}x
                        </Badge>
                      </div>
                      <Input
                        id="edit-leverage"
                        type="number"
                        min="1"
                        max={maxLeverage}
                        value={formData.leverage}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), maxLeverage);
                          setFormData({ ...formData, leverage: val });
                        }}
                        className="text-base h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="edit-investment">Investment (USDT)</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Base capital in USDT. Effective capital = Investment × Leverage</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="edit-investment"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.investmentUsdt}
                        onChange={(e) => setFormData({ ...formData, investmentUsdt: Number(e.target.value) })}
                        className="text-base h-11"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key parameters only for edit (show less than create) */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    <CardTitle className="text-lg">Key Parameters</CardTitle>
                  </div>
                  <CardDescription>Essential trading and risk parameters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-spread">Spread (bps)</Label>
                      <Input
                        id="edit-spread"
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={formData.spreadBps}
                        onChange={(e) => setFormData({ ...formData, spreadBps: Number(e.target.value) })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-orders-per-side">Orders/Side</Label>
                      <Input
                        id="edit-orders-per-side"
                        type="number"
                        min="1"
                        value={formData.ordersPerSide}
                        onChange={(e) => setFormData({ ...formData, ordersPerSide: Number(e.target.value) })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-stop-loss">Stop Loss (%)</Label>
                      <Input
                        id="edit-stop-loss"
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={formData.stopLossPercent}
                        onChange={(e) => setFormData({ ...formData, stopLossPercent: Number(e.target.value) })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-take-profit">Take Profit (%)</Label>
                      <Input
                        id="edit-take-profit"
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={formData.takeProfitPercent}
                        onChange={(e) => setFormData({ ...formData, takeProfitPercent: Number(e.target.value) })}
                        className="h-11"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              <Button
                className="w-full h-12 text-base"
                onClick={() => selectedBotId && updateBotMutation.mutate({ botId: selectedBotId, config: formData })}
                disabled={updateBotMutation.isPending}
              >
                {updateBotMutation.isPending ? 'Updating Bot...' : 'Save Changes'}
              </Button>
            </div>
          </TooltipProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
}
