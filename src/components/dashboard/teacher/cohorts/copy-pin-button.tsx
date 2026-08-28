"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyPinButton({ pinCode }: { pinCode: string }) {
  const [copied, setCopied] = useState(false);

  async function copyPin() {
    try {
      await navigator.clipboard.writeText(pinCode);
      setCopied(true);
      toast.success("ПИН-код скопирован");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать PIN");
    }
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      aria-label="Скопировать PIN"
      onClick={() => void copyPin()}
    >
      {copied ? (
        <CheckIcon className="size-4" aria-hidden />
      ) : (
        <CopyIcon className="size-4" aria-hidden />
      )}
    </Button>
  );
}
