import { Link } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, LogOut, Package } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

export function Avatar({
  name,
  src,
  size = 28,
}: {
  name: string;
  src: string | null;
  size?: number;
}) {
  return src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className="rounded-full object-cover ring-1 ring-border"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase() || "R"}
    </span>
  );
}

/** Log in / Sign up for guests; account menu (orders, admin, log out) for shoppers. */
export function UserMenu() {
  const { user, isAdmin, loading, signOut, openAuth } = useAuth();

  if (loading) {
    return <span aria-hidden="true" className="h-9 w-24 animate-pulse rounded-full bg-nav-ghost" />;
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => openAuth("login")}
          className="nav-ghost cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5 sm:px-4"
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => openAuth("signup")}
          className="bg-cta shadow-cta hidden cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 sm:block"
        >
          Sign up
        </button>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-nav-ghost focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Account menu"
      >
        <Avatar name={user.name} src={user.avatarUrl} />
        <span className="hidden max-w-[120px] truncate sm:inline">{user.name.split(" ")[0]}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
        <DropdownMenuLabel className="px-2.5 py-2">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          {user.email && (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2.5 py-2">
          <Link to="/account">
            <Package className="h-4 w-4" aria-hidden="true" />
            My orders & reviews
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2.5 py-2">
            <Link to="/admin">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Admin dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void signOut()}
          className="cursor-pointer rounded-xl px-2.5 py-2"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
