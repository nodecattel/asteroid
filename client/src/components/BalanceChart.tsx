import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BalanceHistory } from "@shared/schema";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AI_PROVIDER_COLORS } from "./AIProviderIcon";

interface BalanceChartProps {
  history: BalanceHistory[];
}

// Function to extract provider from source name (format: "Agent: Provider - Model")
function getProviderFromSource(sourceName: string): string | null {
  const match = sourceName.match(/Agent: ([^-]+)/);
  return match ? match[1].trim() : null;
}

// Function to get brand color for a balance history item
function getBrandColor(item: BalanceHistory): string {
  if (item.source === 'agent') {
    const provider = getProviderFromSource(item.sourceName);
    if (provider && AI_PROVIDER_COLORS[provider]) {
      return AI_PROVIDER_COLORS[provider];
    }
  }
  // Default to primary color for bots and unknown sources
  return 'hsl(var(--primary))';
}

export default function BalanceChart({ history }: BalanceChartProps) {
  const chartData = [...history]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((item, index) => ({
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      balance: item.balance,
      change: item.change,
      icon: item.sourceIcon || '📊',
      name: item.sourceName,
      source: item.source,
      color: getBrandColor(item),
      index,
    }));

  const latestBalance = history.length > 0 ? history[0].balance : 0;
  const oldestBalance = history.length > 0 ? history[history.length - 1].balance : 0;
  const totalChange = latestBalance - oldestBalance;
  const changePercent = oldestBalance !== 0 ? (totalChange / oldestBalance) * 100 : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-md p-3 shadow-lg">
          <p className="text-sm font-medium">{data.time}</p>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="mr-2">{data.icon}</span>
            {data.name} ({data.source})
          </p>
          <p className="text-sm font-bold mt-1">
            ${data.balance.toFixed(2)}
          </p>
          <p className={`text-xs mt-1 ${data.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom dot component to render different colors based on source
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={payload.color}
        stroke="none"
      />
    );
  };

  // Custom active dot component
  const CustomActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={payload.color}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    );
  };

  return (
    <Card data-testid="card-balance-chart">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base sm:text-lg">Account Balance History</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Track balance changes across all bots and agents
          </CardDescription>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" data-testid="text-current-balance">
            ${latestBalance.toFixed(2)}
          </div>
          <div className={`text-sm flex items-center gap-1 justify-end ${changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {changePercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="w-full h-[200px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke={(entry: any) => entry.color || 'hsl(var(--primary))'}
                  strokeWidth={2}
                  dot={<CustomDot />}
                  activeDot={<CustomActiveDot />}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No balance history available yet.</p>
            <p className="text-xs mt-1">Balance changes will be tracked when bots or agents start trading.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
