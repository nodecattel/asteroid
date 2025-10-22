import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, TrendingUp, DollarSign, Activity } from "lucide-react";

interface OverviewData {
  bots: {
    total: number;
    active: number;
    totalPnL: number;
  };
  agents: {
    total: number;
    active: number;
    totalPnL: number;
  };
  account: {
    balance: number;
    availableBalance: number;
    totalPnL: number;
  };
  activeItems: Array<{
    id: string;
    type: 'bot' | 'agent';
    name: string;
    icon: string;
  }>;
}

interface OverviewCardsProps {
  overview: OverviewData;
}

export default function OverviewCards({ overview }: OverviewCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card data-testid="card-account-balance">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Account Balance</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-account-balance">
            ${overview.account.balance.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Available: ${overview.account.availableBalance.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-total-pnl">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${overview.account.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            data-testid="text-total-pnl"
          >
            {overview.account.totalPnL >= 0 ? '+' : ''}${overview.account.totalPnL.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Bots: ${overview.bots.totalPnL.toFixed(2)} | Agents: ${overview.agents.totalPnL.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-volume-bots">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Volume Bots</CardTitle>
          <Bot className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-bot-count">
            {overview.bots.active} / {overview.bots.total}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {overview.bots.active} running
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-ai-agents">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">AI Agents</CardTitle>
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-agent-count">
            {overview.agents.active} / {overview.agents.total}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {overview.agents.active} running
          </p>
        </CardContent>
      </Card>

      {overview.activeItems.length > 0 && (
        <Card className="sm:col-span-2 lg:col-span-4" data-testid="card-active-traders">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Traders</CardTitle>
            <CardDescription className="text-xs">
              Currently running bots and AI agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {overview.activeItems.map((item) => (
                <Badge
                  key={item.id}
                  variant="secondary"
                  className="text-xs"
                  data-testid={`badge-active-${item.type}-${item.id}`}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.name}
                  <span className="ml-1.5 text-muted-foreground">({item.type})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
