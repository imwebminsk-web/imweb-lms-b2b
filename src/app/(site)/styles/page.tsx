import type { Metadata } from "next";
import Link from "next/link";

import { PUZZLE_BASE_CSS } from "@/lib/puzzle-mask-css";
import { WithSiteHeader } from "@/components/site/with-site-header";

export const metadata: Metadata = {
  title: "Эталон: пазл (CSS mask)",
  description: "Три состояния: левая, правая, стык 50/50",
};

/** Общие отступы текста внутри маски — не зависят от drag/active. */
const pieceInner =
  "flex min-h-[100px] w-full min-w-0 items-center justify-center py-3 px-10 text-center text-sm font-medium text-foreground";

export default function StylesPage() {
  return (
    <WithSiteHeader>
      <main className="bg-muted/40 text-foreground min-h-screen">
      <style>{PUZZLE_BASE_CSS}</style>
      <div className="styles-puzzle-reference mx-auto max-w-3xl space-y-14 px-6 py-10 md:px-10">
        <style>{`
          .styles-puzzle-reference * {
            outline: none !important;
            box-shadow: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          .puzzle-resolved-block .puzzle-piece-concrete {
            width: calc(50% - 50px);
            min-width: calc(50% - 50px);
            max-width: calc(50% - 50px);
            flex-shrink: 0;
            box-sizing: border-box;
          }
        `}</style>

        <header className="space-y-3 border-b border-border pb-6">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Эталон геометрии пазла
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Маска: <code className="text-foreground">--r: 20px</code>,{" "}
            <code className="text-foreground">--shift: 10px</code> → для касания плоских
            стенок правая деталь смещается на{" "}
            <code className="text-foreground">30px</code> (
            <code className="text-foreground">-ml-[30px]</code> в секции 3).
          </p>
          <Link
            href="/"
            className="text-primary w-fit text-sm underline-offset-4 hover:underline"
          >
            ← На главную
          </Link>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">1. Левая деталь</h2>
          <div className="puzzle-filter w-full max-w-md min-w-0">
            <div className={`puzzle-left-mask bg-card pr-14 ${pieceInner}`}>
              Левая половина
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">2. Правая деталь</h2>
          <div className="puzzle-filter w-full max-w-md min-w-0">
            <div className={`puzzle-right-mask bg-card pl-14 ${pieceInner}`}>
              Правая половина
            </div>
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="mb-4 text-xl font-bold">
            3. Соединённая пара (стык в одном элементе)
          </h2>
          <p className="text-muted-foreground text-sm">
            Единый родитель <code className="text-foreground">.puzzle-resolved-block</code>{" "}
            (flex, по центру) — монолитный блок для внешнего контекста. Внутри: ширина{" "}
            <code className="text-foreground">calc(50% - 50px)</code>, справа{" "}
            <code className="text-foreground">-ml-[30px]</code> (
            <code className="text-foreground">--r + --shift</code>).
          </p>
          <div className="puzzle-resolved-block puzzle-ui-scope relative mx-auto flex w-full max-w-3xl justify-center overflow-x-clip">
            <div className="puzzle-piece-concrete puzzle-filter z-10 w-[calc(50%-50px)] shrink-0 min-h-[100px]">
              <div className="puzzle-left-mask flex h-full min-h-[100px] w-full items-center justify-center bg-card p-8 pr-14 text-center text-sm font-medium">
                Текст левого пазла
              </div>
            </div>
            <div className="puzzle-piece-concrete puzzle-filter z-[1] -ml-[30px] w-[calc(50%-50px)] shrink-0 min-h-[100px]">
              <div className="puzzle-right-mask flex h-full min-h-[100px] w-full items-center justify-center bg-card p-8 pl-14 text-center text-sm font-medium">
                Текст правого пазла
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
    </WithSiteHeader>
  );
}
