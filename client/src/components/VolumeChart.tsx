import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface HourlyData {
  hour: string;
  volume: number;
  target: number;
}

interface VolumeChartProps {
  data: HourlyData[];
}

export default function VolumeChart({ data }: VolumeChartProps) {
  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Hourly Volume Progress
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey="hour" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Volume']}
          />
          <Bar 
            dataKey="volume" 
            fill="hsl(var(--primary))" 
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            dataKey="target" 
            fill="hsl(var(--muted))" 
            radius={[4, 4, 0, 0]}
            opacity={0.3}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
