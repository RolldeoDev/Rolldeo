import { Outlet, Link, useLocation } from 'react-router-dom'
import { Dices, Library, PenSquare, Home, Menu, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { ThemeSwitcher } from '@/components/common'
import rollifyLogo from '@/assets/rollifyLogo.png'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/library', icon: Library, label: 'Library' },
  { path: '/roll', icon: Dices, label: 'Roll' },
  { path: '/editor', icon: PenSquare, label: 'Editor' },
  { path: '/guide', icon: BookOpen, label: 'Guide' },
]

export function Layout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 glass-card border-b border-border/50" role="banner">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group"
          >
            <img
              src={rollifyLogo}
              alt="Rolldeo logo"
              className="h-10 w-10 rounded-xl group-hover:scale-105 transition-transform"
            />
            <span className="font-bold text-xl tracking-tight">Rolldeo</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Theme Switcher & Mobile menu button */}
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <button
              className="md:hidden p-2 rounded-xl hover:bg-accent transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 bg-card/95 backdrop-blur-xl animate-slide-up">
            <nav className="container py-4 space-y-1" aria-label="Mobile navigation">
              {navItems.map((item) => {
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 container py-8" role="main">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 glass-card border-t border-border/50 safe-area-bottom"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium transition-all",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-all",
                  isActive && "bg-primary/10"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "transition-all",
                  isActive ? "opacity-100" : "opacity-70"
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Spacer for mobile nav */}
      <div className="md:hidden h-24" />
    </div>
  )
}
