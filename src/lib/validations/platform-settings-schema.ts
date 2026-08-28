import { z } from "zod";

import type {
  PlatformSettings,
  UpdatePlatformSettingsInput,
} from "@/app/actions/settings-actions";

export function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function splitComma(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function arrayToLines(values: string[] | undefined): string {
  return (values ?? []).join("\n");
}

export function arrayToCommaSeparated(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function isMessengerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.hostname.length > 0;
    }
    return (
      url.protocol === "viber:" ||
      url.protocol === "tg:" ||
      url.protocol === "telegram:" ||
      url.protocol === "whatsapp:"
    );
  } catch {
    return false;
  }
}

function looksLikeWebsite(value: string): boolean {
  if (isHttpUrl(value)) {
    return true;
  }
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([/?#].*)?$/i.test(
    value,
  );
}

const optionalHttpUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || isHttpUrl(value), {
    message: "Укажите полную ссылку, начиная с https://",
  });

const optionalMessengerUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || isMessengerUrl(value), {
    message: "Укажите ссылку (https://t.me/… или viber://…)",
  });

const emailLineSchema = z.string().email("Некорректный адрес электронной почты");

export const platformSettingsFormSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Укажите название организации"),
  logoUrl: z
    .string()
    .trim()
    .refine((value) => value === "" || isHttpUrl(value), {
      message: "Логотип должен быть ссылкой https://",
    }),
  shortDescription: z.string(),
  phones: z.string(),
  emails: z.string().superRefine((value, ctx) => {
    for (const line of splitLines(value)) {
      if (!emailLineSchema.safeParse(line).success) {
        ctx.addIssue({
          code: "custom",
          message: `Некорректный адрес: ${line}`,
        });
      }
    }
  }),
  websites: z.string().superRefine((value, ctx) => {
    for (const item of splitComma(value)) {
      if (!looksLikeWebsite(item)) {
        ctx.addIssue({
          code: "custom",
          message: `Некорректный сайт: ${item}`,
        });
      }
    }
  }),
  addresses: z.string(),
  vk: optionalHttpUrl,
  ok: optionalHttpUrl,
  instagram: optionalHttpUrl,
  youtube: optionalHttpUrl,
  facebook: optionalHttpUrl,
  twitter: optionalHttpUrl,
  telegram: optionalMessengerUrl,
  whatsapp: optionalMessengerUrl,
  viber: optionalMessengerUrl,
  legalInfo: z.string(),
  privacyPolicy: z.string(),
  userAgreement: z.string(),
  publicOffer: z.string(),
});

export type PlatformSettingsFormValues = z.infer<
  typeof platformSettingsFormSchema
>;

export type SettingsFormTab =
  | "branding"
  | "contacts"
  | "socials"
  | "legal";

export const SETTINGS_FORM_TABS: {
  value: SettingsFormTab;
  label: string;
}[] = [
  { value: "branding", label: "Брендинг" },
  { value: "contacts", label: "Контакты" },
  { value: "socials", label: "Соцсети" },
  { value: "legal", label: "Документы и реквизиты" },
];

export function isSettingsFormTab(value: string): value is SettingsFormTab {
  return SETTINGS_FORM_TABS.some((tab) => tab.value === value);
}

const FIELD_TO_TAB: Record<keyof PlatformSettingsFormValues, SettingsFormTab> = {
  organizationName: "branding",
  logoUrl: "branding",
  shortDescription: "branding",
  phones: "contacts",
  emails: "contacts",
  websites: "contacts",
  addresses: "contacts",
  vk: "socials",
  ok: "socials",
  instagram: "socials",
  youtube: "socials",
  facebook: "socials",
  twitter: "socials",
  telegram: "socials",
  whatsapp: "socials",
  viber: "socials",
  legalInfo: "legal",
  privacyPolicy: "legal",
  userAgreement: "legal",
  publicOffer: "legal",
};

export function tabForFieldName(name: string): SettingsFormTab | null {
  if (name in FIELD_TO_TAB) {
    return FIELD_TO_TAB[name as keyof PlatformSettingsFormValues];
  }
  return null;
}

export function settingsToFormValues(
  settings: PlatformSettings,
): PlatformSettingsFormValues {
  const contacts = settings.contacts_json ?? {
    phones: [],
    emails: [],
    addresses: [],
    websites: [],
  };
  const socials = settings.socials_json?.socials ?? {};
  const messengers = settings.socials_json?.messengers ?? {};

  return {
    organizationName: settings.organization_name,
    logoUrl: settings.logo_url ?? "",
    shortDescription: settings.short_description ?? "",
    phones: arrayToLines(contacts.phones),
    emails: arrayToLines(contacts.emails),
    websites: arrayToCommaSeparated(contacts.websites),
    addresses: arrayToLines(contacts.addresses),
    vk: socials.vk ?? "",
    ok: socials.ok ?? "",
    instagram: socials.instagram ?? "",
    youtube: socials.youtube ?? "",
    facebook: socials.facebook ?? "",
    twitter: socials.twitter ?? "",
    telegram: messengers.telegram ?? "",
    whatsapp: messengers.whatsapp ?? "",
    viber: messengers.viber ?? "",
    legalInfo: settings.legal_info ?? "",
    privacyPolicy: settings.privacy_policy ?? "",
    userAgreement: settings.user_agreement ?? "",
    publicOffer: settings.public_offer ?? "",
  };
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function formValuesToPayload(
  values: PlatformSettingsFormValues,
): UpdatePlatformSettingsInput {
  return {
    organization_name: values.organizationName.trim(),
    short_description: values.shortDescription,
    logo_url: emptyToUndefined(values.logoUrl) ?? null,
    legal_info: values.legalInfo,
    privacy_policy: values.privacyPolicy,
    user_agreement: values.userAgreement,
    public_offer: values.publicOffer,
    contacts_json: {
      phones: splitLines(values.phones),
      emails: splitLines(values.emails),
      addresses: splitLines(values.addresses),
      websites: splitComma(values.websites),
    },
    socials_json: {
      socials: {
        vk: emptyToUndefined(values.vk),
        ok: emptyToUndefined(values.ok),
        instagram: emptyToUndefined(values.instagram),
        youtube: emptyToUndefined(values.youtube),
        facebook: emptyToUndefined(values.facebook),
        twitter: emptyToUndefined(values.twitter),
      },
      messengers: {
        telegram: emptyToUndefined(values.telegram),
        whatsapp: emptyToUndefined(values.whatsapp),
        viber: emptyToUndefined(values.viber),
      },
    },
  };
}
