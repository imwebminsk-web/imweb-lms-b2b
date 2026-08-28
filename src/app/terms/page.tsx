import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Пользовательское соглашение",
  description: "Пользовательское соглашение",
};

export default function TermsPage() {
  return (
    <LegalDocumentPage
      title="Пользовательское соглашение"
      field="user_agreement"
    />
  );
}
