export type AppMode = "school" | "corporate" | "all";

const rawMode = process.env.NEXT_PUBLIC_APP_MODE?.trim().toLowerCase();

function resolveAppMode(): AppMode {
  if (rawMode === "school" || rawMode === "corporate" || rawMode === "all") {
    return rawMode;
  }

  throw new Error(
    "CRITICAL: NEXT_PUBLIC_APP_MODE must be 'school', 'corporate', or 'all'.",
  );
}

export const APP_MODE: AppMode = resolveAppMode();

export const isSchoolMode = APP_MODE === "school" || APP_MODE === "all";
export const isCorporateMode = APP_MODE === "corporate" || APP_MODE === "all";
