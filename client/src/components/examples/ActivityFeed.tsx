import ActivityFeed, { ActivityLog } from '../ActivityFeed';

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

export default function ActivityFeedExample() {
  return (
    <div className="p-4 bg-background">
      <ActivityFeed logs={mockLogs} />
    </div>
  );
}
