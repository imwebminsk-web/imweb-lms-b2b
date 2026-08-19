"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  updatePlatformSettings,
  type PlatformSettings,
} from "@/app/actions/settings-actions";
import { PlatformImageUploadField } from "@/components/dashboard/admin/platform-image-upload-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PlatformSettingsFormProps = {
  initialSettings: PlatformSettings;
};

const MARKDOWN_HINT =
  "Поддерживается Markdown: **жирный**, _курсив_, <u>подчеркнутый</u>.";

function arrayToLines(values: string[] | undefined): string {
  return (values ?? []).join("\n");
}

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function commaSeparatedToArray(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToCommaSeparated(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

export function PlatformSettingsForm({
  initialSettings,
}: PlatformSettingsFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [organizationName, setOrganizationName] = useState(
    initialSettings.organization_name,
  );
  const [logoUrl, setLogoUrl] = useState(initialSettings.logo_url || "");
  const [shortDescription, setShortDescription] = useState(
    initialSettings.short_description || "",
  );
  const [legalInfo, setLegalInfo] = useState(initialSettings.legal_info || "");

  const contacts = initialSettings.contacts_json ?? {
    phones: [],
    emails: [],
    addresses: [],
    websites: [],
  };
  const [phones, setPhones] = useState(arrayToLines(contacts.phones));
  const [emails, setEmails] = useState(arrayToLines(contacts.emails));
  const [addresses, setAddresses] = useState(arrayToLines(contacts.addresses));
  const [websites, setWebsites] = useState(
    arrayToCommaSeparated(contacts.websites),
  );

  const socialsData = initialSettings.socials_json ?? {
    socials: {},
    messengers: {},
  };
  const socials = socialsData.socials ?? {};
  const messengers = socialsData.messengers ?? {};

  const [vk, setVk] = useState(socials.vk || "");
  const [ok, setOk] = useState(socials.ok || "");
  const [instagram, setInstagram] = useState(socials.instagram || "");
  const [youtube, setYoutube] = useState(socials.youtube || "");
  const [facebook, setFacebook] = useState(socials.facebook || "");
  const [twitter, setTwitter] = useState(socials.twitter || "");

  const [telegram, setTelegram] = useState(messengers.telegram || "");
  const [whatsapp, setWhatsapp] = useState(messengers.whatsapp || "");
  const [viber, setViber] = useState(messengers.viber || "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsPending(true);

    const result = await updatePlatformSettings({
      organization_name: organizationName,
      short_description: shortDescription,
      logo_url: logoUrl || null,
      legal_info: legalInfo || null,
      contacts_json: {
        phones: linesToArray(phones),
        emails: linesToArray(emails),
        addresses: linesToArray(addresses),
        websites: commaSeparatedToArray(websites),
      },
      socials_json: {
        socials: {
          vk: vk || undefined,
          ok: ok || undefined,
          instagram: instagram || undefined,
          youtube: youtube || undefined,
          facebook: facebook || undefined,
          twitter: twitter || undefined,
        },
        messengers: {
          telegram: telegram || undefined,
          whatsapp: whatsapp || undefined,
          viber: viber || undefined,
        },
      },
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error || "Ошибка сохранения");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Основные настройки</CardTitle>
          <CardDescription>
            White-label параметры организации: брендинг, контакты и юридическая
            информация.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Брендинг</h3>
            <PlatformImageUploadField
              id="logoUpload"
              label="Логотип"
              description={`Загрузка в bucket «platform-assets». Публичный URL сохраняется в logo_url.`}
              value={logoUrl}
              onChange={setLogoUrl}
              assetKind="logo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationName">Название организации / школы</Label>
            <Input
              id="organizationName"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shortDescription">Краткое описание</Label>
            <Textarea
              id="shortDescription"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={3}
            />
            <p className="text-muted-foreground text-sm">{MARKDOWN_HINT}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legalInfo">Реквизиты, УНП</Label>
            <Textarea
              id="legalInfo"
              value={legalInfo}
              onChange={(e) => setLegalInfo(e.target.value)}
              rows={4}
              placeholder="ООО «Пример», УНП 123456789"
            />
            <p className="text-muted-foreground text-sm">{MARKDOWN_HINT}</p>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-lg font-medium">Контакты</h3>
            <p className="text-muted-foreground text-sm">
              Указывайте по одному значению на строку.
            </p>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="phones">Телефоны</Label>
                <Textarea
                  id="phones"
                  value={phones}
                  onChange={(e) => setPhones(e.target.value)}
                  rows={3}
                  placeholder="+375 29 000-00-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emails">Email</Label>
                <Textarea
                  id="emails"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  rows={3}
                  placeholder="info@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websites">Сайты</Label>
                <Input
                  id="websites"
                  value={websites}
                  onChange={(e) => setWebsites(e.target.value)}
                  placeholder="imweb.by, belskills.by"
                />
                <p className="text-muted-foreground text-sm">
                  Указывайте через запятую.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addresses">Адреса</Label>
                <Textarea
                  id="addresses"
                  value={addresses}
                  onChange={(e) => setAddresses(e.target.value)}
                  rows={3}
                  placeholder="Минск, ул. Примерная, 1"
                />
                <p className="text-muted-foreground text-sm">{MARKDOWN_HINT}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-lg font-medium">Социальные сети</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vk">VK</Label>
                <Input
                  id="vk"
                  value={vk}
                  onChange={(e) => setVk(e.target.value)}
                  placeholder="https://vk.com/your_page"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ok">Одноклассники</Label>
                <Input
                  id="ok"
                  value={ok}
                  onChange={(e) => setOk(e.target.value)}
                  placeholder="https://ok.ru/your_page"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/your_page"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube">YouTube</Label>
                <Input
                  id="youtube"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  placeholder="https://youtube.com/@your_channel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="https://facebook.com/your_page"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter">X / Twitter</Label>
                <Input
                  id="twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://x.com/your_page"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-lg font-medium">Мессенджеры</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telegram">Telegram</Label>
                <Input
                  id="telegram"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="https://t.me/your_channel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="https://wa.me/375290000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="viber">Viber</Label>
                <Input
                  id="viber"
                  value={viber}
                  onChange={(e) => setViber(e.target.value)}
                  placeholder="viber://chat?number=375290000000"
                />
              </div>
            </div>
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}
          {success ? (
            <p className="text-sm font-medium text-green-600 dark:text-green-500">
              Настройки успешно сохранены
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
