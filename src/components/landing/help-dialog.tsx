"use client";

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type HelpDialogProps = {
  children: ReactNode;
  className?: string;
};

export function HelpDialog({ children, className }: HelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger className={className}>{children}</DialogTrigger>
      <DialogContent className="gap-0 p-0 md:max-w-[900px]">
        <DialogTitle className="sr-only">Оставьте заявку</DialogTitle>
        <div className="p-8 text-center text-muted-foreground">Форма временно недоступна</div>
      </DialogContent>
    </Dialog>
  );
}
