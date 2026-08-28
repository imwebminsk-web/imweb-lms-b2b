import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Публичная оферта",
  description: "Публичная оферта",
};

export default function OfferPage() {
  return (
    <LegalDocumentPage title="Публичная оферта" field="public_offer" />
  );
}
