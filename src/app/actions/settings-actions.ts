"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminOrHead } from "@/lib/utils/user-utils";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export type PlatformContacts = {
  phones: string[];
  emails: string[];
  addresses: string[];
  websites?: string[];
};

export type SocialNetworks = {
  vk?: string;
  ok?: string;
  instagram?: string;
  youtube?: string;
  facebook?: string;
  twitter?: string;
};

export type Messengers = {
  telegram?: string;
  whatsapp?: string;
  viber?: string;
};

export type PlatformSocials = {
  socials: SocialNetworks;
  messengers: Messengers;
};

export type PlatformSettings = {
  id: string;
  organization_name: string;
  short_description: string | null;
  logo_url: string | null;
  contacts_json: PlatformContacts | null;
  socials_json: PlatformSocials | null;
  legal_info: string | null;
};

export type UpdatePlatformSettingsInput = Omit<PlatformSettings, "id">;

/** Pass-through for Markdown text: keeps formatting, drops empty values. */
function preserveFormattedText(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : null;
}

/** Pass-through for Markdown lines (e.g. addresses): one item per line, keeps inline formatting. */
function preserveFormattedLines(values: string[]): string[] {
  return values
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeContacts(raw: unknown): PlatformContacts {
  if (!raw || typeof raw !== "object") {
    return { phones: [], emails: [], addresses: [], websites: [] };
  }

  const record = raw as Record<string, unknown>;

  if (
    Array.isArray(record.phones) ||
    Array.isArray(record.emails) ||
    Array.isArray(record.addresses)
  ) {
    return {
      phones: asStringArray(record.phones),
      emails: asStringArray(record.emails),
      addresses: preserveFormattedLines(asStringArray(record.addresses)),
      websites: asStringArray(record.websites),
    };
  }

  const legacyPhones =
    typeof record.phone === "string" && record.phone.trim()
      ? [record.phone.trim()]
      : [];
  const legacyEmails =
    typeof record.email === "string" && record.email.trim()
      ? [record.email.trim()]
      : [];
  const legacyAddresses =
    typeof record.address === "string" && record.address.trim()
      ? preserveFormattedLines([record.address])
      : [];

  return {
    phones: legacyPhones,
    emails: legacyEmails,
    addresses: legacyAddresses,
    websites: [],
  };
}

function pickString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSocialNetworks(raw: unknown): SocialNetworks {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const socials: SocialNetworks = {};

  for (const key of [
    "vk",
    "ok",
    "instagram",
    "youtube",
    "facebook",
    "twitter",
  ] as const) {
    const value = pickString(record, key);
    if (value) {
      socials[key] = value;
    }
  }

  return socials;
}

function normalizeMessengers(raw: unknown): Messengers {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const messengers: Messengers = {};

  for (const key of ["telegram", "whatsapp", "viber"] as const) {
    const value = pickString(record, key);
    if (value) {
      messengers[key] = value;
    }
  }

  return messengers;
}

function normalizeSocials(raw: unknown): PlatformSocials {
  if (!raw || typeof raw !== "object") {
    return { socials: {}, messengers: {} };
  }

  const record = raw as Record<string, unknown>;

  if (record.socials || record.messengers) {
    return {
      socials: normalizeSocialNetworks(record.socials),
      messengers: normalizeMessengers(record.messengers),
    };
  }

  return {
    socials: normalizeSocialNetworks(record),
    messengers: normalizeMessengers(record),
  };
}

function normalizeSettingsRow(row: Record<string, unknown>): PlatformSettings {
  const organizationName =
    typeof row.organization_name === "string"
      ? row.organization_name
      : typeof row.platform_name === "string"
        ? row.platform_name
        : "";

  return {
    id: String(row.id),
    organization_name: organizationName,
    short_description: preserveFormattedText(
      typeof row.short_description === "string" ? row.short_description : null,
    ),
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    contacts_json: normalizeContacts(row.contacts_json),
    socials_json: normalizeSocials(row.socials_json),
    legal_info: preserveFormattedText(
      typeof row.legal_info === "string" ? row.legal_info : null,
    ),
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("*")
    .single();

  if (error) {
    console.error("Error fetching platform settings:", error);
    return null;
  }

  return normalizeSettingsRow(data as Record<string, unknown>);
}

export async function updatePlatformSettings(
  data: UpdatePlatformSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const hasAccess = isAdminOrHead(profile?.role);
  if (!hasAccess) {
    return { ok: false, error: "Forbidden" };
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const contacts = data.contacts_json ?? {
    phones: [],
    emails: [],
    addresses: [],
    websites: [],
  };

  const { error } = await adminClient
    .from("platform_settings")
    .update({
      organization_name: data.organization_name.trim(),
      short_description: preserveFormattedText(data.short_description),
      logo_url: data.logo_url,
      contacts_json: {
        phones: linesToPlainArray(contacts.phones),
        emails: linesToPlainArray(contacts.emails),
        addresses: preserveFormattedLines(contacts.addresses),
        websites: linesToPlainArray(contacts.websites ?? []),
      },
      socials_json: data.socials_json,
      legal_info: preserveFormattedText(data.legal_info),
    })
    .eq("is_singleton", true);

  if (error) {
    console.error("Error updating platform settings:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

function linesToPlainArray(values: string[]): string[] {
  return values
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
