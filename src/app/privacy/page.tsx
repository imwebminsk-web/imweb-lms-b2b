import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности",
};

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      title="Политика конфиденциальности"
      field="privacy_policy"
    />
  );
}
