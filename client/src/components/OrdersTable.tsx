import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface Order {
  id: string;
  time: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  status: "NEW" | "PARTIALLY_FILLED" | "FILLED";
}

interface OrdersTableProps {
  orders: Order[];
  onCancelOrder: (orderId: string) => void;
}

export default function OrdersTable({ orders, onCancelOrder }: OrdersTableProps) {
  return (
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
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {orders.map((order, idx) => (
              <tr 
                key={order.id} 
                className="hover-elevate"
                style={{ backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                data-testid={`row-order-${order.id}`}
              >
                <td className="px-4 py-2 text-sm font-mono text-muted-foreground">
                  {order.time}
                </td>
                <td className="px-4 py-2 text-sm">
                  <Badge 
                    variant={order.side === "BUY" ? "default" : "destructive"}
                    className="font-mono text-xs"
                  >
                    {order.side}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-sm font-mono text-right tabular-nums">
                  ${typeof order.price === 'string' ? parseFloat(order.price).toFixed(2) : order.price.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-sm font-mono text-right tabular-nums">
                  {typeof order.quantity === 'string' ? parseFloat(order.quantity).toFixed(4) : order.quantity.toFixed(4)}
                </td>
                <td className="px-4 py-2 text-sm">
                  <Badge variant="outline" className="font-mono text-xs">
                    {order.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  {order.status === "NEW" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCancelOrder(order.id)}
                      data-testid={`button-cancel-${order.id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {orders.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">No active orders</p>
        </div>
      )}
    </div>
  );
}
