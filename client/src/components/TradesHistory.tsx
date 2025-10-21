import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCryptoPrice } from "@/lib/utils";

export interface Trade {
  id: string;
  timestamp: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  quoteQuantity: number;
  commission: number;
  realizedPnl: number;
}

interface TradesHistoryProps {
  trades: Trade[];
  totalPnL: number;
}

export default function TradesHistory({ trades, totalPnL }: TradesHistoryProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 rounded-md border border-border">
        <div className="flex items-center gap-2">
          {totalPnL >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-medium text-muted-foreground">
            Total Realized P&L
          </span>
        </div>
        <span 
          className={`text-lg font-mono font-semibold ${
            totalPnL >= 0 ? 'text-green-500' : 'text-red-500'
          }`}
          data-testid="text-total-pnl"
        >
          {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} USDT
        </span>
      </div>

      {/* Trades Table */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Side
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Value
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Fee
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {trades.map((trade, idx) => (
                <tr 
                  key={trade.id} 
                  className="hover-elevate"
                  style={{ backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  data-testid={`row-trade-${trade.id}`}
                >
                  <td className="px-4 py-2 text-sm font-mono text-muted-foreground">
                    {formatTimestamp(trade.timestamp)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <Badge 
                      variant={trade.side === "BUY" ? "default" : "destructive"}
                      className="font-mono text-xs"
                    >
                      {trade.side}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-right tabular-nums">
                    ${formatCryptoPrice(trade.price)}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-right tabular-nums">
                    {trade.quantity.toFixed(4)}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-right tabular-nums">
                    ${formatCryptoPrice(trade.quoteQuantity)}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-right tabular-nums text-muted-foreground">
                    ${trade.commission.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {trades.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No trades executed yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
