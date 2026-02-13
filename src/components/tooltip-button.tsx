import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import React from "react";

type ButtonVariant =
  | "ghost"
  | "link"
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | null
  | undefined;

interface TooltipButtonProps {
  content: string;
  icon: React.ReactNode;
  onClick?: () => void;
  buttonVariant?: ButtonVariant;
  buttonClassName?: string;
  delay?: number;
  disabled?: boolean;   // ✅ fixed spelling
  loading?: boolean;
}

export const TooltipButton = ({
  content,
  icon,
  onClick,
  buttonVariant = "ghost",
  buttonClassName = "",
  delay = 0,
  disabled = false,
  loading = false,
}: TooltipButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <TooltipProvider delayDuration={delay}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }
          >
            <Button
              size="icon"
              variant={buttonVariant}
              className={buttonClassName}
              disabled={isDisabled}
              onClick={isDisabled ? undefined : onClick}
            >
              {loading ? (
                <Loader className="min-w-4 min-h-4 animate-spin text-emerald-400" />
              ) : (
                icon
              )}
            </Button>
          </span>
        </TooltipTrigger>

        <TooltipContent>
          <p>{loading ? "Loading..." : content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
