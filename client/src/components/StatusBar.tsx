import { Activity, Pause, Play, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface StatusBarProps {
  botStatus: "running" | "paused" | "stopped" | "error";
  market: string;
  sessionTime: string;
  connectionStatus: "connected" | "disconnected";
  onPauseResume: () => void;
  onSettings: () => void;
}

export default function StatusBar({
  botStatus,
  market,
  sessionTime,
  connectionStatus,
  onPauseResume,
  onSettings,
}: StatusBarProps) {
  const statusConfig = {
    running: { label: "Running", color: "bg-primary", icon: Activity },
    paused: { label: "Paused", color: "bg-muted-foreground", icon: Pause },
    stopped: { label: "Stopped", color: "bg-muted-foreground", icon: Pause },
    error: { label: "Error", color: "bg-destructive", icon: Activity },
  };

  const config = statusConfig[botStatus];
  const StatusIcon = config.icon;

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="border-b border-primary/30" />
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${config.color} animate-pulse`} />
            <div className="flex items-center gap-2">
              <StatusIcon className="h-4 w-4" data-testid="icon-status" />
              <span className="text-sm font-medium" data-testid="text-bot-status">
                {config.label}
              </span>
            </div>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Market</span>
            <Badge variant="outline" className="font-mono" data-testid="badge-market">
              {market}
            </Badge>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Session</span>
            <span className="font-mono text-sm" data-testid="text-session-time">
              {sessionTime}
            </span>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-primary' : 'bg-destructive'}`} />
            <span className="text-xs text-muted-foreground" data-testid="text-connection-status">
              {connectionStatus}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onPauseResume}
            data-testid="button-pause-resume"
          >
            {botStatus === "running" ? (
              <>
                <Pause className="h-3.5 w-3.5 mr-1.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Resume
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onSettings}
            data-testid="button-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
