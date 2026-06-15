"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  dict,
  translate,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n/dict";
import type { ProfileRole } from "@/lib/dashboard/sidebar-nav";

const STORAGE_KEY = "growvy-locale";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  isStudent: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

type LanguageProviderProps = {
  children: ReactNode;
  role: ProfileRole;
};

export function LanguageProvider({ children, role }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>("ru");
  const isStudent = role === "student";

  useEffect(() => {
    if (!isStudent) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") {
      setLocaleState(saved);
    }
  }, [isStudent]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (!isStudent) return;
      setLocaleState(next);
      localStorage.setItem(STORAGE_KEY, next);
    },
    [isStudent],
  );

  const t = useCallback(
    (key: TranslationKey) => {
      if (!isStudent) {
        return translate("ru", key);
      }
      return translate(locale, key);
    },
    [isStudent, locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      isStudent,
    }),
    [isStudent, locale, setLocale, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      locale: "ru",
      setLocale: () => {},
      t: (key: TranslationKey) => translate("ru", key),
      isStudent: false,
    };
  }
  return ctx;
}

/** Для отладки и Storybook — экспорт словаря не нужен снаружи. */
export { dict };
