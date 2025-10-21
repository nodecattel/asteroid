"""
Volume Generator Bot for Asterdex.com
Fully Configurable via .env
"""
import asyncio
import os
import signal
import hmac
import hashlib
import urllib.parse
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
import time

load_dotenv()

class VolumeGeneratorBot:
    MARKETS = {
        0: "BTCUSDT", 1: "ETHUSDT", 2: "SOLUSDT", 3: "DOGEUSDT", 4: "HYPEUSDT",
        5: "ASTERUSDT", 6: "WLDUSDT", 7: "XPLUSDT", 8: "LINKUSDT", 9: "AVAXUSDT"
    }

    def __init__(self):
        self.api_key = os.getenv('API_KEY')
        self.api_secret = os.getenv('API_SECRET')
        self.base_url = os.getenv('BASE_URL', 'https://fapi.asterdex.com')
        
        # ===== Market & Trading Settings =====
        self.market_index = int(os.getenv('MARKET_INDEX', 1))
        self.leverage = int(os.getenv('LEVERAGE', 5))
        self.investment = float(os.getenv('INVESTMENT_USDT', 10))
        
        # ===== Volume Target Settings =====
        self.target_volume = float(os.getenv('TARGET_VOLUME', 100000))
        self.max_loss = float(os.getenv('MAX_LOSS', 10))
        self.target_hours = int(os.getenv('TARGET_HOURS', 24))
        
        # ===== Strategy Parameters =====
        self.spread_bps = float(os.getenv('SPREAD_BPS', 5))
        self.orders_per_side = int(os.getenv('ORDERS_PER_SIDE', 3))
        self.order_size_percent = float(os.getenv('ORDER_SIZE_PERCENT', 0.1))
        self.refresh_interval = float(os.getenv('REFRESH_INTERVAL', 2.0))
        
        # ===== Rate Limit Protection =====
        self.delay_between_orders = float(os.getenv('DELAY_BETWEEN_ORDERS', 0.05))
        self.delay_after_cancel = float(os.getenv('DELAY_AFTER_CANCEL', 0.3))
        self.status_interval = int(os.getenv('STATUS_INTERVAL', 30))
        
        # ===== Advanced Settings =====
        self.use_post_only = os.getenv('USE_POST_ONLY', 'false').lower() == 'true'
        self.max_orders_to_place = int(os.getenv('MAX_ORDERS_TO_PLACE', 10))
        self.trading_fee_percent = float(os.getenv('TRADING_FEE_PERCENT', 0.2))
        
        # Calculate derived metrics
        self.hourly_target = self.target_volume / self.target_hours
        self.trades_needed = int(self.target_volume / 10)
        self.avg_trade_size = self.target_volume / self.trades_needed
        
        # Internal tracking
        self.order_index = 50000
        self.market_symbol = self.MARKETS.get(self.market_index, f"Market{self.market_index}")
        
        self.running = True
        self.active_orders = {}
        self.total_volume = 0.0
        self.total_trades = 0
        self.total_fees = 0.0
        self.session_start = None
        self.last_fill_time = time.time()
        
        # Hourly tracking
        self.current_hour_volume = 0.0
        self.current_hour_trades = 0
        self.hour_start = None
        self.hourly_stats = []

        self.test_orderbook()
        
        # Symbol precision info
        self.price_precision = 2
        self.quantity_precision = 6

        #self.investment = float(os.getenv('INVESTMENT_USDT', 10))
        #self.leverage = int(os.getenv('LEVERAGE', 10))
        #self.order_size_percent = float(os.getenv('ORDER_SIZE_PERCENT', 0.1))

        # ตรวจสอบค่าพารามิเตอร์
        if self.investment <= 0:
            raise ValueError("❌ INVESTMENT_USDT must be greater than 0")
        if self.leverage <= 0:
            raise ValueError("❌ LEVERAGE must be greater than 0")
        if self.order_size_percent <= 0:
            raise ValueError("❌ ORDER_SIZE_PERCENT must be greater than 0")
        
    def get_asset_precision(self):
        """Get precision for the selected symbol"""
        try:
            url = f"{self.base_url}/fapi/v1/exchangeInfo"
            response = requests.get(url, timeout=5)
            response.raise_for_status()  # Check if request was successful
            data = response.json()

            # Default values
            price_precision = 8
            quantity_precision = 8
        
            if "symbols" not in data:
                print("⚠️ Unexpected API response format: missing 'symbols' key")
                return price_precision, quantity_precision

            found_symbol = False
            for symbol_info in data["symbols"]:
                if symbol_info["symbol"] == self.market_symbol:
                    found_symbol = True
                    filters = symbol_info.get("filters", [])
                    if not filters:
                        print("⚠️ No filters found for symbol")
                        return price_precision, quantity_precision

                    # Find PRICE_FILTER for price precision
                    for filter in filters:
                        if filter["filterType"] == "PRICE_FILTER":
                            tick_size = filter.get("tickSize", "1")
                            if isinstance(tick_size, str) and '.' in tick_size:
                                price_precision = len(tick_size.split('.')[1])
                            else:
                                price_precision = 0

                    # Find LOT_SIZE for quantity precision
                    for filter in filters:
                        if filter["filterType"] == "LOT_SIZE":
                            step_size = filter.get("stepSize", "1")
                            if isinstance(step_size, str) and '.' in step_size:
                                quantity_precision = len(step_size.split('.')[1])
                            else:
                                quantity_precision = 0

                    return price_precision, quantity_precision
            if not found_symbol:
                print(f"⚠️ Symbol {self.market_symbol} not found in exchange info")
                return price_precision, quantity_precision

        except Exception as e:
            print(f"⚠️ Error getting precision: {e}")
            return 8, 8  # ค่า default

    def get_symbol_info(self):
        """Get symbol precision from Asterdex exchangeInfo"""
        try:
            url = f"{self.base_url}/fapi/v1/exchangeInfo"
            response = requests.get(url, timeout=5)
            data = response.json()
        
            for symbol_info in data.get('symbols', []):
                if symbol_info['symbol'] == self.market_symbol:
                    self.price_precision = symbol_info.get('pricePrecision', 2)
                    self.quantity_precision = symbol_info.get('quantityPrecision', 6)
                
                    # เก็บข้อมูลเพิ่มเติม
                    self.min_qty = float(symbol_info.get('filters', [{}])[1].get('minQty', 0))
                    self.max_qty = float(symbol_info.get('filters', [{}])[1].get('maxQty', 0))
                
                    print(f"✅ Symbol Info for {self.market_symbol}:")
                    print(f"   Price Precision: {self.price_precision} decimals")
                    print(f"   Quantity Precision: {self.quantity_precision} decimals")
                    print(f"   Min Quantity: {self.min_qty}")
                    print(f"   Max Quantity: {self.max_qty}")
                    return True
        
                print(f"⚠️ Symbol {self.market_symbol} not found in exchangeInfo")
                return False
        
        except Exception as e:
            print(f"⚠️ Error fetching symbol info: {e}")
            return False

    def _sign(self, params):
        """Create HMAC SHA256 signature for Asterdex API"""
        query_string = urllib.parse.urlencode(params, doseq=True)
        return hmac.new(
            self.api_secret.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    def test_connectivity(self):
        """Test connection to Asterdex API"""
        try:
            ping = requests.get(f"{self.base_url}/fapi/v1/ping", timeout=5)
            time_resp = requests.get(f"{self.base_url}/fapi/v1/time", timeout=5)
            
            if ping.status_code == 200 and time_resp.status_code == 200:
                server_time = time_resp.json()
                print(f"✅ Connection to Asterdex successful")
                print(f"   Server time: {server_time.get('serverTime', 'N/A')}")
                return True
            else:
                print(f"❌ Connection failed")
                return False
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False

    def test_orderbook(self):
        """Test orderbook API and show structure"""
        try:
            url = f"{self.base_url}/fapi/v1/depth"
            params = {"symbol": self.market_symbol, "limit": 5}
            response = requests.get(url, params=params, timeout=5)
            
            print(f"🔍 Testing Orderbook API")
            print(f"   URL: {url}")
            print(f"   Symbol: {self.market_symbol}")
            print(f"   Status: {response.status_code}")
            
            if response.ok:
                data = response.json()
                print(f"📊 Response structure:")
                print(f"   Keys: {list(data.keys())}")
                
                if "bids" in data and data["bids"]:
                    print(f"   Bids (top 3):")
                    for i, bid in enumerate(data["bids"][:3]):
                        print(f"      [{i}] Price: {bid}, Qty: {bid[1]}")
                
                if "asks" in data and data["asks"]:
                    print(f"   Asks (top 3):")
                    for i, ask in enumerate(data["asks"][:3]):
                        print(f"      [{i}] Price: {ask}, Qty: {ask[1]}")
                
                return True
            else:
                print(f"   ❌ Error: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Exception: {e}")
            return False

    async def init(self):
        """Initialize bot"""
        print(f"{'='*75}")
        print(f"🚀 VOLUME GENERATOR BOT - FOR ASTERDEX.COM")
        print(f"{'='*75}")
        
        # Test connection
        if not self.test_connectivity():
            raise Exception("Cannot connect to Asterdex API")
        
        """
        # ✅ เพิ่มการดึง precision
        if not self.get_symbol_info():
            raise Exception("Cannot get symbol precision")
        """ 

        self.session_start = datetime.now()
        self.hour_start = datetime.now()
        
        print(f"📊 CONFIGURATION:")
        print(f"Market: {self.market_symbol} (Index: {self.market_index})")
        print(f"Investment: ${self.investment:.2f} (Leverage: {self.leverage}x)")
        print(f"Effective Capital: ${self.investment * self.leverage:.2f}")
        print(f"🎯 TARGETS:")
        print(f"   Volume Goal: ${self.target_volume:,.0f} in {self.target_hours}h")
        print(f"   Hourly Goal: ${self.hourly_target:,.0f}")
        print(f"   Max Loss: ${self.max_loss:.2f}")
        print(f"⚙️  STRATEGY CONFIG:")
        print(f"   Spread: {self.spread_bps/100:.3f}% ({self.spread_bps} bps)")
        print(f"   Orders: {self.orders_per_side*2} total ({self.orders_per_side} each side)")
        print(f"   Order Size: {self.order_size_percent*100:.1f}% of capital")
        print(f"   Refresh: Every {self.refresh_interval}s")
        print(f"🛡️  RATE LIMIT PROTECTION:")
        print(f"   Delay Between Orders: {self.delay_between_orders}s")
        print(f"   Delay After Cancel: {self.delay_after_cancel}s")
        print(f"   Max Orders/Cycle: {self.max_orders_to_place} per side")
        print(f"   Status Updates: Every {self.status_interval}s")
        print(f"💡 PROJECTIONS:")
        print(f"   Est. Trades Needed: ~{self.trades_needed:,}")
        print(f"   Avg Trade Size: ${self.avg_trade_size:.2f}")
        print(f"   Trading Fee: {self.trading_fee_percent}%")
        print(f"   Order Type: {'POST_ONLY' if self.use_post_only else 'GTC'}")
        print(f"{'='*75}")

    async def get_orderbook(self):
        """Get current orderbook from Asterdex"""
        try:
            url = f"{self.base_url}/fapi/v1/depth"
            params = {"symbol": self.market_symbol, "limit": 10}
            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            if data.get("bids") and data.get("asks"):
                best_bid = float(data["bids"][0][0])
                best_ask = float(data["asks"][0][0])
                """
                best_bid = float(data["bids"])
                best_ask = float(data["asks"])
                """
                mid_price = (best_bid + best_ask) / 2.0
                spread_pct = ((best_ask - best_bid) / mid_price) * 100.0
                
                return {
                    'best_bid': best_bid,
                    'best_ask': best_ask,
                    'mid_price': mid_price,
                    'spread_pct': spread_pct
                }
            return None
        except Exception as e:
            print(f"⚠️ Error fetching orderbook: {e}")
            return None

    async def calculate_order_levels(self, orderbook):
        """Calculate order levels with configurable spread"""
        try:
            mid_price = orderbook['mid_price']
            best_bid = orderbook['best_bid']
            best_ask = orderbook['best_ask']

            # Get precision with error handling
            precision_result = self.get_asset_precision()

            # Ensure we have valid precision values
            if isinstance(precision_result, tuple) and len(precision_result) == 2:
                price_precision, quantity_precision = precision_result
            else:
                print("⚠️ Using default precision values")
                price_precision, quantity_precision = 8, 8

            # Validate precision value
            if not isinstance(price_precision, int) or price_precision < 0:
                price_precision = 8

            if not isinstance(quantity_precision, int) or quantity_precision < 0:
                quantity_precision = 8

            # ปรับค่า mid_price, best_bid, best_ask ให้มี Precision
            mid_price = round(mid_price, price_precision)
            best_bid = round(best_bid, price_precision)
            best_ask = round(best_ask, price_precision)

            spread = mid_price * (self.spread_bps / 10000)

            # คำนวณขนาดคำสั่ง
            coin_size = (self.investment * self.leverage * self.order_size_percent) / mid_price


            # ตรวจสอบขนาดคำสั่ง
            if coin_size <= 0:
                print(f"⚠️ Invalid order size calculated: {coin_size}")

                # ใช้ค่าขั้นต่ำที่เหมาะสม
                min_quantity = 10 ** (-quantity_precision)
                coin_size = max(min_quantity, abs(coin_size))

            # ปัดเศษขนาดคำสั่งตาม precision
            coin_size = round(coin_size, quantity_precision)

            # ตรวจสอบอีกครั้งหลังปัดเศษ
            if coin_size <= 0:
                print(f"⚠️ Order size after rounding is still invalid: {coin_size}")
                
                # ใช้ค่าขั้นต่ำที่เหมาะสม
                min_quantity = 10 ** (-quantity_precision)
                coin_size = max(min_quantity, 0.0001)  # ค่าขั้นต่ำที่เหมาะสม

            buy_levels = []
            sell_levels = []

            for i in range(self.orders_per_side):
                price = best_bid - (spread * i * 0.4)
                price = round(price, price_precision)  # ปรับ precision
                buy_levels.append(price)

            for i in range(self.orders_per_side):
                price = best_ask + (spread * i * 0.4)
                price = round(price, price_precision)  # ปรับ precision
                sell_levels.append(price)

            return buy_levels, sell_levels, coin_size  # คืนค่า coin_size กลับไปด้วย

        except Exception as e:
            print(f"⚠️ Error calculating order levels: {e}")
            # Return some default levels if there's an error
            default_price = round((best_bid + best_ask) / 2, 8)
            return [default_price], [default_price], min_quantity

    async def place_order(self, price, is_ask, size):
        """Place single order on Asterdex"""
        try:
            # Get both price and quantity precision with error handling
            precision_result = self.get_asset_precision()
            
            # Ensure we have valid precision values
            if isinstance(precision_result, tuple) and len(precision_result) == 2:
                price_precision, quantity_precision = precision_result
            else:
                print("⚠️ Unexpected precision result, using defaults")
                price_precision, quantity_precision = 8, 8

            # Validate precision values
            if not isinstance(price_precision, int) or price_precision < 0:
                price_precision = 8
            if not isinstance(quantity_precision, int) or quantity_precision < 0:
                quantity_precision = 8

            # Now we can safely use price_precision and quantity_precision
            adjusted_price = round(price, price_precision)
            adjusted_size = round(size, quantity_precision)
            
            path = "/fapi/v1/order"
            url = f"{self.base_url}{path}"
            
            timestamp = int(time.time() * 1000)

            # ✅ Round ตาม precision ที่ถูกต้อง
            rounded_price = round(price, self.price_precision)
            rounded_quantity = round(size, self.quantity_precision)
 
            params = {
                "symbol": self.market_symbol,
                "side": "SELL" if is_ask else "BUY",
                "type": "LIMIT",
                "timeInForce": "GTC" if not self.use_post_only else "PostOnly",
                "quantity": f"{adjusted_size:.{quantity_precision}f}",  # ปรับเป็น string ตาม Precision
                "price": f"{adjusted_price:.{price_precision}f}",      # ปรับเป็น string ตาม Precision
                "timestamp": timestamp,
                "recvWindow": 5000
            }
            
            signature = self._sign(params)
            params["signature"] = signature
            
            headers = {
                "X-MBX-APIKEY": self.api_key,
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            response = requests.post(url, headers=headers, data=params, timeout=7)
            data = response.json()
            
            if response.ok and "orderId" in data:
                order_id = data["orderId"]
                self.active_orders[order_id] = {
                    'price': adjusted_price,
                    'is_ask': is_ask,
                    'size': adjusted_size,
                    'timestamp': time.time()
                }
                self.order_index += 1
                return True
            else:
                print(f"⚠️ Order failed: {data}")
                return False
                
        except Exception as e:
            print(f"⚠️ Error placing order: {e}")
            return False

    async def cancel_all_orders(self):
        """Cancel all active orders on Asterdex"""
        try:
            path = "/fapi/v1/allOpenOrders"
            url = f"{self.base_url}{path}"
            
            timestamp = int(time.time() * 1000)
            params = {
                "symbol": self.market_symbol,
                "timestamp": timestamp,
                "recvWindow": 5000
            }
            
            signature = self._sign(params)
            params["signature"] = signature
            
            headers = {"X-MBX-APIKEY": self.api_key}
            
            response = requests.delete(url, headers=headers, params=params, timeout=7)
            
            if not response.ok:
                print(f"⚠️ Cancel failed: {response.text}")
                        
        except Exception as e:
            print(f"⚠️ Error canceling orders: {e}")

    async def refresh_orders(self):
        """Main order refresh loop"""
        print(f"🔄 Starting order refresh ({self.refresh_interval}s cycles)...")
        
        cycle = 0
        last_status_time = time.time()
        
        while self.running:
            try:
                cycle += 1
                cycle_start = time.time()
                
                orderbook = await self.get_orderbook()
                if not orderbook:
                    print(f"⚠️ Skipping cycle {cycle} - no orderbook data")
                    await asyncio.sleep(self.refresh_interval)
                    continue
                
                await self.cancel_all_orders()
                await asyncio.sleep(self.delay_after_cancel)

                # แก้ไข: รับค่า 3 ค่าจาก calculate_order_levels
                buy_levels, sell_levels, coin_size = await self.calculate_order_levels(orderbook)

                
                # ตรวจสอบขนาดคำสั่งอีกครั้ง
                if coin_size <= 0:
                    print(f"⚠️ Invalid coin_size detected: {coin_size}")

                    # ใช้ค่าขั้นต่ำที่เหมาะสม
                    buy_levels, sell_levels, coin_size = await self.calculate_order_levels(orderbook)
                    #_, _, min_quantity = await self.calculate_order_levels(orderbook)
                    coin_size = min_quantity
                
                placed_buy = 0
                for price in buy_levels[:self.max_orders_to_place]:
                    if await self.place_order(price, False, coin_size):
                        placed_buy += 1
                    await asyncio.sleep(self.delay_between_orders)
                
                placed_sell = 0
                for price in sell_levels[:self.max_orders_to_place]:
                    if await self.place_order(price, True, coin_size):
                        placed_sell += 1
                    await asyncio.sleep(self.delay_between_orders)
                
                estimated_fills = max(0, (self.max_orders_to_place - placed_buy) + (self.max_orders_to_place - placed_sell))
                
                if estimated_fills > 0:
                    fill_volume = estimated_fills * coin_size * orderbook['mid_price']
                    self.total_volume += fill_volume
                    self.current_hour_volume += fill_volume
                    self.total_trades += estimated_fills
                    self.current_hour_trades += estimated_fills
                    
                    trade_fees = fill_volume * (self.trading_fee_percent / 100)
                    self.total_fees += trade_fees
                
                if time.time() - last_status_time >= self.status_interval:
                    await self.print_status(orderbook, placed_buy, placed_sell)
                    last_status_time = time.time()
                
                if (datetime.now() - self.hour_start).total_seconds() >= 3600:
                    self.hourly_stats.append({
                        'volume': self.current_hour_volume,
                        'trades': self.current_hour_trades
                    })
                    print(f"⏰ HOUR {len(self.hourly_stats)} COMPLETE:")
                    print(f"   Volume: ${self.current_hour_volume:,.0f}")
                    print(f"   Trades: {self.current_hour_trades:,}")
                    print(f"   Target: ${self.hourly_target:,.0f}")
                    print(f"   Status: {'✅ ON TRACK' if self.current_hour_volume >= self.hourly_target * 0.8 else '⚠️  BEHIND'}")
                    
                    self.current_hour_volume = 0.0
                    self.current_hour_trades = 0
                    self.hour_start = datetime.now()
                
                if self.total_fees >= self.max_loss:
                    print(f"🛑 MAX LOSS REACHED: ${self.total_fees:.2f}")
                    self.running = False
                    break
                
                cycle_time = time.time() - cycle_start
                sleep_time = max(0, self.refresh_interval - cycle_time)
                await asyncio.sleep(sleep_time)
                
            except Exception as e:
                print(f"⚠️ Cycle error: {e}")
                import traceback
                traceback.print_exc()
                await asyncio.sleep(self.refresh_interval)

    async def print_status(self, orderbook, placed_buy, placed_sell):
        """Print status update"""
        runtime = datetime.now() - self.session_start
        hours_run = runtime.total_seconds() / 3600
        
        volume_rate = self.total_volume / max(hours_run, 0.01)
        trade_rate = self.total_trades / max(hours_run, 0.01)
        
        projected = volume_rate * self.target_hours
        progress_pct = (self.total_volume / self.target_volume) * 100
        
        time_remaining = timedelta(hours=self.target_hours) - runtime
        hours_left = time_remaining.total_seconds() / 3600
        
        volume_left = self.target_volume - self.total_volume
        required_rate = volume_left / max(hours_left, 0.01) if hours_left > 0 else 0
        
        print(f"{'='*75}")
        print(f"⏱️  {str(runtime).split('.')} elapsed | {max(0, hours_left):.1f}h remaining | Price: ${orderbook['mid_price']:,.2f}")
        print(f"📊 Orders: {placed_buy} BUY + {placed_sell} SELL | Market Spread: {orderbook['spread_pct']:.3f}%")
        print(f"💰 VOLUME PROGRESS:")
        print(f"   Current: ${self.total_volume:,.0f} / ${self.target_volume:,.0f} ({progress_pct:.1f}%)")
        print(f"   This Hour: ${self.current_hour_volume:,.0f} / ${self.hourly_target:,.0f}")
        print(f"   Trades: {self.total_trades:,} ({trade_rate:.0f}/hour)")
        print(f"📈 PERFORMANCE:")
        print(f"   Current Rate: ${volume_rate:,.0f}/hour")
        print(f"   {self.target_hours}h Projection: ${projected:,.0f}")
        print(f"   Required Rate: ${required_rate:,.0f}/hour")
        print(f"   Status: {'✅ ON TRACK' if volume_rate >= required_rate * 0.9 else '⚠️  NEED TO SPEED UP'}")
        print(f"💸 COSTS:")
        print(f"   Fees Paid: ${self.total_fees:.2f} / ${self.max_loss:.2f}")
        print(f"   Budget Left: ${self.max_loss - self.total_fees:.2f}")
        print(f"   Fee %: {(self.total_fees/max(self.total_volume, 1))*100:.3f}%")
        print(f"{'='*75}")

    def stop_bot(self, signum=None, frame=None):
        """Stop bot gracefully"""
        print(f"⏹️  STOPPING BOT...")
        self.running = False

    async def run(self):
        """Main execution"""
        signal.signal(signal.SIGINT, self.stop_bot)
        
        try:
            await self.init()
            await self.refresh_orders()
            
        except KeyboardInterrupt:
            self.stop_bot()
        except Exception as e:
            print(f"❌ Fatal Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("🧹 Cleaning up...")
            await self.cancel_all_orders()
            
            runtime = datetime.now() - self.session_start
            hours_run = runtime.total_seconds() / 3600
            
            print(f"{'='*75}")
            print(f"📊 FINAL REPORT")
            print(f"{'='*75}")
            print(f"Runtime: {str(runtime).split('.')} ({hours_run:.2f} hours)")
            print(f"💰 VOLUME:")
            print(f"   Total: ${self.total_volume:,.2f}")
            print(f"   Target: ${self.target_volume:,.0f}")
            print(f"   Achievement: {(self.total_volume/self.target_volume)*100:.1f}%")
            print(f"   Hourly Avg: ${self.total_volume/max(hours_run,0.01):,.0f}/hour")
            print(f"📈 TRADES:")
            print(f"   Total: {self.total_trades:,}")
            print(f"   Avg/Hour: {self.total_trades/max(hours_run,0.01):.0f}")
            print(f"   Avg Size: ${self.total_volume/max(self.total_trades,1):.2f}")
            print(f"💸 COSTS:")
            print(f"   Fees: ${self.total_fees:.2f}")
            print(f"   Budget: ${self.max_loss:.2f}")
            print(f"   Used: {(self.total_fees/self.max_loss)*100:.1f}%")
            print(f"✅ EFFICIENCY:")
            if self.total_fees > 0:
                print(f"   Volume/\$1 Loss: ${self.total_volume/max(self.total_fees,0.01):,.0f}")
                print(f"   Loss %: {(self.total_fees/max(self.total_volume,1))*100:.3f}%")
            else:
                print(f"   🎉 ZERO FEES - Pure volume generation!")
            print(f"{'='*75}")
            
            print("👋 Bot stopped")

if __name__ == "__main__":
    bot = VolumeGeneratorBot()
    asyncio.run(bot.run())
