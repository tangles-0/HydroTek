"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogOut, Plus } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export const Header = () => {
  const { data: session, status } = useSession();

  const linkStyle =
    "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-400";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground"
        >
          HydroTek
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/dashboard" className={`${linkStyle} text-sm font-medium`}>
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <ThemeToggle />
          {status === "loading" ? (
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
          ) : session ? (
            <>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="sm:hidden"
                  aria-label="Add device"
                  onClick={() => window.dispatchEvent(new Event("hydrotek:add-device-open"))}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => window.dispatchEvent(new Event("hydrotek:add-device-open"))}
                >
                  <Plus className="w-4 h-4" />
                  Add device
                </Button>
                <Avatar className="w-8 h-8">
                  <AvatarImage src={session.user?.image || ""} />
                  <AvatarFallback>
                    {session.user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:block">
                  {session.user?.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <Link href="/login" className={linkStyle}>Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
};
