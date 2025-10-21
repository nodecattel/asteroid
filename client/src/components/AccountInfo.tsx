import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, TrendingDown, X } from "lucide-react";
import { formatCryptoPrice } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Position {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  leverage: string;
  liquidationPrice: string;
  isolated: boolean;
}

interface Balance {
  totalWalletBalance: string;
  availableBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  assets: any[];
}

interface Order {
  symbol: string;
  orderId: number;
  type: string;
  side: string;
  stopPrice?: string;
  price?: string;
  closePosition?: boolean;
}

export default function AccountInfo() {
  const { toast } = useToast();

  // Fetch account balance
  const { data: balanceData, isLoading: balanceLoading, error: balanceError } = useQuery<{ success: boolean; data: Balance }>({
    queryKey: ['/api/account/balance'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch positions
  const { data: positionsData, isLoading: positionsLoading } = useQuery<{ success: boolean; data: Position[] }>({
    queryKey: ['/api/account/positions'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Fetch open orders for all positions
  const { data: ordersData } = useQuery<{ success: boolean; data: Order[] }>({
    queryKey: ['/api/account/orders'],
    refetchInterval: 3000, // Refresh every 3 seconds
    enabled: !!positionsData?.data && positionsData.data.length > 0,
  });

  // Close position mutation
  const closePositionMutation = useMutation({
    mutationFn: async ({ symbol, side }: { symbol: string; side: 'LONG' | 'SHORT' }) => {
      return await apiRequest('POST', '/api/account/close-position', { symbol, side });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/account/positions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/account/balance'] });
      toast({
        title: "Position Closed",
        description: "Your position has been closed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to close position",
      });
    },
  });

  const balance = balanceData?.data;
  const positions = positionsData?.data || [];
  const orders = ordersData?.data || [];
  
  const totalWalletBalance = parseFloat(balance?.totalWalletBalance || '0');
  const availableBalance = parseFloat(balance?.availableBalance || '0');
  const unrealizedPnL = parseFloat(balance?.totalUnrealizedProfit || '0');

  // Helper function to find TP/SL orders for a position
  const getProtectionOrders = (symbol: string) => {
    const symbolOrders = orders.filter(order => order.symbol === symbol);
    const stopLoss = symbolOrders.find(order => order.type === 'STOP_MARKET');
    const takeProfit = symbolOrders.find(order => order.type === 'TAKE_PROFIT_MARKET');
    return { stopLoss, takeProfit };
  };

  if (balanceError) {
    return (
      <Card className="border-orange-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-lg">Account Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Unable to load account information. Please ensure API credentials are properly configured.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Account Balance</CardTitle>
            </div>
            {balanceLoading && (
              <Badge variant="secondary" className="text-xs">Updating...</Badge>
            )}
          </div>
          <CardDescription>Real-time wallet and margin information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1">
              <div className="text-xs sm:text-sm text-muted-foreground">Total Wallet Balance</div>
              <div className="text-xl sm:text-2xl font-bold font-mono" data-testid="text-wallet-balance">
                ${totalWalletBalance.toFixed(2)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs sm:text-sm text-muted-foreground">Available Balance</div>
              <div className="text-xl sm:text-2xl font-bold font-mono" data-testid="text-available-balance">
                ${availableBalance.toFixed(2)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs sm:text-sm text-muted-foreground">Unrealized PnL</div>
              <div className={`text-lg sm:text-xl font-bold font-mono flex items-center gap-1 ${
                unrealizedPnL > 0 ? 'text-green-500' : unrealizedPnL < 0 ? 'text-red-500' : ''
              }`} data-testid="text-unrealized-pnl">
                {unrealizedPnL > 0 ? <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : unrealizedPnL < 0 ? <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : null}
                ${unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs sm:text-sm text-muted-foreground">Margin Balance</div>
              <div className="text-lg sm:text-xl font-bold font-mono" data-testid="text-margin-balance">
                ${parseFloat(balance?.totalMarginBalance || '0').toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positions Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Open Positions</CardTitle>
            </div>
            <Badge variant={positions.length > 0 ? "default" : "secondary"} data-testid="badge-position-count">
              {positions.length} {positions.length === 1 ? 'Position' : 'Positions'}
            </Badge>
          </div>
          <CardDescription>Active futures positions</CardDescription>
        </CardHeader>
        <CardContent>
          {positionsLoading ? (
            <div className="text-sm text-muted-foreground">Loading positions...</div>
          ) : positions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No open positions</div>
          ) : (
            <div className="space-y-3">
              {positions.map((position, idx) => {
                const posAmt = parseFloat(position.positionAmt);
                const isLong = posAmt > 0;
                const pnl = parseFloat(position.unRealizedProfit);
                const entryPrice = parseFloat(position.entryPrice);
                const markPrice = parseFloat(position.markPrice);
                const pnlPercent = ((markPrice - entryPrice) / entryPrice * 100) * (isLong ? 1 : -1);
                const positionValue = Math.abs(posAmt) * markPrice; // Notional value
                const leverage = parseFloat(position.leverage);
                const marginUsed = positionValue / leverage; // Margin used
                const marginType = position.isolated ? 'Isolated' : 'Cross';
                
                // Get TP/SL orders for this position
                const { stopLoss, takeProfit } = getProtectionOrders(position.symbol);

                return (
                  <div 
                    key={idx} 
                    className="p-3 rounded-md border bg-card/50 space-y-3"
                    data-testid={`position-${position.symbol}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold font-mono">{position.symbol}</span>
                        <Badge variant={isLong ? "default" : "destructive"} className="text-xs">
                          {isLong ? 'LONG' : 'SHORT'} {position.leverage}x
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {marginType}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => closePositionMutation.mutate({ 
                          symbol: position.symbol, 
                          side: isLong ? 'LONG' : 'SHORT' 
                        })}
                        disabled={closePositionMutation.isPending}
                        data-testid={`button-close-${position.symbol}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className={`text-sm font-bold font-mono ${
                      pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : ''
                    }`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDT ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Size</div>
                        <div className="font-mono">{Math.abs(posAmt).toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Notional (USD)</div>
                        <div className="font-mono" data-testid={`text-notional-${position.symbol}`}>${positionValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Margin Used (USD)</div>
                        <div className="font-mono" data-testid={`text-margin-${position.symbol}`}>${marginUsed.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Entry Price</div>
                        <div className="font-mono">${formatCryptoPrice(entryPrice)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Mark Price</div>
                        <div className="font-mono">${formatCryptoPrice(markPrice)}</div>
                      </div>
                      {stopLoss && (
                        <div>
                          <div className="text-muted-foreground">Stop Loss</div>
                          <div className="font-mono text-red-500" data-testid={`text-sl-${position.symbol}`}>
                            ${formatCryptoPrice(parseFloat(stopLoss.stopPrice || '0'))}
                          </div>
                        </div>
                      )}
                      {takeProfit && (
                        <div>
                          <div className="text-muted-foreground">Take Profit</div>
                          <div className="font-mono text-green-500" data-testid={`text-tp-${position.symbol}`}>
                            ${formatCryptoPrice(parseFloat(takeProfit.stopPrice || '0'))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
