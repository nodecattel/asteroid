// AI Provider Icons using lobehub icon library
// These icons are loaded from the lobehub CDN for proper brand representation

interface AIProviderIconProps {
  provider: string;
  size?: number;
  className?: string;
}

// Brand colors for each AI provider
export const AI_PROVIDER_COLORS: Record<string, string> = {
  'Anthropic': '#D97757', // Claude brand color
  'OpenAI': '#10A37F', // OpenAI green
  'DeepSeek': '#0066FF', // DeepSeek blue
  'xAI': '#000000', // xAI/Grok black
  'Alibaba': '#FF6A00', // Alibaba orange
};

// Provider to icon name mapping (lobehub icon names)
const PROVIDER_ICON_MAP: Record<string, string> = {
  'Anthropic': 'anthropic',
  'OpenAI': 'openai',
  'DeepSeek': 'deepseek',
  'xAI': 'x',
  'Alibaba': 'alibaba',
};

export function AIProviderIcon({ provider, size = 24, className = '' }: AIProviderIconProps) {
  const iconName = PROVIDER_ICON_MAP[provider];
  
  if (!iconName) {
    // Fallback to emoji for unknown providers
    return <span className={className} style={{ fontSize: `${size}px` }}>🤖</span>;
  }

  // Use the WebP version with dark mode support from lobehub CDN
  return (
    <picture className={className}>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet={`https://unpkg.com/@lobehub/icons-static-webp@latest/dark/${iconName}.webp`}
      />
      <img
        src={`https://unpkg.com/@lobehub/icons-static-webp@latest/light/${iconName}.webp`}
        alt={`${provider} logo`}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain' }}
        loading="lazy"
      />
    </picture>
  );
}

// Avatar variant with circular background
export function AIProviderAvatar({ provider, size = 32, className = '' }: AIProviderIconProps) {
  const brandColor = AI_PROVIDER_COLORS[provider] || '#888888';
  
  return (
    <div
      className={`flex items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${brandColor}15`,
        padding: size * 0.15,
      }}
    >
      <AIProviderIcon provider={provider} size={size * 0.7} />
    </div>
  );
}
