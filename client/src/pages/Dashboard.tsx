import { useState } from "react";
import StatusBar from "@/components/StatusBar";
import MetricCard from "@/components/MetricCard";
import OrdersTable, { Order } from "@/components/OrdersTable";
import ActivityFeed, { ActivityLog } from "@/components/ActivityFeed";
import VolumeChart, { HourlyData } from "@/components/VolumeChart";
import ConfigPanel from "@/components/ConfigPanel";
import { DollarSign, Activity, TrendingUp, Clock, Zap, Target } from "lucide-react";

export default function Dashboard() {
  const [botStatus, setBotStatus] = useState<"running" | "paused" | "error">("running");

  // Mock data - todo: remove mock functionality
  const mockOrders: Order[] = [
    { id: "1", time: "14:32:45", side: "BUY", price: 2345.67, quantity: 0.0234, status: "NEW" },
    { id: "2", time: "14:32:43", side: "SELL", price: 2346.12, quantity: 0.0189, status: "PARTIALLY_FILLED" },
    { id: "3", time: "14:32:41", side: "BUY", price: 2345.34, quantity: 0.0267, status: "NEW" },
    { id: "4", time: "14:32:38", side: "SELL", price: 2346.89, quantity: 0.0145, status: "FILLED" },
    { id: "5", time: "14:32:35", side: "BUY", price: 2345.01, quantity: 0.0298, status: "NEW" },
  ];

  const mockLogs: ActivityLog[] = [
    { id: "1", timestamp: "14:32:45", type: "info", message: "Bot started successfully" },
    { id: "2", timestamp: "14:32:46", type: "info", message: "Connected to Asterdex API" },
    { id: "3", timestamp: "14:32:47", type: "info", message: "Placed 10 buy orders at avg price 2345.67" },
    { id: "4", timestamp: "14:32:48", type: "fill", message: "Order #50001 FILLED: BUY 0.0234 @ 2345.67" },
    { id: "5", timestamp: "14:32:50", type: "fill", message: "Order #50002 FILLED: SELL 0.0189 @ 2346.12" },
    { id: "6", timestamp: "14:32:52", type: "cancel", message: "Cancelled 3 stale orders" },
    { id: "7", timestamp: "14:32:55", type: "info", message: "Volume milestone: $10,000 reached" },
    { id: "8", timestamp: "14:32:58", type: "error", message: "Rate limit warning: backing off 500ms" },
    { id: "9", timestamp: "14:33:01", type: "fill", message: "Order #50003 PARTIALLY_FILLED: BUY 0.0125/0.0267" },
  ];

  const mockChartData: HourlyData[] = [
    { hour: "10:00", volume: 3200, target: 4167 },
    { hour: "11:00", volume: 4500, target: 4167 },
    { hour: "12:00", volume: 3800, target: 4167 },
    { hour: "13:00", volume: 4200, target: 4167 },
    { hour: "14:00", volume: 2100, target: 4167 },
  ];

  const mockConfig = [
    { label: "Market", value: "ETHUSDT", category: "Trading" },
    { label: "Leverage", value: "10x", category: "Trading" },
    { label: "Investment", value: "$10.00", category: "Trading" },
    { label: "Target Volume", value: "$100,000", category: "Targets" },
    { label: "Target Hours", value: "24h", category: "Targets" },
    { label: "Max Loss", value: "$10.00", category: "Targets" },
    { label: "Spread", value: "2 bps", category: "Strategy" },
    { label: "Orders Per Side", value: "10", category: "Strategy" },
    { label: "Order Size", value: "0.1%", category: "Strategy" },
    { label: "Refresh Interval", value: "2.0s", category: "Strategy" },
  ];

  const handlePauseResume = () => {
    setBotStatus(prev => prev === "running" ? "paused" : "running");
    console.log('Bot status toggled:', botStatus === "running" ? "paused" : "running");
  };

  const handleSettings = () => {
    console.log('Settings opened');
  };

  const handleCancelOrder = (orderId: string) => {
    console.log('Cancel order:', orderId);
  };

  return (
    <div className="min-h-screen bg-background">
      <StatusBar
        botStatus={botStatus}
        market="ETHUSDT"
        sessionTime="02:34:12"
        connectionStatus="connected"
        onPauseResume={handlePauseResume}
        onSettings={handleSettings}
      />
      
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="Total Volume"
            value="$45,231"
            icon={DollarSign}
            trend={{ direction: "up", value: "+12.5%" }}
            progress={45.2}
          />
          <MetricCard
            label="Total Trades"
            value="1,247"
            icon={Activity}
            trend={{ direction: "up", value: "+8.3%" }}
          />
          <MetricCard
            label="Current P&L"
            value="-$3.42"
            unit="USD"
            icon={TrendingUp}
            trend={{ direction: "down", value: "-0.34%" }}
          />
          <MetricCard
            label="Active Orders"
            value="18"
            icon={Zap}
          />
          <MetricCard
            label="Hourly Rate"
            value="$1,884"
            unit="/hr"
            icon={Clock}
            trend={{ direction: "up", value: "+5.2%" }}
          />
          <MetricCard
            label="Target Progress"
            value="45.2"
            unit="%"
            icon={Target}
            progress={45.2}
          />
        </div>

        {/* Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityFeed logs={mockLogs} />
          <VolumeChart data={mockChartData} />
        </div>

        {/* Orders Table */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Active Orders
          </h2>
          <OrdersTable orders={mockOrders} onCancelOrder={handleCancelOrder} />
        </div>

        {/* Config Panel */}
        <ConfigPanel config={mockConfig} />
      </div>
    </div>
  );
}
