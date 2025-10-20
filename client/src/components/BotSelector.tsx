import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Play, Pause, Square, Trash2, Info, TrendingUp, Target, Settings, Zap } from "lucide-react";
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
}

export default function BotSelector({ bots, selectedBotId, onSelectBot }: BotSelectorProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
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
    marketSymbol: 'ETHUSDT',
    leverage: 10,
    investmentUsdt: 10,
    targetVolume: 100000,
    maxLoss: 10,
    targetHours: 24,
    spreadBps: 2,
    ordersPerSide: 10,
    orderSizePercent: 0.1,
    refreshInterval: 2.0,
    delayBetweenOrders: 0.05,
    delayAfterCancel: 0.3,
    maxOrdersToPlace: 10,
    usePostOnly: false,
    tradingFeePercent: 0.2,
  });

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

  const selectedBotData = bots.find(b => b.instance?.id === selectedBotId);
  const selectedBotStatus = selectedBotData?.instance?.status;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <Select value={selectedBotId || undefined} onValueChange={onSelectBot}>
          <SelectTrigger data-testid="select-bot" className="font-mono">
            <SelectValue placeholder="Select a bot" />
          </SelectTrigger>
          <SelectContent>
            {bots.filter(bot => bot.instance?.id).map((bot) => (
              <SelectItem key={bot.instance.id} value={bot.instance.id}>
                {bot.instance.marketSymbol} - {bot.instance.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedBotId && (
        <>
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto font-mono">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create New Trading Bot</DialogTitle>
            <DialogDescription>
              Configure your automated volume generation bot for Asterdex perpetual futures
            </DialogDescription>
          </DialogHeader>
          
          <TooltipProvider>
            <div className="space-y-6">
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
                      <Label htmlFor="marketSymbol" className="min-w-[120px]">Trading Pair</Label>
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
                              <div className="flex items-center justify-between w-full gap-4 py-2">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="font-bold text-base">{market.symbol}</span>
                                  {market.maxLeverage && (
                                    <Badge variant="secondary" className="text-xs">
                                      Max {market.maxLeverage}x
                                    </Badge>
                                  )}
                                  {market.priceChangePercent24h !== undefined && market.priceChangePercent24h !== null && (
                                    <span className={`text-sm font-semibold ${market.priceChangePercent24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {market.priceChangePercent24h >= 0 ? '+' : ''}{market.priceChangePercent24h.toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  {market.quoteVolume24h > 0 && (
                                    <span className="font-medium">Vol: <span className="text-foreground">${formatVolume(market.quoteVolume24h)}</span></span>
                                  )}
                                  {market.lastPrice > 0 && (
                                    <span className="font-medium">Price: <span className="text-foreground">${market.lastPrice.toFixed(market.pricePrecision)}</span></span>
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
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="leverage">Leverage</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Leverage multiplier for your positions. Higher leverage = higher risk. Check market's max leverage limit.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="leverage"
                        data-testid="input-leverage"
                        type="number"
                        min="1"
                        max="125"
                        value={formData.leverage}
                        onChange={(e) => setFormData({ ...formData, leverage: Number(e.target.value) })}
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
                  <div className="grid grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="spreadBps">Spread (bps)</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Order spread in basis points (1 bps = 0.01%). Lower = tighter around market price</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="spreadBps"
                        data-testid="input-spread"
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={formData.spreadBps}
                        onChange={(e) => setFormData({ ...formData, spreadBps: Number(e.target.value) })}
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
    </div>
  );
}
