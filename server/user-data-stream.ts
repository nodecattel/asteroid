import WebSocket from 'ws';
import { AsterdexClient } from './asterdex-client';

export interface UserDataStreamEvent {
  eventType: 'MARGIN_CALL' | 'ACCOUNT_UPDATE' | 'ORDER_TRADE_UPDATE' | 'listenKeyExpired';
  eventTime: number;
  data: any;
}

export class UserDataStreamManager {
  private client: AsterdexClient;
  private ws: WebSocket | null = null;
  private listenKey: string | null = null;
  private keepaliveInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseUrl: string;
  private eventHandlers: Map<string, ((event: UserDataStreamEvent) => void)[]> = new Map();

  constructor(client: AsterdexClient, baseUrl: string = 'wss://fstream.asterdex.com') {
    this.client = client;
    this.baseUrl = baseUrl;
  }

  async start(): Promise<void> {
    try {
      this.listenKey = await this.client.startUserDataStream();
      
      this.ws = new WebSocket(`${this.baseUrl}/ws/${this.listenKey}`);

      this.ws.on('open', () => {
        console.log('User data stream connected');
        this.reconnectAttempts = 0;
        this.startKeepalive();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });

      this.ws.on('close', () => {
        console.log('User data stream disconnected');
        this.stopKeepalive();
        this.attemptReconnect();
      });

    } catch (error) {
      console.error('Failed to start user data stream:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.stopKeepalive();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.listenKey) {
      try {
        await this.client.closeUserDataStream();
      } catch (error) {
        console.error('Error closing user data stream:', error);
      }
      this.listenKey = null;
    }
  }

  on(eventType: string, handler: (event: UserDataStreamEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: (event: UserDataStreamEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(message: any): void {
    let eventType: UserDataStreamEvent['eventType'];
    
    if (message.e === 'MARGIN_CALL') {
      eventType = 'MARGIN_CALL';
    } else if (message.e === 'ACCOUNT_UPDATE') {
      eventType = 'ACCOUNT_UPDATE';
    } else if (message.e === 'ORDER_TRADE_UPDATE') {
      eventType = 'ORDER_TRADE_UPDATE';
    } else if (message.e === 'listenKeyExpired') {
      eventType = 'listenKeyExpired';
      this.handleListenKeyExpired();
      return;
    } else {
      console.log('Unknown event type:', message.e);
      return;
    }

    const event: UserDataStreamEvent = {
      eventType,
      eventTime: message.E || Date.now(),
      data: message,
    };

    this.emitEvent(eventType, event);
    this.emitEvent('*', event);
  }

  private emitEvent(eventType: string, event: UserDataStreamEvent): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  private startKeepalive(): void {
    this.keepaliveInterval = setInterval(async () => {
      try {
        await this.client.keepaliveUserDataStream();
      } catch (error) {
        console.error('Failed to keepalive user data stream:', error);
      }
    }, 30 * 60 * 1000);
  }

  private stopKeepalive(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  private async handleListenKeyExpired(): Promise<void> {
    console.log('Listen key expired, restarting stream...');
    await this.stop();
    await this.start();
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.start();
      } catch (error) {
        console.error('Reconnect failed:', error);
        this.attemptReconnect();
      }
    }, delay);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
