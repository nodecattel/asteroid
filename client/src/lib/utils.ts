import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats crypto prices with appropriate precision based on price magnitude
 * @param price - The price to format
 * @param precision - Optional precision override from exchange
 * @returns Formatted price string
 */
export function formatCryptoPrice(price: number, precision?: number): string {
  // If precision is provided by exchange, use it intelligently
  if (precision !== undefined && precision !== null) {
    // For very small prices, use the full precision
    if (price < 1) {
      return price.toFixed(precision);
    }
    // For prices >= 1, show at least 2 decimals but up to the precision
    const decimals = Math.max(2, Math.min(precision, 4));
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals
    });
  }
  
  // Fallback: Smart auto-detection based on price magnitude
  if (price < 0.01) {
    return price.toFixed(6);
  } else if (price < 1) {
    return price.toFixed(4);
  } else if (price < 100) {
    return price.toFixed(4);
  } else if (price < 10000) {
    return price.toFixed(2);
  } else {
    return price.toFixed(2);
  }
}
