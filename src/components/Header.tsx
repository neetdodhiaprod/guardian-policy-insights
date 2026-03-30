import { Shield } from "lucide-react";

const Header = () => {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3.5">
        <div className="flex items-center justify-between">
          {/* Logo — icon + two-line masthead */}
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <span className="font-display text-lg text-foreground leading-none block">
                Guardian One
              </span>
              <span className="label-editorial text-muted-foreground leading-none block mt-0.5">
                Policy Analysis
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors hover:border-b hover:border-primary pb-0.5">
              Why Us
            </a>
            <a href="#" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors hover:border-b hover:border-primary pb-0.5">
              Health Insurance 101
            </a>
            <a href="#" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors hover:border-b hover:border-primary pb-0.5">
              Calculator
            </a>
            <a href="#" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors hover:border-b hover:border-primary pb-0.5">
              Claims
            </a>
          </nav>

          {/* CTA Button — sharp radius = authoritative, not bouncy */}
          <button className="bg-primary text-primary-foreground font-body font-semibold px-5 py-2 rounded-xs hover:bg-primary/90 transition-colors">
            Book a Free Call
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
