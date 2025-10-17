import ConfigPanel from '../ConfigPanel';

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

export default function ConfigPanelExample() {
  return (
    <div className="p-4 bg-background">
      <ConfigPanel config={mockConfig} />
    </div>
  );
}
