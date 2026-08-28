import Link from "next/link";
import {
  Facebook,
  Globe,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";

import type {
  PlatformContacts,
  PlatformSocials,
} from "@/app/actions/settings-actions";

function VkIcon({ className = "h-5 w-5 scale-125" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.78 17h.66s.2-.02.3-.12c.09-.1.09-.3.09-.3s-.01-.9.4-1.03c.41-.13.94.87 1.5 1.25.42.3.74.23.74.23l1.5-.02s.78-.05.41-.66c-.03-.05-.22-.46-1.13-1.3-.96-.9-.83-.75.33-2.3.71-.95 1-1.52.91-1.77-.08-.24-.57-.18-.57-.18l-1.69.01s-.13-.02-.23.04c-.1.05-.16.18-.16.18s-.27.72-.63 1.34c-.76 1.31-1.06 1.38-1.19 1.29-.31-.2-.23-.8-.23-1.23 0-1.34.2-1.9-.4-2.05-.2-.05-.34-.08-.85-.08-.65-.01-1.2 0-1.5.15-.2.1-.36.32-.26.33.13.02.42.08.57.28.19.25.18.81.18.81s.1 1.57-.24 1.76c-.23.12-.55-.13-1.23-1.31-.35-.6-.61-1.26-.61-1.26s-.05-.12-.14-.19a.64.64 0 0 0-.27-.1l-1.61.01s-.24 0-.33.1c-.08.08-.01.26-.01.26s1.26 2.95 2.69 4.44C9.55 17.16 10.5 17 10.5 17h1.29z" />
    </svg>
  );
}

function OkIcon({ className = "h-5 w-5 scale-125" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 1.8a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Zm-2.1 8.7a.9.9 0 0 0-.64 1.54L11.73 16l-2.47 2.46a.9.9 0 1 0 1.27 1.27L13 17.27l2.47 2.46a.9.9 0 1 0 1.27-1.27L14.27 16l2.47-2.46a.9.9 0 0 0-1.27-1.27L13 14.73l-2.47-2.46a.9.9 0 0 0-.63-.27Z" />
    </svg>
  );
}

function WhatsAppIcon({ className = "h-5 w-5 scale-110" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.11 4.93A9.81 9.81 0 0 0 12.03 2C6.57 2 2.12 6.45 2.12 11.91c0 1.75.46 3.46 1.33 4.97L2 22l5.27-1.38a9.82 9.82 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.86 9.86 0 0 0-2.84-6.99ZM12.04 20.2h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.13.82.84-3.05-.2-.31a8.2 8.2 0 0 1-1.25-4.36c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.4 5.83c0 4.54-3.69 8.23-8.24 8.23Zm4.51-6.15c-.25-.12-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.24-.74-.65-1.24-1.46-1.39-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.77-1.84-.2-.47-.41-.41-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.15.16 1.59.1.49-.07 1.47-.6 1.67-1.17.21-.57.21-1.06.14-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function ViberIcon({ className = "h-5 w-5 scale-110" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c4.96 0 9 3.42 9 7.63 0 2.43-1.37 4.6-3.5 5.99V20a1 1 0 0 1-1.58.82l-2.61-1.9c-.43.06-.87.08-1.31.08-4.96 0-9-3.42-9-7.63S7.04 2 12 2Zm-3.7 4.5c-.2 0-.4.08-.54.23-.56.58-.86 1.31-.86 2.08 0 1.89 1.23 3.68 2.47 4.75 1.25 1.08 2.72 1.91 4.53 1.91.79 0 1.54-.26 2.11-.77.14-.13.23-.32.23-.52 0-.29-.17-.55-.44-.66l-1.63-.67a.7.7 0 0 0-.84.25l-.42.56a.53.53 0 0 1-.56.2c-1.13-.34-2.29-1.45-2.75-2.55a.53.53 0 0 1 .14-.59l.5-.47a.7.7 0 0 0 .18-.75l-.66-1.68a.7.7 0 0 0-.66-.45Zm3.13-.26c-.24-.04-.46.12-.5.36-.04.24.12.46.36.5 1.84.3 3.3 1.76 3.6 3.6.04.22.23.37.43.37h.07a.43.43 0 0 0 .36-.5 5.34 5.34 0 0 0-4.32-4.33Zm.32 1.72a.43.43 0 1 0-.14.85c1.03.17 1.85.99 2.02 2.02.03.21.22.37.43.37h.07a.43.43 0 0 0 .36-.5 3.84 3.84 0 0 0-3.1-3.1Z" />
    </svg>
  );
}

function TelegramIcon({ className = "h-5 w-5 scale-110" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 3.5c-.2-.16-.47-.21-.72-.13L2.7 10.3c-.35.13-.58.46-.57.84.02.38.28.69.64.79l4.8 1.49 1.87 5.75c.1.32.39.55.73.59h.09c.31 0 .6-.16.76-.43l2.66-4.27 4.42 3.25c.14.1.31.16.48.16.11 0 .22-.02.32-.06.28-.11.48-.36.54-.65l3.02-13.42c.07-.31-.04-.63-.28-.84Zm-2.58 2.26-2.45 10.91-3.93-2.89a.84.84 0 0 0-1.24.27l-2.05 3.3-1.34-4.12 7.67-6.68a.84.84 0 0 0-1.11-1.26l-8.74 7.61-2.6-.81 15.79-6.33Z" />
    </svg>
  );
}

function websiteHref(website: string): string {
  if (website.startsWith("http://") || website.startsWith("https://")) {
    return website;
  }
  return `https://${website}`;
}

const LINK_CLASS =
  "flex items-center gap-2 text-[#001352] transition-colors hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white";

export function LandingFooter({
  organizationName,
  shortDescription,
  contacts,
  socials,
  legalInfo,
  logoUrl,
}: {
  organizationName: string;
  shortDescription?: string | null;
  contacts: PlatformContacts;
  socials?: PlatformSocials | null;
  legalInfo: string;
  logoUrl?: string | null;
}) {
  const phones = contacts.phones ?? [];
  const emails = contacts.emails ?? [];
  const addresses = contacts.addresses ?? [];
  const websites = contacts.websites ?? [];
  const network = socials?.socials ?? {};
  const messengers = socials?.messengers ?? {};

  const website = websites[0] ?? "";
  const displayName = organizationName.trim() || "Образовательная платформа";

  const socialLinks = [
    { key: "ok", href: network.ok, label: "Одноклассники", icon: <OkIcon /> },
    { key: "vk", href: network.vk, label: "ВКонтакте", icon: <VkIcon /> },
    {
      key: "facebook",
      href: network.facebook,
      label: "Facebook",
      icon: <Facebook className="h-5 w-5" />,
    },
    {
      key: "twitter",
      href: network.twitter,
      label: "X (Twitter)",
      icon: <Twitter className="h-5 w-5" />,
    },
    {
      key: "instagram",
      href: network.instagram,
      label: "Instagram",
      icon: <Instagram className="h-5 w-5" />,
    },
    {
      key: "youtube",
      href: network.youtube,
      label: "YouTube",
      icon: <Youtube className="h-5 w-5" />,
    },
    {
      key: "telegram",
      href: messengers.telegram,
      label: "Telegram",
      icon: <TelegramIcon />,
    },
    {
      key: "whatsapp",
      href: messengers.whatsapp,
      label: "WhatsApp",
      icon: <WhatsAppIcon />,
    },
    {
      key: "viber",
      href: messengers.viber,
      label: "Viber",
      icon: <ViberIcon />,
    },
  ].filter((item) => Boolean(item.href));

  const hasContacts =
    phones.length > 0 ||
    emails.length > 0 ||
    addresses.length > 0 ||
    websites.length > 0;

  return (
    <footer className="border-t bg-slate-100 py-12 text-sm text-[#001352] dark:bg-slate-900 dark:text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mb-3 max-h-12 w-auto object-contain"
            />
          ) : null}
          <p className="font-bold text-[#001352] dark:text-white">{displayName}</p>
          {shortDescription?.trim() ? (
            <p className="mt-2 whitespace-pre-line text-[#001352] dark:text-slate-300">
              {shortDescription.trim()}
            </p>
          ) : null}
          {website ? (
            <a
              href={websiteHref(website)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 font-medium text-[#001352] hover:underline dark:text-slate-300 dark:hover:text-white"
            >
              <Globe className="size-4" aria-hidden />
              {website}
            </a>
          ) : null}
        </div>
        <div>
          <p className="font-semibold text-[#001352] dark:text-white">Разделы</p>
          <ul className="mt-3 space-y-2 text-[#001352] dark:text-slate-300">
            <li>
              <Link
                href="#course-catalog"
                className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
              >
                Курсы
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-[#001352] dark:text-white">Контакты</p>
          {hasContacts ? (
            <ul className="mt-3 space-y-3 text-[#001352] dark:text-slate-300">
              {addresses.map((address) => (
                <li key={address} className="flex items-start gap-2">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-[#001352] dark:text-slate-300"
                    aria-hidden
                  />
                  <span>{address}</span>
                </li>
              ))}
              {phones.map((phone) => (
                <li key={phone} className="flex items-center gap-2">
                  <Phone
                    className="size-4 shrink-0 text-[#001352] dark:text-slate-300"
                    aria-hidden
                  />
                  <a
                    href={`tel:${phone}`}
                    className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
                  >
                    {phone}
                  </a>
                </li>
              ))}
              {emails.map((email) => (
                <li key={email} className="flex items-center gap-2">
                  <Mail
                    className="size-4 shrink-0 text-[#001352] dark:text-slate-300"
                    aria-hidden
                  />
                  <a
                    href={`mailto:${email}`}
                    className="text-[#001352] hover:text-[#001352]/80 dark:text-slate-300 dark:hover:text-white"
                  >
                    {email}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[#001352] dark:text-slate-300">
              Контакты появятся после настройки платформы.
            </p>
          )}
        </div>
        <div>
          <p className="font-semibold text-[#001352] dark:text-white">Мы в сети</p>
          {socialLinks.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.key}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className={LINK_CLASS}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[#001352] dark:text-slate-300">
              Ссылки на соцсети появятся после настройки.
            </p>
          )}
        </div>
      </div>
          {legalInfo ? (
            <p className="mt-10 whitespace-pre-line text-center text-[#001352] dark:text-slate-400">
              {legalInfo}
            </p>
          ) : null}
          <nav
            aria-label="Юридические документы"
            className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-xs text-[#001352] dark:text-slate-400"
          >
            <Link
              href="/privacy"
              className="hover:text-[#001352]/80 hover:underline dark:hover:text-white"
            >
              Политика конфиденциальности
            </Link>
            <Link
              href="/terms"
              className="hover:text-[#001352]/80 hover:underline dark:hover:text-white"
            >
              Пользовательское соглашение
            </Link>
            <Link
              href="/offer"
              className="hover:text-[#001352]/80 hover:underline dark:hover:text-white"
            >
              Публичная оферта
            </Link>
          </nav>
    </footer>
  );
}
