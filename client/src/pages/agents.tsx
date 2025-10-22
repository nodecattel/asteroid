import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { aiAgentConfigSchema, type AIAgentInstance, type AIAgentTrade } from "@shared/schema";
import { Play, Pause, Trash2, Bot, TrendingUp, TrendingDown, DollarSign, Activity, Target, AlertCircle, Info, Sparkles, Key, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import StatusBar from "@/components/StatusBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Form schema with string handling for allowedSymbols
const createAgentFormSchema = aiAgentConfigSchema.omit({ allowedSymbols: true, apiKey: true }).extend({
  allowedSymbols: z.array(z.string()).min(1, "Select at least one market"),
  apiKey: z.string().optional(),
});

type CreateAgentFormData = z.infer<typeof createAgentFormSchema>;

interface Market {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  volume24h: number;
  quoteVolume24h: number;
  priceChangePercent24h: number;
}

interface AvailableModel {
  provider: string;
  models: string[];
  defaultModel: string;
  icon: string;
}

export default function AgentsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const { toast } = useToast();

  // Fetch available models
  const { data: modelsData } = useQuery<{ data: AvailableModel[]; hasAnyKeys: boolean }>({
    queryKey: ['/api/agents/available-models'],
  });

  // Fetch all agents
  const { data: agentsData, isLoading } = useQuery<{ data: AIAgentInstance[] }>({
    queryKey: ['/api/agents'],
  });

  // Fetch all trades
  const { data: tradesData } = useQuery<{ data: AIAgentTrade[] }>({
    queryKey: ['/api/agents/trades/all'],
  });

  // Fetch available markets
  const { data: marketsData } = useQuery<{ success: boolean; data: Market[] }>({
    queryKey: ['/api/markets'],
    refetchInterval: 60 * 1000,
  });

  const agents = agentsData?.data || [];
  const trades = tradesData?.data || [];
  const markets = marketsData?.data || [];
  const availableModels = modelsData?.data || [];
  const hasApiKeys = modelsData?.hasAnyKeys || false;

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/agents', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Agent Created",
        description: "AI agent has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create agent",
        variant: "destructive",
      });
    },
  });

  // Update agent (start/stop/pause)
  const updateAgentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest('PATCH', `/api/agents/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
    },
  });

  // Delete agent
  const deleteAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/agents/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      toast({
        title: "Agent Deleted",
        description: "AI agent has been removed.",
      });
    },
  });

  const form = useForm<CreateAgentFormData>({
    resolver: zodResolver(createAgentFormSchema),
    defaultValues: {
      modelName: "",
      modelProvider: "",
      startingCapital: 1000,
      maxPositionSize: 200,
      targetProfitUsdt: 100,
      maxLossUsdt: 100,
      allowedSymbols: [],
      apiKey: "",
      mcpConnectionType: 'http',
    },
  });

  // Update model name when provider changes
  useEffect(() => {
    if (selectedProvider) {
      const providerData = availableModels.find(m => m.provider === selectedProvider);
      if (providerData) {
        form.setValue('modelName', providerData.defaultModel);
      }
    }
  }, [selectedProvider, availableModels, form]);

  function onSubmit(data: CreateAgentFormData) {
    createAgentMutation.mutate(data);
  }

  const handleToggleAgent = (agent: AIAgentInstance) => {
    const newStatus = agent.status === 'running' ? 'paused' : 'running';
    updateAgentMutation.mutate({
      id: agent.id,
      updates: { status: newStatus },
    });
  };

  const handleDeleteAgent = (id: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      deleteAgentMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading agents...</div>
      </div>
    );
  }

  // Calculate aggregate stats
  const totalAgents = agents.length;
  const runningAgents = agents.filter((a) => a.status === 'running').length;
  const totalBalance = agents.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalPnL = agents.reduce((sum, a) => sum + a.totalPnL, 0);

  // Top markets by volume for easy selection
  const topMarkets = [...markets]
    .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h)
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-background">
      <StatusBar
        botStatus={runningAgents > 0 ? "running" : "stopped"}
        market={`${totalAgents} AI Agents`}
        sessionTime={`${runningAgents} Active`}
        connectionStatus="connected"
        onPauseResume={() => {}}
        onSettings={() => {}}
      />
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="w-8 h-8" />
              AI Trading Agents
            </h1>
            <p className="text-muted-foreground mt-1">
              Autonomous AI-powered trading via Model Context Protocol
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-agent" disabled={!hasApiKeys}>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Create AI Trading Agent
                </DialogTitle>
                <DialogDescription>
                  Configure a new autonomous AI agent that will trade on your behalf using advanced reasoning
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* AI Model Section */}
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      AI Model Selection
                    </div>
                    <FormField
                      control={form.control}
                      name="modelProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Provider</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedProvider(value);
                            }}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-provider">
                                <SelectValue placeholder="Select AI provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableModels.map((model) => (
                                <SelectItem key={model.provider} value={model.provider}>
                                  <span className="flex items-center gap-2">
                                    <span>{model.icon}</span>
                                    {model.provider}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose your preferred AI model provider
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedProvider && (
                      <FormField
                        control={form.control}
                        name="modelName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Model</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-model">
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableModels
                                  .find((m) => m.provider === selectedProvider)
                                  ?.models.map((modelName) => (
                                    <SelectItem key={modelName} value={modelName}>
                                      {modelName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Specific AI model to use for trading decisions
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Optional API Key Override */}
                    <Collapsible open={showApiKeyInput} onOpenChange={setShowApiKeyInput}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-2 text-xs"
                        >
                          <Key className="w-3 h-3" />
                          {showApiKeyInput ? 'Hide' : 'Use custom API key'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${showApiKeyInput ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2">
                        <FormField
                          control={form.control}
                          name="apiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  {...field}
                                  placeholder="Override environment API key"
                                  data-testid="input-api-key"
                                />
                              </FormControl>
                              <FormDescription>
                                Leave empty to use the configured environment variable
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Investment Parameters Section */}
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Investment Parameters
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startingCapital"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Investment (USDT)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                data-testid="input-starting-capital"
                              />
                            </FormControl>
                            <FormDescription>Starting balance for the agent</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxPositionSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Position Size (USDT)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                data-testid="input-max-position"
                              />
                            </FormControl>
                            <FormDescription>Max per single trade</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="targetProfitUsdt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-green-500" />
                              Capital Gain Goal (USDT)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                data-testid="input-target-profit"
                              />
                            </FormControl>
                            <FormDescription>Agent stops when profit reaches this</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxLossUsdt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              Max Acceptable Loss (USDT)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                data-testid="input-max-loss"
                              />
                            </FormControl>
                            <FormDescription>Agent stops when loss reaches this</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Market Selection Section */}
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Trading Markets
                    </div>
                    <FormField
                      control={form.control}
                      name="allowedSymbols"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel>Select Markets to Trade</FormLabel>
                            <FormDescription>
                              Agent will analyze and trade only these markets
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
                            {topMarkets.map((market) => (
                              <FormField
                                key={market.symbol}
                                control={form.control}
                                name="allowedSymbols"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={market.symbol}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(market.symbol)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, market.symbol])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== market.symbol
                                                  )
                                                );
                                          }}
                                          data-testid={`checkbox-${market.symbol}`}
                                        />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                        <FormLabel className="text-sm font-medium cursor-pointer">
                                          {market.symbol}
                                        </FormLabel>
                                        <p className="text-xs text-muted-foreground">
                                          {market.priceChangePercent24h >= 0 ? '+' : ''}
                                          {market.priceChangePercent24h.toFixed(2)}% • Vol: $
                                          {(market.quoteVolume24h / 1000000).toFixed(1)}M
                                        </p>
                                      </div>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAgentMutation.isPending} data-testid="button-submit">
                      {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* MCP Info Banner */}
        {!hasApiKeys && (
          <Alert className="border-primary/50 bg-primary/5">
            <Info className="w-4 h-4" />
            <AlertTitle className="font-semibold">Setup Required: Configure AI Model API Keys</AlertTitle>
            <AlertDescription className="space-y-3 mt-2">
              <p>
                To create AI trading agents, you need to configure API keys for at least one AI model provider in your environment variables.
              </p>
              <div className="space-y-2">
                <p className="font-medium">Supported Providers:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Anthropic (Claude)</strong> - Set <code className="bg-muted px-1 rounded">ANTHROPIC_API_KEY</code></li>
                  <li><strong>OpenAI (GPT-4)</strong> - Set <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code></li>
                  <li><strong>DeepSeek</strong> - Set <code className="bg-muted px-1 rounded">DEEPSEEK_API_KEY</code></li>
                  <li><strong>xAI (Grok)</strong> - Set <code className="bg-muted px-1 rounded">XAI_API_KEY</code></li>
                  <li><strong>Alibaba (Qwen)</strong> - Set <code className="bg-muted px-1 rounded">QWEN_API_KEY</code></li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                Check <code className="bg-muted px-1 rounded">.env.example</code> for detailed setup instructions.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {hasApiKeys && agents.length === 0 && (
          <Alert>
            <Sparkles className="w-4 h-4" />
            <AlertTitle>What are AI Trading Agents?</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p>
                AI agents use the <strong>Model Context Protocol (MCP)</strong> to autonomously analyze markets and execute trades.
                Unlike traditional bots with fixed rules, AI agents make intelligent decisions based on market conditions.
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                <li>Autonomous decision-making based on market analysis</li>
                <li>Real-time position management and risk control</li>
                <li>Multiple models can trade simultaneously with different strategies</li>
                <li>All trades executed via secure MCP protocol</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Agents Grid */}
        {agents.length === 0 && hasApiKeys ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bot className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No AI Agents Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first AI trading agent to start autonomous trading
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first">
                <Sparkles className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </CardContent>
          </Card>
        ) : agents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5" />
                      <div>
                        <CardTitle className="text-lg">{agent.modelName}</CardTitle>
                        <CardDescription>{agent.modelProvider}</CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={
                        agent.status === 'running'
                          ? 'default'
                          : agent.status === 'paused'
                          ? 'secondary'
                          : 'outline'
                      }
                      data-testid={`badge-status-${agent.id}`}
                    >
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Balance</div>
                      <div className="text-xl font-bold flex items-center gap-1" data-testid={`text-balance-${agent.id}`}>
                        <DollarSign className="w-4 h-4" />
                        {agent.currentBalance.toFixed(2)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">P&L</div>
                      <div
                        className={`text-xl font-bold flex items-center gap-1 ${
                          agent.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                        data-testid={`text-pnl-${agent.id}`}
                      >
                        {agent.totalPnL >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {agent.totalPnL >= 0 ? '+' : ''}
                        {agent.totalPnL.toFixed(2)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Trades</div>
                      <div className="text-lg font-semibold" data-testid={`text-trades-${agent.id}`}>
                        {agent.totalTrades}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                      <div className="text-lg font-semibold" data-testid={`text-winrate-${agent.id}`}>
                        {agent.winRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Goals Progress */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Profit Goal
                      </span>
                      <span className="font-medium">
                        ${agent.config.targetProfitUsdt}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Max Loss
                      </span>
                      <span className="font-medium">
                        ${agent.config.maxLossUsdt}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Markets</span>
                      <span className="font-medium">
                        {agent.config.allowedSymbols.length}
                      </span>
                    </div>
                  </div>

                  {/* Position Info */}
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Open Positions</span>
                    <Badge variant="outline" data-testid={`badge-positions-${agent.id}`}>
                      <Activity className="w-3 h-3 mr-1" />
                      {agent.openPositions}
                    </Badge>
                  </div>

                  {/* Controls */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant={agent.status === 'running' ? 'secondary' : 'default'}
                      className="flex-1"
                      onClick={() => handleToggleAgent(agent)}
                      disabled={updateAgentMutation.isPending}
                      data-testid={`button-toggle-${agent.id}`}
                    >
                      {agent.status === 'running' ? (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteAgent(agent.id)}
                      disabled={deleteAgentMutation.isPending}
                      data-testid={`button-delete-${agent.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {/* Recent Trades Feed */}
        {trades.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Agent Trades</CardTitle>
              <CardDescription>Latest trades from all AI agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {trades.slice(0, 20).map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                    data-testid={`trade-${trade.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{trade.modelName}</Badge>
                      <div>
                        <div className="font-semibold">
                          {trade.symbol} {trade.type}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {trade.quantity} @ ${trade.entryPrice.toFixed(2)}
                          {trade.exitPrice && ` → $${trade.exitPrice.toFixed(2)}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-bold ${
                          trade.realizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {trade.realizedPnL >= 0 ? '+' : ''}${trade.realizedPnL.toFixed(2)}
                      </div>
                      {trade.exitTime && (
                        <div className="text-xs text-muted-foreground">
                          {Math.floor((new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime()) / 60000)}m
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
