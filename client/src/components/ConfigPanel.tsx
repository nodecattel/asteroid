import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ConfigItem {
  label: string;
  value: string | number;
  category: string;
}

interface ConfigPanelProps {
  config: ConfigItem[];
}

export default function ConfigPanel({ config }: ConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const categories = Array.from(new Set(config.map(item => item.category)));

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover-elevate"
        data-testid="button-toggle-config"
      >
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Bot Configuration
        </h3>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          {categories.map((category) => (
            <div key={category} className="mt-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {category}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {config
                  .filter(item => item.category === category)
                  .map((item, idx) => (
                    <div key={idx} className="space-y-1" data-testid={`config-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      <span className="text-xs text-muted-foreground">
                        {item.label}
                      </span>
                      <div className="font-mono text-sm">
                        {item.value}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
