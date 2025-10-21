import { Activity, Pause, Play, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import asteroidLogo from "@assets/asteroid_1761014274709.png";

interface StatusBarProps {
  botStatus: "running" | "paused" | "stopped" | "error";
  market: string;
  sessionTime: string;
  connectionStatus: "connected" | "disconnected";
  fundingRate?: number;
  maxLeverage?: number;
  onPauseResume: () => void;
  onSettings: () => void;
}

export default function StatusBar({
  botStatus,
  market,
  sessionTime,
  connectionStatus,
  fundingRate,
  maxLeverage,
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
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <img 
              src={asteroidLogo} 
              alt="Astroid" 
              className="h-6 w-6 sm:h-7 sm:w-7"
              data-testid="img-astroid-logo-header"
            />
            <div className={`h-2 w-2 rounded-full ${config.color} animate-pulse`} />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <StatusIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" data-testid="icon-status" />
              <span className="text-xs sm:text-sm font-medium" data-testid="text-bot-status">
                {config.label}
              </span>
            </div>
          </div>
          
          <div className="h-4 w-px bg-border hidden sm:block" />
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider hidden sm:inline">Market</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs" data-testid="badge-market">
                {market}
              </Badge>
              {maxLeverage && (
                <Badge variant="secondary" className="text-xs hidden md:inline-flex">
                  Max {maxLeverage}x
                </Badge>
              )}
              {fundingRate !== undefined && fundingRate !== null && (
                <Badge 
                  variant={fundingRate >= 0 ? "default" : "destructive"} 
                  className="text-xs hidden lg:inline-flex"
                  data-testid="badge-funding-rate"
                >
                  Funding: {(fundingRate * 100).toFixed(4)}%
                </Badge>
              )}
            </div>
          </div>
          
          <div className="h-4 w-px bg-border hidden md:block" />
          
          <div className="flex items-center gap-1.5 sm:gap-2 hidden md:flex">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Session</span>
            <span className="font-mono text-xs sm:text-sm" data-testid="text-session-time">
              {sessionTime}
            </span>
          </div>
          
          <div className="h-4 w-px bg-border hidden lg:block" />
          
          <div className="flex items-center gap-1.5 sm:gap-2 hidden lg:flex">
            <div className={`h-1.5 w-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-primary' : 'bg-destructive'}`} />
            <span className="text-xs text-muted-foreground" data-testid="text-connection-status">
              {connectionStatus}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onPauseResume}
            data-testid="button-pause-resume"
            className="h-8"
          >
            {botStatus === "running" ? (
              <>
                <Pause className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Resume</span>
              </>
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onSettings}
            data-testid="button-settings"
            className="h-8 w-8"
          >
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      queryClient.clear();
      window.location.href = '/';
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleLogout}
      data-testid="button-logout"
      className="h-8 w-8"
      title="Logout"
    >
      <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
    </Button>
  );
}
