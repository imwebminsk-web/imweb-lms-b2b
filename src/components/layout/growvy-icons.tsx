import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function GrowvyCoursesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M4 6.5h16M4 12h10M4 17.5h14" />
      <rect x="16" y="9" width="5" height="6" rx="1" />
    </svg>
  );
}

export function GrowvyGroupsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 19c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5M14 19c0-2 1.6-3.5 3.5-3.5.8 0 1.6.2 2.2.6" />
    </svg>
  );
}

export function GrowvyStudentsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  );
}

export function GrowvyTestsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  );
}

export function GrowvyLearningIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M12 4 3 9l9 5 9-5-9-5Z" />
      <path d="M3 14l9 5 9-5M3 9v10l9 5 9-5V9" />
    </svg>
  );
}

export function GrowvyCatalogIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export function GrowvySupportIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.5M12 17h.01" />
    </svg>
  );
}

export function GrowvySettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function GrowvyLogoutIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 12H4M18 8l4 4-4 4" />
    </svg>
  );
}

export function GrowvyMenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function GrowvyDictionariesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke} {...props}>
      <path d="M6 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
