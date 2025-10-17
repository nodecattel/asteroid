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
import { DollarSign, Activity, TrendingUp, Clock, Zap, Target } from "lucide-react";
import type { BotInstance, BotStats } from "@shared/schema";

export default function Dashboard() {
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState("00:00:00");

  // Fetch all bots
  const { data: botsData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/bots'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const bots = botsData?.data || [];
  const selectedBot = bots.find((b: any) => b.instance.id === selectedBotId);

  // Auto-select first bot if none selected
  useEffect(() => {
    if (!selectedBotId && bots.length > 0) {
      setSelectedBotId(bots[0].instance.id);
    }
  }, [bots, selectedBotId]);

  // Fetch selected bot details
  const { data: botDetails } = useQuery({
    queryKey: ['/api/bots', selectedBotId],
    enabled: !!selectedBotId,
    refetchInterval: 2000,
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

    return () => {
      socket.off('statsUpdated');
      socket.off('activityLog');
      socket.off('orderPlaced');
    };
  }, [selectedBotId]);

  // Update session time
  useEffect(() => {
    if (!selectedBot) return;

    const updateTime = () => {
      const start = new Date(selectedBot.instance.sessionStart);
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

  const instance: BotInstance | undefined = selectedBot?.instance;
  const orders: Order[] = (details?.data?.orders || []).map((o: any) => ({
    id: o.id,
    time: new Date(o.createdAt).toLocaleTimeString(),
    side: o.side,
    price: o.price,
    quantity: o.quantity,
    status: o.status,
  })).slice(0, 10);

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

  const config = instance ? [
    { label: "Market", value: instance.config.marketSymbol, category: "Trading" },
    { label: "Leverage", value: `${instance.config.leverage}x`, category: "Trading" },
    { label: "Investment", value: `$${instance.config.investmentUsdt.toFixed(2)}`, category: "Trading" },
    { label: "Target Volume", value: `$${instance.config.targetVolume.toLocaleString()}`, category: "Targets" },
    { label: "Target Hours", value: `${instance.config.targetHours}h`, category: "Targets" },
    { label: "Max Loss", value: `$${instance.config.maxLoss.toFixed(2)}`, category: "Targets" },
    { label: "Spread", value: `${instance.config.spreadBps} bps`, category: "Strategy" },
    { label: "Orders Per Side", value: `${instance.config.ordersPerSide}`, category: "Strategy" },
    { label: "Order Size", value: `${instance.config.orderSizePercent}%`, category: "Strategy" },
    { label: "Refresh Interval", value: `${instance.config.refreshInterval}s`, category: "Strategy" },
  ] : [];

  const handleCancelOrder = async (orderId: string) => {
    console.log('Cancel order:', orderId);
    // TODO: Implement order cancellation
  };

  const targetProgress = instance
    ? (stats.totalVolume / instance.config.targetVolume) * 100
    : 0;

  const hourlyRate = stats.sessionUptime > 0
    ? (stats.totalVolume / (stats.sessionUptime / 3600))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <StatusBar
        botStatus={instance?.status || "stopped"}
        market={instance?.marketSymbol || "N/A"}
        sessionTime={sessionTime}
        connectionStatus="connected"
        onPauseResume={() => {}}
        onSettings={() => {}}
      />
      
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Bot Selector */}
        <BotSelector
          bots={bots}
          selectedBotId={selectedBotId}
          onSelectBot={setSelectedBotId}
        />

        {selectedBot && (
          <>
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ActivityFeed logs={logs} />
              <VolumeChart data={chartData} />
            </div>

            {/* Orders Table */}
            {orders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Recent Orders
                </h2>
                <OrdersTable orders={orders} onCancelOrder={handleCancelOrder} />
              </div>
            )}

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
    </div>
  );
}
