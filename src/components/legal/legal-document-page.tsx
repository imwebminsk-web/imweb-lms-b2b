import {
  getPlatformSettings,
  type PlatformSettings,
} from "@/app/actions/settings-actions";
import { LandingFooter } from "@/components/landing/landing-footer";
import { SiteHeader } from "@/components/site/header";
import { parseBasicMarkdown } from "@/lib/parse-basic-markdown";

type LegalField = keyof Pick<
  PlatformSettings,
  "privacy_policy" | "user_agreement" | "public_offer"
>;

type LegalDocumentPageProps = {
  title: string;
  field: LegalField;
};

export async function LegalDocumentPage({ title, field }: LegalDocumentPageProps) {
  const settings = await getPlatformSettings();
  const contacts = settings?.contacts_json ?? {
    phones: [],
    emails: [],
    addresses: [],
    websites: [],
  };
  const trimmed = settings?.[field]?.trim() ?? "";

  return (
    <div className="bg-background flex h-[100dvh] w-full flex-col overflow-y-auto">
      <SiteHeader />

      <main
        className="prose prose-slate dark:prose-invert mx-auto max-w-4xl flex-1 px-4 py-12 text-base
        [&_p]:text-slate-700 [&_p]:dark:text-slate-300
        [&_li]:text-slate-700 [&_li]:dark:text-slate-300"
      >
        <h1>{title}</h1>
        {trimmed ? (
          <div
            dangerouslySetInnerHTML={{ __html: parseBasicMarkdown(trimmed) }}
          />
        ) : (
          <p>Документ в стадии разработки</p>
        )}
      </main>

      <LandingFooter
        organizationName={settings?.organization_name ?? ""}
        shortDescription={settings?.short_description}
        contacts={contacts}
        socials={settings?.socials_json}
        legalInfo={settings?.legal_info ?? ""}
        logoUrl={settings?.logo_url}
      />
    </div>
  );
}
