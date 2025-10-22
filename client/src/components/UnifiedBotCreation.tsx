import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, ArrowRight } from "lucide-react";

interface UnifiedBotCreationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketSymbol: string;
  onSelectType: (type: 'traditional' | 'agent') => void;
}

export default function UnifiedBotCreation({ 
  open, 
  onOpenChange, 
  marketSymbol,
  onSelectType 
}: UnifiedBotCreationProps) {
  const handleSelect = (type: 'traditional' | 'agent') => {
    onSelectType(type);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-unified-bot-creation">
        <DialogHeader>
          <DialogTitle className="text-xl">Create Trader for {marketSymbol}</DialogTitle>
          <DialogDescription>
            Choose the type of trader you want to create for this market
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Card 
            className="cursor-pointer hover-elevate active-elevate-2 transition-all"
            onClick={() => handleSelect('traditional')}
            data-testid="card-create-traditional-bot"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    Volume Generation Bot
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Traditional automated trading bot
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Create a traditional volume generation bot with manual configuration for:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Precise order placement and spread control</li>
                <li>Fixed leverage and margin allocation</li>
                <li>Customizable trading parameters</li>
                <li>Risk management with stop-loss/take-profit</li>
              </ul>
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect('traditional');
                  }}
                  data-testid="button-select-traditional-bot"
                >
                  Configure Traditional Bot
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover-elevate active-elevate-2 transition-all border-primary/20"
            onClick={() => handleSelect('agent')}
            data-testid="card-create-ai-agent"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    AI Trading Agent
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Autonomous AI-powered trader (MCP)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Create an AI agent that makes autonomous trading decisions using:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Multiple AI models (Claude, GPT-4, DeepSeek, Grok, Qwen)</li>
                <li>Simple investment goal configuration</li>
                <li>Autonomous strategy adaptation</li>
                <li>Real-time market analysis and reasoning</li>
              </ul>
              <div className="pt-2">
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect('agent');
                  }}
                  data-testid="button-select-ai-agent"
                >
                  Configure AI Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground text-center pb-2">
          Both types will trade on {marketSymbol} with independent capital allocation
        </div>
      </DialogContent>
    </Dialog>
  );
}
