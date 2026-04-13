import { SiteHeader } from "@/components/site/header";

/** Маркетинговый хедер (NewEdu / Войти). Не использовать на лендинге с LandingHeader. */
export function WithSiteHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
