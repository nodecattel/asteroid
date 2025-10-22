import { EventEmitter } from 'events';
import { AsterdexClient } from './asterdex-client.js';
import type { IStorage } from './storage.js';
import type { AIAgentInstance } from '@shared/schema';

/**
 * Agent Monitor
 * 
 * Monitors AI agent performance and automatically closes positions when
 * percentage or USDT-based profit/loss targets are met.
 */
export class AgentMonitor extends EventEmitter {
  private storage: IStorage;
  private client: AsterdexClient;
  private monitorInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private checkIntervalMs: number = 30000; // Check every 30 seconds

  constructor(storage: IStorage, client: AsterdexClient) {
    super();
    this.storage = storage;
    this.client = client;
  }

  /**
   * Start monitoring all running agents
   */
  start(): void {
    if (this.isRunning) {
      console.log('[AgentMonitor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[AgentMonitor] 🚀 Started monitoring AI agents');

    // Run immediately and then at intervals
    this.checkAllAgents();
    this.monitorInterval = setInterval(() => {
      this.checkAllAgents();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    console.log('[AgentMonitor] Stopped monitoring');
  }

  /**
   * Check all running agents for target achievement
   */
  private async checkAllAgents(): Promise<void> {
    try {
      const agents = await this.storage.getAllAIAgents();
      const runningAgents = agents.filter(a => a.status === 'running');

      if (runningAgents.length === 0) {
        return;
      }

      console.log(`[AgentMonitor] Checking ${runningAgents.length} running agents`);

      for (const agent of runningAgents) {
        try {
          await this.checkAgentTargets(agent);
        } catch (error: any) {
          console.error(`[AgentMonitor] Error checking agent ${agent.id}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('[AgentMonitor] Error in checkAllAgents:', error.message);
    }
  }

  /**
   * Check a single agent's performance against targets
   */
  private async checkAgentTargets(agent: AIAgentInstance): Promise<void> {
    const { id, config, currentBalance, totalPnL } = agent;
    const { startingCapital, targetProfitUsdt, maxLossUsdt, targetProfitPercent, maxLossPercent } = config;

    // Calculate current profit/loss values
    const profitLoss = currentBalance - startingCapital; // Net P&L
    const profitLossPercent = (profitLoss / startingCapital) * 100;

    // Check USDT profit target
    if (targetProfitUsdt !== undefined && profitLoss >= targetProfitUsdt) {
      console.log(`[AgentMonitor] 🎯 Agent ${id} hit profit target: ${profitLoss.toFixed(2)} USDT >= ${targetProfitUsdt} USDT`);
      await this.closeAgentPositionsAndStop(agent, `Profit target reached: +${profitLoss.toFixed(2)} USDT (+${profitLossPercent.toFixed(2)}%)`);
      return;
    }

    // Check percentage profit target
    if (targetProfitPercent !== undefined && profitLossPercent >= targetProfitPercent) {
      console.log(`[AgentMonitor] 🎯 Agent ${id} hit profit target: ${profitLossPercent.toFixed(2)}% >= ${targetProfitPercent}%`);
      await this.closeAgentPositionsAndStop(agent, `Profit target reached: +${profitLossPercent.toFixed(2)}% (+${profitLoss.toFixed(2)} USDT)`);
      return;
    }

    // Check USDT loss limit (profitLoss will be negative for losses)
    if (maxLossUsdt !== undefined && profitLoss <= -maxLossUsdt) {
      console.log(`[AgentMonitor] 🛑 Agent ${id} hit loss limit: ${profitLoss.toFixed(2)} USDT <= -${maxLossUsdt} USDT`);
      await this.closeAgentPositionsAndStop(agent, `Loss limit reached: ${profitLoss.toFixed(2)} USDT (${profitLossPercent.toFixed(2)}%)`);
      return;
    }

    // Check percentage loss limit
    if (maxLossPercent !== undefined && profitLossPercent <= -maxLossPercent) {
      console.log(`[AgentMonitor] 🛑 Agent ${id} hit loss limit: ${profitLossPercent.toFixed(2)}% <= -${maxLossPercent}%`);
      await this.closeAgentPositionsAndStop(agent, `Loss limit reached: ${profitLossPercent.toFixed(2)}% (${profitLoss.toFixed(2)} USDT)`);
      return;
    }
  }

  /**
   * Close all positions for an agent and stop it
   */
  private async closeAgentPositionsAndStop(agent: AIAgentInstance, reason: string): Promise<void> {
    try {
      console.log(`[AgentMonitor] 🔴 Closing all positions for agent ${agent.id}: ${reason}`);

      // Get all open positions
      const positions = await this.client.getPositionRisk();
      
      if (positions && positions.length > 0) {
        console.log(`[AgentMonitor] Found ${positions.length} positions to close`);
        
        // Close each position with market order
        for (const position of positions) {
          try {
            const quantity = Math.abs(parseFloat(position.positionAmt || '0'));
            if (quantity > 0) {
              const side = parseFloat(position.positionAmt) > 0 ? 'SELL' : 'BUY';
              
              console.log(`[AgentMonitor] Closing ${position.symbol} position: ${side} ${quantity}`);
              
              await this.client.placeOrder({
                symbol: position.symbol,
                side: side,
                type: 'MARKET',
                quantity: quantity,
                reduceOnly: true,
              });
            }
          } catch (error: any) {
            console.error(`[AgentMonitor] Error closing position ${position.symbol}:`, error.message);
          }
        }
      }

      // Update agent status to stopped
      await this.storage.updateAIAgent(agent.id, {
        status: 'stopped',
        lastUpdate: new Date().toISOString(),
      });

      // Add reasoning log
      await this.storage.addAIAgentReasoning({
        agentId: agent.id,
        modelName: agent.modelName,
        timestamp: new Date().toISOString(),
        marketCondition: 'TARGET_ACHIEVED',
        decision: 'close_position',
        reasoning: `🎯 Agent stopped automatically: ${reason}. All positions closed to realize P&L.`,
        symbols: agent.config.allowedSymbols,
        accountBalance: agent.currentBalance,
        openPositions: 0,
        riskLevel: 'low',
      });

      // Emit event
      this.emit('agentStopped', {
        agentId: agent.id,
        reason,
        finalBalance: agent.currentBalance,
        totalPnL: agent.totalPnL,
      });

      console.log(`[AgentMonitor] ✅ Agent ${agent.id} stopped successfully`);
    } catch (error: any) {
      console.error(`[AgentMonitor] Error closing positions for agent ${agent.id}:`, error.message);
      
      // Still try to stop the agent even if position closing failed
      await this.storage.updateAIAgent(agent.id, {
        status: 'error',
        lastUpdate: new Date().toISOString(),
      });
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): { running: boolean; checkIntervalMs: number } {
    return {
      running: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
    };
  }
}
