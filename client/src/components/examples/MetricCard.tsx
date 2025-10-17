import MetricCard from '../MetricCard';
import { DollarSign, TrendingUp, Activity } from 'lucide-react';

export default function MetricCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-background">
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
    </div>
  );
}
