/**
 * Публичная цена курса: строка из БД, число из API или пустое значение → текст для UI.
 */
export function formatCoursePrice(
  price: number | string | null | undefined,
): string {
  if (price === null || price === undefined) return "Бесплатно";

  let n: number;
  if (typeof price === "string") {
    const normalized = price.replace(",", ".").trim();
    n = Number.parseFloat(normalized);
  } else {
    n = price;
  }

  if (!Number.isFinite(n) || n <= 0) {
    return "Бесплатно";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Цена для таблицы дашборда (две дроби, без валюты), с тем же разбором типов.
 */
export function formatCoursePriceDecimal(
  price: number | string | null | undefined,
): string {
  if (price === null || price === undefined) return "0.00";

  let n: number;
  if (typeof price === "string") {
    const normalized = price.replace(",", ".").trim();
    n = Number.parseFloat(normalized);
  } else {
    n = price;
  }

  if (!Number.isFinite(n) || n < 0) {
    return "0.00";
  }

  return n.toFixed(2);
}
