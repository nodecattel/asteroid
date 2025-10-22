import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { queryClient } from "@/lib/queryClient";
import StatusBar from "@/components/StatusBar";
import MetricCard from "@/components/MetricCard";
import OrdersTable, { Order } from "@/components/OrdersTable";
import ActivityFeed, { ActivityLog } from "@/components/ActivityFeed";
import VolumeChart, { HourlyData } from "@/components/VolumeChart";
import ConfigPanel from "@/components/ConfigPanel";
import BotSelector from "@/components/BotSelector";
import AccountInfo from "@/components/AccountInfo";
import MarketPairs from "@/components/MarketPairs";
import Footer from "@/components/Footer";
import TradesHistory, { Trade } from "@/components/TradesHistory";
import OverviewCards from "@/components/OverviewCards";
import BalanceChart from "@/components/BalanceChart";
import { DollarSign, Activity, TrendingUp, Clock, Zap, Target } from "lucide-react";
import type { BotInstance, BotStats, BalanceHistory } from "@shared/schema";

export default function Dashboard() {
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState("00:00:00");
  const [initialSymbol, setInitialSymbol] = useState<string | undefined>(undefined);

  // Fetch all bots
  const { data: botsData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/bots'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const bots = botsData?.data || [];
  const selectedBot = bots.find((b: any) => b.id === selectedBotId);

  // Auto-select first bot if none selected
  useEffect(() => {
    if (!selectedBotId && bots.length > 0 && bots[0]?.id) {
      setSelectedBotId(bots[0].id);
    }
  }, [bots, selectedBotId]);

  // Fetch selected bot details
  const { data: botDetails } = useQuery({
    queryKey: ['/api/bots', selectedBotId],
    enabled: !!selectedBotId,
    refetchInterval: 2000,
  });

  // Fetch bot trade history
  const { data: tradesData } = useQuery({
    queryKey: ['/api/bots', selectedBotId, 'trades'],
    enabled: !!selectedBotId,
    refetchInterval: 3000,
  });

  // Fetch overview data (bots + agents combined)
  const { data: overviewData } = useQuery({
    queryKey: ['/api/overview'],
    refetchInterval: 5000,
  });

  // Fetch balance history
  const { data: balanceHistoryData } = useQuery<{ success: boolean; data: BalanceHistory[] }>({
    queryKey: ['/api/balance-history'],
    refetchInterval: 10000,
  });

  // Setup WebSocket listeners
  useEffect(() => {
    const socket = getSocket();

    socket.on('statsUpdated', (data: any) => {
      if (data.botId === selectedBotId) {
        queryClient.invalidateQueries({ queryKey: ['/api/bots', selectedBotId] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
    });

    socket.on('activityLog', (data: any) => {
      if (data.botId === selectedBotId) {
        queryClient.invalidateQueries({ queryKey: ['/api/bots', selectedBotId] });
      }
    });

    socket.on('orderPlaced', (data: any) => {
      if (data.botId === selectedBotId) {
        queryClient.invalidateQueries({ queryKey: ['/api/bots', selectedBotId] });
      }
    });

    socket.on('orderUpdated', (data: any) => {
      if (data.botId === selectedBotId) {
        queryClient.invalidateQueries({ queryKey: ['/api/bots', selectedBotId] });
        queryClient.invalidateQueries({ queryKey: ['/api/bots', selectedBotId, 'trades'] });
      }
    });

    socket.on('balanceUpdate', (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/balance-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/overview'] });
    });

    return () => {
      socket.off('statsUpdated');
      socket.off('activityLog');
      socket.off('orderPlaced');
      socket.off('orderUpdated');
      socket.off('balanceUpdate');
    };
  }, [selectedBotId]);

  // Update session time
  useEffect(() => {
    if (!selectedBot) return;

    const updateTime = () => {
      const start = new Date(selectedBot.sessionStart);
      const now = new Date();
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      setSessionTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [selectedBot]);

  const details: any = botDetails;
  const stats: BotStats = details?.data?.stats || {
    botId: selectedBotId || '',
    totalVolume: 0,
    totalTrades: 0,
    totalFees: 0,
    currentPnL: 0,
    activeOrders: 0,
    fillRate: 0,
    hourlyVolume: 0,
    hourlyTrades: 0,
    sessionUptime: 0,
  };

  const instance: BotInstance | undefined = selectedBot;
  const orders: Order[] = (details?.data?.orders || [])
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map((o: any) => ({
      id: o.id,
      time: new Date(o.createdAt).toLocaleTimeString(),
      side: o.side,
      price: o.price,
      quantity: o.quantity,
      status: o.status,
    }));

  const logs: ActivityLog[] = (details?.data?.logs || []).map((log: any) => ({
    id: log.id,
    timestamp: new Date(log.timestamp).toLocaleTimeString(),
    type: log.type,
    message: log.message,
  })).reverse().slice(0, 50);

  const chartData: HourlyData[] = (details?.data?.hourlyVolume || []).map((hv: any) => ({
    hour: hv.hour,
    volume: hv.volume,
    target: hv.target,
  }));

  const trades: Trade[] = ((tradesData as any)?.data?.trades || []).map((t: any) => ({
    id: t.id,
    timestamp: t.timestamp,
    side: t.side,
    price: t.price,
    quantity: t.quantity,
    quoteQuantity: t.quoteQuantity,
    commission: t.commission,
    realizedPnl: t.realizedPnl,
  }));

  const totalPnL = ((tradesData as any)?.data?.realizedPnL || 0);

  const config = selectedBot ? [
    { label: "Market", value: selectedBot.config.marketSymbol, category: "Trading" },
    { label: "Leverage", value: `${selectedBot.config.leverage}x`, category: "Trading" },
    { label: "Margin", value: `$${selectedBot.config.marginUsdt.toFixed(2)}`, category: "Trading" },
    { label: "Target Volume", value: `$${selectedBot.config.targetVolume.toLocaleString()}`, category: "Targets" },
    { label: "Target Hours", value: `${selectedBot.config.targetHours}h`, category: "Targets" },
    { label: "Max Loss", value: `$${selectedBot.config.maxLoss.toFixed(2)}`, category: "Targets" },
    { label: "First Order Spread", value: `${selectedBot.config.firstOrderSpreadBps} bps`, category: "Strategy" },
    { label: "Order Spacing", value: `${selectedBot.config.orderSpacingBps} bps`, category: "Strategy" },
    { label: "Orders Per Side", value: `${selectedBot.config.ordersPerSide}`, category: "Strategy" },
    { label: "Cycle Time", value: `${selectedBot.config.cycleTimeSeconds}s`, category: "Strategy" },
  ] : [];

  const handleCancelOrder = async (orderId: string) => {
    console.log('Cancel order:', orderId);
    // TODO: Implement order cancellation
  };

  const targetProgress = selectedBot
    ? (stats.totalVolume / selectedBot.config.targetVolume) * 100
    : 0;

  // Use actual hourly volume from exchange trades (last 60 minutes)
  const hourlyRate = stats.hourlyVolume || 0;

  // Fetch market info to get max leverage
  const { data: marketsData } = useQuery<{ success: boolean; data: Array<{
    symbol: string;
    maxLeverage?: number;
  }> }>({
    queryKey: ['/api/markets'],
    refetchInterval: 5 * 60 * 1000,
  });
  
  // Extract market data
  const marketData = details?.data?.marketData;
  const fundingRate = marketData?.fundingRate;
  const selectedMarket = marketsData?.data?.find(m => m.symbol === selectedBot?.marketSymbol);
  const maxLeverage = selectedMarket?.maxLeverage;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StatusBar
        botStatus={selectedBot?.status || "stopped"}
        market={selectedBot?.marketSymbol || "N/A"}
        sessionTime={sessionTime}
        connectionStatus="connected"
        fundingRate={fundingRate}
        maxLeverage={maxLeverage}
        onPauseResume={() => {}}
        onSettings={() => {}}
      />
      
      <div className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Unified Overview - Bots + Agents */}
        {overviewData?.data && (
          <OverviewCards overview={overviewData.data} />
        )}

        {/* Balance History Chart */}
        {balanceHistoryData?.data && balanceHistoryData.data.length > 0 && (
          <BalanceChart history={balanceHistoryData.data} />
        )}

        {/* Account Information */}
        <AccountInfo />

        {/* Market Pairs Overview */}
        <MarketPairs onCreateBot={setInitialSymbol} />

        {/* Bot Selector */}
        <BotSelector
          bots={bots}
          selectedBotId={selectedBotId}
          onSelectBot={setSelectedBotId}
          initialSymbol={initialSymbol}
          onSymbolUsed={() => setInitialSymbol(undefined)}
        />

        {selectedBot && (
          <>
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <MetricCard
                label="Total Volume"
                value={`$${stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                icon={DollarSign}
                progress={targetProgress}
              />
              <MetricCard
                label="Total Trades"
                value={stats.totalTrades.toLocaleString()}
                icon={Activity}
              />
              <MetricCard
                label="Current P&L"
                value={`${stats.currentPnL >= 0 ? '+' : ''}$${stats.currentPnL.toFixed(2)}`}
                unit="USD"
                icon={TrendingUp}
                trend={stats.currentPnL >= 0 ? { direction: "up", value: `+${Math.abs(stats.currentPnL).toFixed(2)}` } : { direction: "down", value: `-${Math.abs(stats.currentPnL).toFixed(2)}` }}
              />
              <MetricCard
                label="Active Orders"
                value={stats.activeOrders.toString()}
                icon={Zap}
              />
              <MetricCard
                label="Hourly Rate"
                value={`$${hourlyRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                unit="/hr"
                icon={Clock}
              />
              <MetricCard
                label="Target Progress"
                value={targetProgress.toFixed(1)}
                unit="%"
                icon={Target}
                progress={targetProgress}
              />
            </div>

            {/* Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <ActivityFeed logs={logs} />
              <VolumeChart data={chartData} />
            </div>

            {/* Orders Table */}
            {orders.length > 0 && (
              <OrdersTable orders={orders} onCancelOrder={handleCancelOrder} />
            )}

            {/* Trades History */}
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                Trade History
              </h2>
              <TradesHistory trades={trades} totalPnL={totalPnL} />
            </div>

            {/* Config Panel */}
            <ConfigPanel config={config} />
          </>
        )}

        {!selectedBot && bots.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No bots configured. Create one to get started.</p>
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
}
