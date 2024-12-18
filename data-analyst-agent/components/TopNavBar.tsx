"use client";
import Link from 'next/link';
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Moon, Sun, Trash2, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopNavBarProps {
  features?: {
    showDomainSelector?: boolean;
    showViewModeSelector?: boolean;
    showPromptCaching?: boolean;
  };
  onReset?: () => void; 
}

const TopNavBar: React.FC<TopNavBarProps> = ({ features = {}, onReset }) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-4">
      <div className="font-bold text-xl flex gap-2 items-center">
        <Image
          src={theme === "dark" ? "/amazon-dark.png" : "/amazon.webp"}
          alt="Company Wordmark"
          width={50}
          height={30}
        />
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onReset && (
          <Button
            variant="outline"
            size="icon"
            onClick={onReset}
            title="Reset Chat"
          >
            <Trash2 className="h-[1.2rem] w-[1.2rem]" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default TopNavBar;