import Link from "next/link";

import { Button } from "@/components/ui/button";
import { WithSiteHeader } from "@/components/site/with-site-header";

export default function CoursePublicNotFound() {
  return (
    <WithSiteHeader>
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Курс не найден или ещё не опубликован
        </h1>
        <p className="text-muted-foreground text-sm">
          Возможно, ссылка устарела, или курс снят с публикации. Попробуйте
          вернуться на главную.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild variant="default">
            <Link href="/">На главную</Link>
          </Button>
        </div>
      </main>
    </WithSiteHeader>
  );
}
