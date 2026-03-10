"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  const iconStyle = "fill-gray-600 stroke-gray-900 hover:stroke-black hover:fill-gray-900 dark:fill-gray-300 stroke-gray-400 hover:stroke-gray-600 dark:hover:fill-gray-400";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="w-9 h-9 px-0"
    >
      <Sun className={`h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 ${iconStyle}`} />
      <Moon className={`absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 ${iconStyle}`} />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
