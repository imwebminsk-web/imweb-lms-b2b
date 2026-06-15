"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Editor } from "@/components/ui/editor";
import type {
  OrderingElementField,
  OrderingSubItemField,
} from "@/types/create-test-form";

export type OrderingItemsEditorProps = {
  items: OrderingSubItemField[];
  onItemsChange: (items: OrderingSubItemField[]) => void;
};

function defaultOrderingElement(): OrderingElementField {
  return {
    id: crypto.randomUUID(),
    text: "",
  };
}

export function createDefaultOrderingSubItem(): OrderingSubItemField {
  return {
    id: crypto.randomUUID(),
    text: "",
    points: 1,
    elements: [defaultOrderingElement(), defaultOrderingElement()],
  };
}

export function OrderingItemsEditor({
  items,
  onItemsChange,
}: OrderingItemsEditorProps) {
  const baseId = useId();

  function updateItem(itemIndex: number, patch: Partial<OrderingSubItemField>) {
    onItemsChange(
      items.map((item, idx) =>
        idx === itemIndex ? { ...item, ...patch } : item,
      ),
    );
  }

  function updateElement(
    itemIndex: number,
    elementIndex: number,
    patch: Partial<OrderingElementField>,
  ) {
    onItemsChange(
      items.map((item, idx) => {
        if (idx !== itemIndex) return item;
        return {
          ...item,
          elements: item.elements.map((el, ei) =>
            ei === elementIndex ? { ...el, ...patch } : el,
          ),
        };
      }),
    );
  }

  function addItem() {
    onItemsChange([...items, createDefaultOrderingSubItem()]);
  }

  function removeItem(itemIndex: number) {
    if (items.length <= 1) return;
    onItemsChange(items.filter((_, idx) => idx !== itemIndex));
  }

  function addElement(itemIndex: number) {
    onItemsChange(
      items.map((item, idx) =>
        idx === itemIndex
          ? { ...item, elements: [...item.elements, defaultOrderingElement()] }
          : item,
      ),
    );
  }

  function removeElement(itemIndex: number, elementIndex: number) {
    onItemsChange(
      items.map((item, idx) => {
        if (idx !== itemIndex || item.elements.length <= 2) return item;
        return {
          ...item,
          elements: item.elements.filter((_, ei) => ei !== elementIndex),
        };
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Вопросы задания</span>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          + Добавить вопрос
        </Button>
      </div>

      {items.map((item, itemIndex) => (
        <div
          key={item.id}
          className="space-y-3 rounded-lg border border-dashed p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Вопрос {itemIndex + 1}</p>
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor={`${baseId}-points-${itemIndex}`}
                className="text-muted-foreground text-xs whitespace-nowrap"
              >
                Баллы:
              </Label>
              <Input
                id={`${baseId}-points-${itemIndex}`}
                type="number"
                min={1}
                step={1}
                className="h-8 w-16"
                value={item.points}
                onChange={(e) =>
                  updateItem(itemIndex, {
                    points: Math.max(
                      1,
                      Number.parseInt(e.target.value, 10) || 1,
                    ),
                  })
                }
              />
            </div>
            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(itemIndex)}
                disabled={items.length <= 1}
              >
                Удалить
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${baseId}-text-${itemIndex}`}>
              Описание вопроса (необязательно)
            </Label>
            <Editor
              id={`${baseId}-text-${itemIndex}`}
              value={item.text}
              onChange={(next) => updateItem(itemIndex, { text: next })}
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <span className="text-sm font-medium">Элементы последовательности</span>
              <p className="text-muted-foreground text-xs">
                Добавьте элементы в ПРАВИЛЬНОМ порядке. Для ученика они будут
                перемешаны автоматически.
              </p>
            </div>
            {item.elements.map((element, elementIndex) => (
              <div
                key={element.id}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-muted-foreground w-6 shrink-0 text-xs font-medium">
                  {elementIndex + 1}.
                </span>
                <Input
                  className="min-w-0 flex-1"
                  value={element.text}
                  onChange={(e) =>
                    updateElement(itemIndex, elementIndex, {
                      text: e.target.value,
                    })
                  }
                  placeholder={`Элемент ${elementIndex + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeElement(itemIndex, elementIndex)}
                  disabled={item.elements.length <= 2}
                >
                  Удалить
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => addElement(itemIndex)}
            >
              + Добавить элемент
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
