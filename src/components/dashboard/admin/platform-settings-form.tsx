"use client";

import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ChevronDown, CircleHelp } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formValuesToPayload,
  isSettingsFormTab,
  platformSettingsFormSchema,
  SETTINGS_FORM_TABS,
  settingsToFormValues,
  tabForFieldName,
  type PlatformSettingsFormValues,
  type SettingsFormTab,
} from "@/lib/validations/platform-settings-schema";

type PlatformSettingsFormProps = {
  initialSettings: PlatformSettings;
};

const MARKDOWN_HINT =
  "Можно выделить текст: **жирный**, _курсив_, <u>подчёркнутый</u>.";

const SHORT_TEXTAREA_CLASS = "field-sizing-fixed min-h-20 resize-none";
const LEGAL_TEXTAREA_CLASS = "field-sizing-fixed h-48 min-h-[200px] resize-none";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p className="text-destructive text-sm" role="alert">
      {message}
    </p>
  );
}

function MarkdownHintLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded-sm"
            aria-label="Подсказка по оформлению текста"
          >
            <CircleHelp className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>{MARKDOWN_HINT}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function PlatformSettingsForm({
  initialSettings,
}: PlatformSettingsFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsFormTab>("branding");

  function handleTabChange(value: string) {
    if (isSettingsFormTab(value)) {
      setActiveTab(value);
    }
  }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlatformSettingsFormValues>({
    resolver: standardSchemaResolver(platformSettingsFormSchema),
    defaultValues: settingsToFormValues(initialSettings),
  });

  async function onValid(values: PlatformSettingsFormValues) {
    const result = await updatePlatformSettings(formValuesToPayload(values));
    if (!result.ok) {
      toast.error(result.error || "Не удалось сохранить настройки");
      return;
    }
    toast.success("Настройки сохранены");
    router.refresh();
  }

  return (
    <TooltipProvider>
      <form
        onSubmit={handleSubmit(onValid, (formErrors) => {
          const firstField = Object.keys(formErrors)[0];
          const nextTab = firstField ? tabForFieldName(firstField) : null;
          if (nextTab) {
            setActiveTab(nextTab);
          }
          toast.error("Проверьте поля формы — есть ошибки");
        })}
      >
        <Card>
          <CardHeader>
            <CardTitle>Основные настройки</CardTitle>
            <CardDescription>
              Настройки внешнего вида и брендинга платформы
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <div className="mb-6 flex md:hidden">
                <Label htmlFor="settings-tab-select" className="sr-only">
                  Раздел настроек
                </Label>
                <Select value={activeTab} onValueChange={handleTabChange}>
                  <SelectTrigger
                    id="settings-tab-select"
                    className="w-full [&>svg:last-child]:hidden"
                  >
                    <SelectValue placeholder="Выберите раздел" />
                    <ChevronDown
                      className="h-4 w-4 shrink-0 opacity-50"
                      aria-hidden
                    />
                  </SelectTrigger>
                  <SelectContent className="[&_[data-slot=select-scroll-up-button]]:hidden [&_[data-slot=select-scroll-down-button]]:hidden">
                    {SETTINGS_FORM_TABS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TabsList
                variant="line"
                className="mb-6 hidden h-auto w-full min-w-0 flex-wrap justify-start overflow-hidden group-data-horizontal/tabs:h-auto md:inline-flex"
              >
                {SETTINGS_FORM_TABS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="branding" className="mt-0 space-y-4">
                <Controller
                  name="logoUrl"
                  control={control}
                  render={({ field }) => (
                    <PlatformImageUploadField
                      id="logoUpload"
                      label="Логотип"
                      description="Загрузите логотип организации. Он появится на странице входа."
                      value={field.value}
                      onChange={field.onChange}
                      assetKind="logo"
                    />
                  )}
                />
                <FieldError message={errors.logoUrl?.message} />

                <div className="space-y-2">
                  <Label htmlFor="organizationName">Название организации</Label>
                  <Input
                    id="organizationName"
                    {...register("organizationName")}
                    placeholder="Учебный центр"
                    disabled={isSubmitting}
                  />
                  <FieldError message={errors.organizationName?.message} />
                </div>

                <div className="space-y-2">
                  <MarkdownHintLabel htmlFor="shortDescription">
                    Краткое описание
                  </MarkdownHintLabel>
                  <Textarea
                    id="shortDescription"
                    {...register("shortDescription")}
                    className={SHORT_TEXTAREA_CLASS}
                    placeholder="Коротко расскажите, чем занимается организация"
                    disabled={isSubmitting}
                  />
                  <FieldError message={errors.shortDescription?.message} />
                </div>
              </TabsContent>

              <TabsContent value="contacts" className="mt-0 space-y-4">
                <p className="text-muted-foreground text-sm">
                  Телефоны, почту и адреса указывайте по одному на строку.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="phones">Телефоны</Label>
                  <Textarea
                    id="phones"
                    {...register("phones")}
                    className={SHORT_TEXTAREA_CLASS}
                    placeholder="+375 29 000-00-00"
                    disabled={isSubmitting}
                  />
                  <FieldError message={errors.phones?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emails">Электронная почта</Label>
                  <Textarea
                    id="emails"
                    {...register("emails")}
                    className={SHORT_TEXTAREA_CLASS}
                    placeholder="info@example.com"
                    disabled={isSubmitting}
                  />
                  <FieldError message={errors.emails?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="websites">Сайты</Label>
                  <Input
                    id="websites"
                    {...register("websites")}
                    placeholder="imweb.by, example.by"
                    disabled={isSubmitting}
                  />
                  <p className="text-muted-foreground text-sm">
                    Несколько сайтов можно указать через запятую.
                  </p>
                  <FieldError message={errors.websites?.message} />
                </div>
                <div className="space-y-2">
                  <MarkdownHintLabel htmlFor="addresses">
                    Адреса
                  </MarkdownHintLabel>
                  <Textarea
                    id="addresses"
                    {...register("addresses")}
                    className={SHORT_TEXTAREA_CLASS}
                    placeholder="Минск, ул. Примерная, 1"
                    disabled={isSubmitting}
                  />
                  <FieldError message={errors.addresses?.message} />
                </div>
              </TabsContent>

              <TabsContent value="socials" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Социальные сети</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vk">ВКонтакте</Label>
                      <Input
                        id="vk"
                        {...register("vk")}
                        placeholder="https://vk.com/your_page"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.vk?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ok">Одноклассники</Label>
                      <Input
                        id="ok"
                        {...register("ok")}
                        placeholder="https://ok.ru/your_page"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.ok?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input
                        id="instagram"
                        {...register("instagram")}
                        placeholder="https://instagram.com/your_page"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.instagram?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="youtube">YouTube</Label>
                      <Input
                        id="youtube"
                        {...register("youtube")}
                        placeholder="https://youtube.com/@your_channel"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.youtube?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facebook">Facebook</Label>
                      <Input
                        id="facebook"
                        {...register("facebook")}
                        placeholder="https://facebook.com/your_page"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.facebook?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitter">X (Twitter)</Label>
                      <Input
                        id="twitter"
                        {...register("twitter")}
                        placeholder="https://x.com/your_page"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.twitter?.message} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Мессенджеры</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="telegram">Telegram</Label>
                      <Input
                        id="telegram"
                        {...register("telegram")}
                        placeholder="https://t.me/your_channel"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.telegram?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input
                        id="whatsapp"
                        {...register("whatsapp")}
                        placeholder="https://wa.me/375290000000"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.whatsapp?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="viber">Viber</Label>
                      <Input
                        id="viber"
                        {...register("viber")}
                        placeholder="viber://chat?number=375290000000"
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors.viber?.message} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="legal" className="mt-0 space-y-6">
                <div className="space-y-2">
                  <MarkdownHintLabel htmlFor="legalInfo">
                    Реквизиты, УНП
                  </MarkdownHintLabel>
                  <Textarea
                    id="legalInfo"
                    {...register("legalInfo")}
                    className={LEGAL_TEXTAREA_CLASS}
                    placeholder="ООО «Пример», УНП 123456789"
                    disabled={isSubmitting}
                  />
                  <p className="text-muted-foreground text-sm">
                    Эти данные показываются в подвале публичных страниц.
                  </p>
                  <FieldError message={errors.legalInfo?.message} />
                </div>

                <p className="text-muted-foreground text-sm">
                  Тексты ниже публикуются на отдельных страницах сайта. Можно
                  использовать Markdown: **жирный**, _курсив_,{" "}
                  {"<u>подчёркнутый</u>"}.
                </p>
                <div className="space-y-2">
                  <MarkdownHintLabel htmlFor="privacyPolicy">
                    Политика конфиденциальности
                  </MarkdownHintLabel>
                  <Textarea
                    id="privacyPolicy"
                    {...register("privacyPolicy")}
                    className={LEGAL_TEXTAREA_CLASS}
                    placeholder="Текст политики конфиденциальности…"
                    disabled={isSubmitting}
                  />
                  <p className="text-muted-foreground text-sm">
                    Публикуется в подвале сайта как «Политика конфиденциальности».
                    Пустое поле покажет посетителю: «Документ в стадии
                    разработки».
                  </p>
                  <FieldError message={errors.privacyPolicy?.message} />
                </div>
                <div className="space-y-2">
                  <MarkdownHintLabel htmlFor="userAgreement">
                    Пользовательское соглашение
                  </MarkdownHintLabel>
                  <Textarea
                    id="userAgreement"
                    {...register("userAgreement")}
                    className={LEGAL_TEXTAREA_CLASS}
                    placeholder="Текст пользовательского соглашения…"
                    disabled={isSubmitting}
                  />
                  <p className="text-muted-foreground text-sm">
                    Публикуется в подвале сайта как «Пользовательское
                    соглашение». Пустое поле покажет посетителю: «Документ в
                    стадии разработки».
                  </p>
                  <FieldError message={errors.userAgreement?.message} />
                </div>
                <div className="space-y-2">
                  <MarkdownHintLabel htmlFor="publicOffer">
                    Публичная оферта
                  </MarkdownHintLabel>
                  <Textarea
                    id="publicOffer"
                    {...register("publicOffer")}
                    className={LEGAL_TEXTAREA_CLASS}
                    placeholder="Текст публичной оферты…"
                    disabled={isSubmitting}
                  />
                  <p className="text-muted-foreground text-sm">
                    Публикуется в подвале сайта как «Публичная оферта». Пустое
                    поле покажет посетителю: «Документ в стадии разработки».
                  </p>
                  <FieldError message={errors.publicOffer?.message} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="w-full justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Сохранение…" : "Сохранить"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </TooltipProvider>
  );
}
