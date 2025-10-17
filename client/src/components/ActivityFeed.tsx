import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: "fill" | "error" | "info" | "cancel";
  message: string;
}

interface ActivityFeedProps {
  logs: ActivityLog[];
  maxHeight?: string;
}

export default function ActivityFeed({ logs, maxHeight = "400px" }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: ActivityLog["type"]) => {
    switch (type) {
      case "fill":
        return "text-primary";
      case "error":
        return "text-destructive";
      case "cancel":
        return "text-muted-foreground";
      default:
        return "text-foreground";
    }
  };

  const getLogPrefix = (type: ActivityLog["type"]) => {
    switch (type) {
      case "fill":
        return "[FILL]";
      case "error":
        return "[ERROR]";
      case "cancel":
        return "[CANCEL]";
      default:
        return "[INFO]";
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Activity Feed
        </h3>
        <span className="text-xs text-muted-foreground font-mono" data-testid="text-log-count">
          {logs.length} events
        </span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-y-auto space-y-1 font-mono text-xs"
        style={{ maxHeight }}
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3" data-testid={`log-${log.id}`}>
            <span className="text-muted-foreground shrink-0">{log.timestamp}</span>
            <span className={`${getLogColor(log.type)} shrink-0 font-medium`}>
              {getLogPrefix(log.type)}
            </span>
            <span className={getLogColor(log.type)}>{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            No activity yet
          </div>
        )}
      </div>
    </Card>
  );
}
