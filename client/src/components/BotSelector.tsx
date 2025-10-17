import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Play, Pause, Square, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AVAILABLE_MARKETS } from "@shared/schema";

interface BotSelectorProps {
  bots: any[];
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
}

export default function BotSelector({ bots, selectedBotId, onSelectBot }: BotSelectorProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    marketSymbol: 'ETHUSDT',
    leverage: 10,
    investmentUsdt: 10,
    targetVolume: 100000,
    maxLoss: 10,
    targetHours: 24,
    spreadBps: 2,
    ordersPerSide: 10,
    orderSizePercent: 0.1,
    refreshInterval: 2.0,
    delayBetweenOrders: 0.05,
    delayAfterCancel: 0.3,
    maxOrdersToPlace: 10,
    usePostOnly: false,
    tradingFeePercent: 0.2,
  });

  const createBotMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/bots', data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      setIsCreateOpen(false);
      toast({ title: "Bot created successfully" });
      if (data?.data?.botId) {
        onSelectBot(data.data.botId);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create bot", description: error.message, variant: "destructive" });
    },
  });

  const startBotMutation = useMutation({
    mutationFn: async (botId: string) => {
      await apiRequest('POST', `/api/bots/${botId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      toast({ title: "Bot started" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start bot", description: error.message, variant: "destructive" });
    },
  });

  const pauseBotMutation = useMutation({
    mutationFn: async (botId: string) => {
      await apiRequest('POST', `/api/bots/${botId}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      toast({ title: "Bot paused" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to pause bot", description: error.message, variant: "destructive" });
    },
  });

  const stopBotMutation = useMutation({
    mutationFn: async (botId: string) => {
      await apiRequest('POST', `/api/bots/${botId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      toast({ title: "Bot stopped" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to stop bot", description: error.message, variant: "destructive" });
    },
  });

  const deleteBotMutation = useMutation({
    mutationFn: async (botId: string) => {
      await apiRequest('DELETE', `/api/bots/${botId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      toast({ title: "Bot deleted" });
      if (selectedBotId === deleteBotMutation.variables) {
        onSelectBot(bots[0]?.instance?.id || '');
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete bot", description: error.message, variant: "destructive" });
    },
  });

  const selectedBotData = bots.find(b => b.instance?.id === selectedBotId);
  const selectedBotStatus = selectedBotData?.instance?.status;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <Select value={selectedBotId || undefined} onValueChange={onSelectBot}>
          <SelectTrigger data-testid="select-bot" className="font-mono">
            <SelectValue placeholder="Select a bot" />
          </SelectTrigger>
          <SelectContent>
            {bots.filter(bot => bot.instance?.id).map((bot) => (
              <SelectItem key={bot.instance.id} value={bot.instance.id}>
                {bot.instance.marketSymbol} - {bot.instance.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedBotId && (
        <>
          {selectedBotStatus === 'stopped' && (
            <Button
              data-testid="button-start-bot"
              size="sm"
              onClick={() => startBotMutation.mutate(selectedBotId)}
              disabled={startBotMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          )}
          
          {selectedBotStatus === 'running' && (
            <Button
              data-testid="button-pause-bot"
              size="sm"
              variant="outline"
              onClick={() => pauseBotMutation.mutate(selectedBotId)}
              disabled={pauseBotMutation.isPending}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          
          {selectedBotStatus === 'paused' && (
            <Button
              data-testid="button-resume-bot"
              size="sm"
              onClick={() => startBotMutation.mutate(selectedBotId)}
              disabled={startBotMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}

          {(selectedBotStatus === 'running' || selectedBotStatus === 'paused') && (
            <Button
              data-testid="button-stop-bot"
              size="sm"
              variant="outline"
              onClick={() => stopBotMutation.mutate(selectedBotId)}
              disabled={stopBotMutation.isPending}
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          )}

          {selectedBotStatus === 'stopped' && (
            <Button
              data-testid="button-delete-bot"
              size="sm"
              variant="destructive"
              onClick={() => deleteBotMutation.mutate(selectedBotId)}
              disabled={deleteBotMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button data-testid="button-create-bot" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Bot
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto font-mono">
          <DialogHeader>
            <DialogTitle>Create New Bot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  data-testid="input-api-key"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiSecret">API Secret</Label>
                <Input
                  id="apiSecret"
                  data-testid="input-api-secret"
                  type="password"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marketSymbol">Market</Label>
                <Select
                  value={formData.marketSymbol}
                  onValueChange={(value) => setFormData({ ...formData, marketSymbol: value })}
                >
                  <SelectTrigger data-testid="select-market">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MARKETS.map((market) => (
                      <SelectItem key={market} value={market}>
                        {market}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leverage">Leverage</Label>
                <Input
                  id="leverage"
                  data-testid="input-leverage"
                  type="number"
                  value={formData.leverage}
                  onChange={(e) => setFormData({ ...formData, leverage: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="investment">Investment (USDT)</Label>
                <Input
                  id="investment"
                  data-testid="input-investment"
                  type="number"
                  step="0.01"
                  value={formData.investmentUsdt}
                  onChange={(e) => setFormData({ ...formData, investmentUsdt: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetVolume">Target Volume</Label>
                <Input
                  id="targetVolume"
                  data-testid="input-target-volume"
                  type="number"
                  value={formData.targetVolume}
                  onChange={(e) => setFormData({ ...formData, targetVolume: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxLoss">Max Loss</Label>
                <Input
                  id="maxLoss"
                  data-testid="input-max-loss"
                  type="number"
                  step="0.01"
                  value={formData.maxLoss}
                  onChange={(e) => setFormData({ ...formData, maxLoss: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetHours">Target Hours</Label>
                <Input
                  id="targetHours"
                  data-testid="input-target-hours"
                  type="number"
                  value={formData.targetHours}
                  onChange={(e) => setFormData({ ...formData, targetHours: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="spreadBps">Spread (bps)</Label>
                <Input
                  id="spreadBps"
                  data-testid="input-spread"
                  type="number"
                  step="0.1"
                  value={formData.spreadBps}
                  onChange={(e) => setFormData({ ...formData, spreadBps: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ordersPerSide">Orders/Side</Label>
                <Input
                  id="ordersPerSide"
                  data-testid="input-orders-per-side"
                  type="number"
                  value={formData.ordersPerSide}
                  onChange={(e) => setFormData({ ...formData, ordersPerSide: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderSize">Order Size (%)</Label>
                <Input
                  id="orderSize"
                  data-testid="input-order-size"
                  type="number"
                  step="0.01"
                  value={formData.orderSizePercent}
                  onChange={(e) => setFormData({ ...formData, orderSizePercent: Number(e.target.value) })}
                />
              </div>
            </div>

            <Button
              data-testid="button-submit-bot"
              className="w-full"
              onClick={() => createBotMutation.mutate(formData)}
              disabled={createBotMutation.isPending || !formData.apiKey || !formData.apiSecret}
            >
              {createBotMutation.isPending ? 'Creating...' : 'Create Bot'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
