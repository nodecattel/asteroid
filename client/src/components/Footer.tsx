import { ExternalLink, Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} <span className="font-semibold text-foreground">NodeCattel</span>. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <a
              href="https://www.asterdex.com/en/referral/2326b3"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover-elevate active-elevate-2 transition-colors px-3 py-1.5 rounded-md"
              data-testid="link-referral"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Trade on Asterdex</span>
            </a>
            <a
              href="https://github.com/nodecattel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover-elevate active-elevate-2 transition-colors px-3 py-1.5 rounded-md"
              data-testid="link-github"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
