"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Command({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command"
      className={cn("flex h-full w-full flex-col overflow-hidden rounded-lg bg-popover", className)}
      {...props}
    />
  )
}

type CommandInputProps = Omit<React.ComponentProps<"input">, "onChange"> & {
  onValueChange?: (value: string) => void
}

function CommandInput({
  className,
  onValueChange,
  ...props
}: CommandInputProps) {
  return (
    <input
      data-slot="command-input"
      className={cn(
        "h-9 w-full border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...props}
    />
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-list"
      className={cn("max-h-60 overflow-y-auto overflow-x-hidden p-1", className)}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-group"
      className={cn("overflow-hidden p-1 text-foreground", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-slot="command-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem }
