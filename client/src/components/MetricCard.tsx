import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    direction: "up" | "down";
    value: string;
  };
  icon?: LucideIcon;
  progress?: number;
}

export default function MetricCard({
  label,
  value,
  unit,
  trend,
  icon: Icon,
  progress,
}: MetricCardProps) {
  return (
    <Card className="p-4 hover-elevate" data-testid={`card-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </span>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${
            trend.direction === "up" ? "text-primary" : "text-destructive"
          }`}>
            {trend.direction === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span className="font-mono">{trend.value}</span>
          </div>
        )}
      </div>
      
      <div className="mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold font-mono tabular-nums" data-testid={`text-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground font-mono">{unit}</span>
          )}
        </div>
      </div>
      
      {progress !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground font-mono">
              {progress.toFixed(1)}% Complete
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
