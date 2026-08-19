import { redirect } from "next/navigation";

import { checkIsInitialized } from "@/app/actions/setup-actions";

import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const initialized = await checkIsInitialized();

  if (initialized) {
    redirect("/login");
  }

  return <SetupForm />;
}
