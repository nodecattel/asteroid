import OrdersTable, { Order } from '../OrdersTable';

const mockOrders: Order[] = [
  { id: "1", time: "14:32:45", side: "BUY", price: 2345.67, quantity: 0.0234, status: "NEW" },
  { id: "2", time: "14:32:43", side: "SELL", price: 2346.12, quantity: 0.0189, status: "PARTIALLY_FILLED" },
  { id: "3", time: "14:32:41", side: "BUY", price: 2345.34, quantity: 0.0267, status: "NEW" },
  { id: "4", time: "14:32:38", side: "SELL", price: 2346.89, quantity: 0.0145, status: "FILLED" },
  { id: "5", time: "14:32:35", side: "BUY", price: 2345.01, quantity: 0.0298, status: "NEW" },
];

export default function OrdersTableExample() {
  return (
    <div className="p-4 bg-background">
      <OrdersTable 
        orders={mockOrders} 
        onCancelOrder={(id) => console.log('Cancel order:', id)}
      />
    </div>
  );
}
