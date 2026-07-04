"use client";

import type { ReactNode } from "react";

import { ContactFormBlock } from "@/components/landing/contact-form-block";
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
        <ContactFormBlock />
      </DialogContent>
    </Dialog>
  );
}
