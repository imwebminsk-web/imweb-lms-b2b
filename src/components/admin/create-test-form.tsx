"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  getUniqueTestFolders,
  saveFullTest,
  updateFullTest,
} from "@/app/actions/test-actions";
import { UnifiedQuestionEditor } from "@/components/admin/tests/unified-question-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { hasRichTextContent } from "@/lib/utils/rich-text-content";
import { buildTaskContentPayload } from "@/lib/utils/task-content";
import {
  countBlanksInGroupedFillBlanksItem,
  isGapFillPartialScoringQuestionType,
  isGapFillSingleTextQuestionType,
} from "@/lib/grouped-fill-blanks-utils";
import { saveFullTestPayloadSchema } from "@/lib/validations/admin-test-schema";
import type {
  CreateTestFormInitialData,
  QuestionField,
  TestTypeKind,
} from "@/types/create-test-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Editor } from "@/components/ui/editor";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CreateTestValues = z.infer<typeof saveFullTestPayloadSchema>;

export type {
  CreateTestFormInitialData,
  QuestionField,
} from "@/types/create-test-form";

import {
  defaultOptionsForType,
  defaultImageLabelingQuestion,
  defaultGroupedFillBlanksQuestion,
  defaultOrderingQuestion,
  defaultChoiceQuestion,
  emptyQuestion,
  sumChoiceTaskPoints,
  isChoiceQuestion,
  isOrderingQuestion,
  sumOrderingTaskPoints,
  parsePositiveInt,
  parseNonNegativeInt,
  resolveMediaPlayLimitField,
  taskMediaFromQuestion,
  isPuzzleQuestion,
  isImageLabelingQuestion,
  isPartialPairScoringQuestion,
  isItemLevelScoringQuestion,
  resolveAdminQuestionMaxPoints,
  taskUnitPointsLabel,
  sumPartialPairQuestionPoints,
  isGroupedFillBlanksQuestion,
  sumGroupedFillBlanksPoints,
} from "@/lib/admin/test-question-form-utils";

const TEST_TYPE_LABELS: Record<TestTypeKind, string> = {
  training: "Тренировочный",
  final: "Итоговый",
};

const QUESTION_TYPE_LABELS: Record<QuestionKind, string> = {
  single_choice: "Один выбор",
  multiple_choice: "Множественный выбор",
  matching_puzzle: "Сопоставление пар (клик)",
  dnd_puzzle: "Визуальный пазл (стыковка)",
  image_labeling: "Метки на картинке",
  fill_in_the_blanks: "Пропуски из списка (Единый текст)",
  fill_in_the_blanks_multi: "Пропуски из списка (Отдельные предложения)",
  fill_blanks_typing: "Пропуски вручную (Единый текст)",
  fill_blanks_typing_multi: "Пропуски вручную (Отдельные предложения)",
  text_input: "Развернутый ответ",
  ordering: "Упорядочивание",
};

type CreateTestFormProps = {
  initialData?: CreateTestFormInitialData;
  testId?: string;
};

// TODO: Перевести форму на useForm<CreateTestValues> вместо ручного useState.
export function CreateTestForm({
  initialData,
  testId,
}: CreateTestFormProps) {
  const router = useRouter();
  const [folderName, setFolderName] = useState(initialData?.folderName ?? "");
  const [titleTeacher, setTitleTeacher] = useState(
    initialData?.titleTeacher?.trim() ||
      initialData?.title?.trim() ||
      "",
  );
  const [titleStudent, setTitleStudent] = useState(
    initialData?.titleStudent ?? "",
  );
  const [testType, setTestType] = useState<TestTypeKind>(
    initialData?.testType ?? "final",
  );
  const [saveToJournal, setSaveToJournal] = useState(
    initialData?.saveToJournal ?? true,
  );
  const [maxScore, setMaxScore] = useState(
    String(initialData?.maxScore ?? 100),
  );
  const [timeLimit, setTimeLimit] = useState(
    String(initialData?.timeLimit ?? 0),
  );
  const [isPublished, setIsPublished] = useState(
    initialData?.isPublished ?? true,
  );
  const [folderComboboxOpen, setFolderComboboxOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionField[]>(
    initialData?.questions?.length ? initialData.questions : [emptyQuestion()],
  );
  const [mobileExpandedQuestionIndex, setMobileExpandedQuestionIndex] =
    useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function jumpToQuestion(index: number) {
    setMobileExpandedQuestionIndex(index);
    document
      .getElementById(`test-question-${index}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFolders() {
      const result = await getUniqueTestFolders();
      if (cancelled) return;
      if (!result.success) return;
      setAvailableFolders(result.data);
    }

    void loadFolders();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFolders = useMemo(() => {
    const query = searchValue.trim().toLocaleLowerCase("ru");
    if (!query) return availableFolders;
    return availableFolders.filter((folder) =>
      folder.toLocaleLowerCase("ru").includes(query),
    );
  }, [availableFolders, searchValue]);

  const createCandidate = searchValue.trim();
  const canCreateCandidate =
    createCandidate.length > 0 &&
    !availableFolders.some(
      (folder) => folder.toLocaleLowerCase("ru") === createCandidate.toLocaleLowerCase("ru"),
    );

  const resolvedMaxScore = useMemo(
    () => parsePositiveInt(maxScore, 100),
    [maxScore],
  );

  const distributedPoints = useMemo(
    () =>
      questions.reduce(
        (sum, q) => sum + resolveAdminQuestionMaxPoints(q),
        0,
      ),
    [questions],
  );

  const pointsMatch = distributedPoints === resolvedMaxScore;

  useEffect(() => {
    if (!pointsMatch && isPublished) {
      setIsPublished(false);
    }
  }, [pointsMatch, isPublished]);

  function updateQuestion(i: number, patch: Partial<QuestionField>) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === i ? ({ ...q, ...patch } as QuestionField) : q,
      ),
    );
  }

  function changeQuestionType(qi: number, kind: QuestionKind) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi) return q;
        if (q.type === kind) return q;
        const questionPoints = q.points ?? 1;
        const questionExample = q.exampleText ?? "";
        if (kind === "single_choice" || kind === "multiple_choice") {
          if (isChoiceQuestion(q)) {
            return {
              ...q,
              type: kind,
              points: sumChoiceTaskPoints(q),
            };
          }
          return {
            ...defaultChoiceQuestion(kind),
            text: q.text,
            exampleText: questionExample,
          };
        }
        if (kind === "image_labeling") {
          return {
            ...defaultImageLabelingQuestion(),
            text: q.text,
            points: questionPoints,
            exampleText: questionExample,
          };
        }
        if (
          kind === "fill_in_the_blanks" ||
          kind === "fill_in_the_blanks_multi" ||
          kind === "fill_blanks_typing" ||
          kind === "fill_blanks_typing_multi" ||
          kind === "text_input"
        ) {
          if (isGroupedFillBlanksQuestion(q)) {
            const items = isGapFillSingleTextQuestionType(kind)
              ? q.items.slice(0, 1)
              : q.items;
            const next = {
              ...q,
              type: kind,
              text: q.text,
              items,
              exampleText: questionExample,
            };
            return {
              ...next,
              points: sumGroupedFillBlanksPoints(next),
            };
          }
          return {
            ...defaultGroupedFillBlanksQuestion(kind),
            text: q.text,
            points: questionPoints,
            exampleText: questionExample,
          };
        }
        if (kind === "ordering") {
          if (isOrderingQuestion(q)) {
            return {
              ...q,
              points: sumOrderingTaskPoints(q),
            };
          }
          return {
            ...defaultOrderingQuestion(),
            text: q.text,
            exampleText: questionExample,
          };
        }
        if (isImageLabelingQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            points: questionPoints,
            exampleText: questionExample,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        if (isChoiceQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            points: questionPoints,
            exampleText: questionExample,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        if (isGroupedFillBlanksQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            points: questionPoints,
            exampleText: questionExample,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        if (isOrderingQuestion(q)) {
          return {
            text: q.text,
            type: kind,
            points: questionPoints,
            exampleText: questionExample,
            options: defaultOptionsForType(kind),
          } as QuestionField;
        }
        return {
          text: q.text,
          type: kind,
          points: questionPoints,
          exampleText: questionExample,
          options: defaultOptionsForType(kind),
        } as QuestionField;
      }),
    );
  }

  function updateGroupedFillItems(
    qi: number,
    items: Extract<
      QuestionField,
      {
        type:
          | "fill_in_the_blanks"
          | "fill_in_the_blanks_multi"
          | "fill_blanks_typing"
          | "fill_blanks_typing_multi"
          | "text_input";
      }
    >["items"],
  ) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isGroupedFillBlanksQuestion(q)) return q;
        const normalizedItems = isGapFillSingleTextQuestionType(q.type)
          ? items.slice(0, 1)
          : items;
        return {
          ...q,
          items: normalizedItems,
          points: sumGroupedFillBlanksPoints({
            ...q,
            items: normalizedItems,
          }),
        };
      }),
    );
  }

  function updateChoiceItems(
    qi: number,
    items: Extract<
      QuestionField,
      { type: "single_choice" | "multiple_choice" }
    >["items"],
  ) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isChoiceQuestion(q)) return q;
        return {
          ...q,
          items,
          points: items.reduce(
            (sum, item) => sum + parsePositiveInt(String(item.points ?? 1), 1),
            0,
          ),
        };
      }),
    );
  }

  function updateOrderingItems(
    qi: number,
    items: Extract<QuestionField, { type: "ordering" }>["items"],
  ) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isOrderingQuestion(q)) return q;
        return {
          ...q,
          items,
          points: items.reduce(
            (sum, item) => sum + parsePositiveInt(String(item.points ?? 1), 1),
            0,
          ),
        };
      }),
    );
  }

  function updatePuzzleOption(
    qi: number,
    oi: number,
    patch: Partial<PuzzleOptionField>,
  ) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isPuzzleQuestion(q)) {
          return q;
        }
        const options = q.options.map((o, j) =>
          j === oi ? { ...o, ...patch } : o,
        );
        return { ...q, options } as QuestionField;
      }),
    );
  }

  function updateLabelingPair(
    qi: number,
    pi: number,
    patch: Partial<LabelingPairField>,
  ) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isImageLabelingQuestion(q)) return q;
        const labelingPairs = q.labelingPairs.map((row, j) =>
          j === pi ? { ...row, ...patch } : row,
        );
        return { ...q, labelingPairs };
      }),
    );
  }

  function addLabelingPair(qi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isImageLabelingQuestion(q)) return q;
        return {
          ...q,
          labelingPairs: [
            ...q.labelingPairs,
            { url: "", correctWord: "", title: "" },
          ],
        };
      }),
    );
  }

  function removeLabelingPair(qi: number, pi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi || !isImageLabelingQuestion(q)) return q;
        if (q.labelingPairs.length <= 1) return q;
        return {
          ...q,
          labelingPairs: q.labelingPairs.filter((_, j) => j !== pi),
        };
      }),
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(i: number) {
    setQuestions((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i),
    );
  }

  function addOption(qi: number) {
    setQuestions((prev) =>
      prev.map((q, idx): QuestionField => {
        if (idx !== qi) return q;
        if (isPuzzleQuestion(q)) {
          return {
            ...q,
            options: [...q.options, { left: "", right: "" }],
          } as QuestionField;
        }
        if (isImageLabelingQuestion(q) || isGroupedFillBlanksQuestion(q) || isChoiceQuestion(q) || isOrderingQuestion(q)) {
          return q;
        }
        return q;
      }),
    );
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, idx): QuestionField => {
        if (idx !== qi) return q;
        if (
          isImageLabelingQuestion(q) ||
          isGroupedFillBlanksQuestion(q) ||
          isChoiceQuestion(q) ||
          isOrderingQuestion(q) ||
          !isPuzzleQuestion(q)
        ) {
          return q;
        }
        if (q.options.length <= 1) return q;
        return {
          ...q,
          options: q.options.filter((_, j) => j !== oi),
        };
      }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    for (const q of questions) {
      if (!hasRichTextContent(q.text)) {
        setError("Формулировка задания обязательна для всех заданий.");
        setPending(false);
        return;
      }
      if (isGroupedFillBlanksQuestion(q)) {
        if (q.items.length === 0) {
          setError("Добавьте хотя бы один вопрос в задании с пропусками.");
          setPending(false);
          return;
        }
        for (const [itemIndex, item] of q.items.entries()) {
          if (!item.text.trim()) {
            setError(`Заполните текст вопроса ${itemIndex + 1}.`);
            setPending(false);
            return;
          }
          const hasBlank = item.segments.some((seg) => seg.type === "blank");
          if (!hasBlank) {
            setError(
              q.type === "text_input"
                ? `В вопросе ${itemIndex + 1} добавьте хотя бы один пропуск [].`
                : `В вопросе ${itemIndex + 1} добавьте хотя бы один пропуск [слово].`,
            );
            setPending(false);
            return;
          }
        }
      }
      if (isChoiceQuestion(q)) {
        if (q.items.length === 0) {
          setError("Добавьте хотя бы один вопрос в задании с выбором.");
          setPending(false);
          return;
        }
        for (const [itemIndex, item] of q.items.entries()) {
          if (!hasRichTextContent(item.text)) {
            setError(
              `Заполните текст вопроса ${itemIndex + 1} в задании с выбором.`,
            );
            setPending(false);
            return;
          }
          if (!item.options.some((o) => o.isCorrect)) {
            setError(
              `Отметьте верный вариант в вопросе ${itemIndex + 1}.`,
            );
            setPending(false);
            return;
          }
          const emptyOption = item.options.find(
            (o) => !o.text.trim() && !o.imageUrl?.trim(),
          );
          if (emptyOption) {
            setError(
              `У каждого варианта в вопросе ${itemIndex + 1} должен быть текст или изображение.`,
            );
            setPending(false);
            return;
          }
        }
      }
      if (isOrderingQuestion(q)) {
        if (q.items.length === 0) {
          setError("Добавьте хотя бы один вопрос в задании с упорядочиванием.");
          setPending(false);
          return;
        }
        for (const [itemIndex, item] of q.items.entries()) {
          const emptyElement = item.elements.find((el) => !el.text.trim());
          if (emptyElement) {
            setError(
              `Заполните текст всех элементов в вопросе ${itemIndex + 1}.`,
            );
            setPending(false);
            return;
          }
          if (item.elements.length < 2) {
            setError(
              `Добавьте минимум два элемента в вопросе ${itemIndex + 1}.`,
            );
            setPending(false);
            return;
          }
        }
      }
      if (isImageLabelingQuestion(q)) {
        const badPair = q.labelingPairs.find(
          (p) => !p.url.trim() || !p.correctWord.trim(),
        );
        if (badPair) {
          setError(
            "Для «Подпиши картинку» загрузите изображение и укажите правильное слово для каждой пары.",
          );
          setPending(false);
          return;
        }
      }
    }

    const resolvedTitle =
      titleTeacher.trim() || "Без названия";

    const payload = {
      title: resolvedTitle,
      description: null,
      folder_name: folderName.trim() || null,
      is_published: pointsMatch ? isPublished : false,
      title_teacher: titleTeacher.trim() || null,
      title_student: titleStudent.trim() || null,
      test_type: testType,
      auto_check: true,
      save_to_journal: saveToJournal,
      max_score: resolvedMaxScore,
      time_limit: parsePositiveInt(timeLimit, 0),
      questions: questions.map((q) => {
        const points = parsePositiveInt(String(q.points ?? 1), 1);
        const taskMedia = taskMediaFromQuestion(q);
        if (isPuzzleQuestion(q)) {
          return {
            content: buildTaskContentPayload({
              ...taskMedia,
              includeExample: false,
            }),
            type: q.type,
            points,
            media_play_limit: resolveMediaPlayLimitField(q),
            options: q.options.map((o) => ({
              content: {
                left: o.left.trim(),
                right: o.right.trim(),
              },
              is_correct: true as const,
            })),
          };
        }
        if (isImageLabelingQuestion(q)) {
          return {
            content: buildTaskContentPayload({
              ...taskMedia,
              includeExample: false,
            }),
            type: "image_labeling" as const,
            points,
            media_play_limit: resolveMediaPlayLimitField(q),
            options: q.labelingPairs.map((p) => ({
              content: {
                imageUrl: p.url.trim(),
                correctText: p.correctWord.trim(),
                ...(p.title.trim() !== "" ? { title: p.title.trim() } : {}),
              },
              is_correct: true as const,
            })),
          };
        }
        if (isGroupedFillBlanksQuestion(q)) {
          const taskPoints = sumGroupedFillBlanksPoints(q);
          return {
            content: {
              ...buildTaskContentPayload({
                ...taskMedia,
                includeExample: false,
              }),
              items: q.items.map((item) => {
                const payload: Record<string, unknown> = {
                  id: item.id,
                  text: item.text,
                  points: parsePositiveInt(String(item.points ?? 1), 1),
                  segments: item.segments,
                  wordBank: item.wordBank,
                  correctMapping: item.correctMapping,
                };
                if (item.parsedHtml?.trim()) {
                  payload.parsedHtml = item.parsedHtml;
                }
                return payload;
              }),
            },
            type: q.type,
            points: taskPoints,
            media_play_limit: resolveMediaPlayLimitField(q),
            options: [],
          };
        }
        if (isChoiceQuestion(q)) {
          const taskPoints = sumChoiceTaskPoints(q);
          return {
            content: {
              ...buildTaskContentPayload({
                ...taskMedia,
                includeExample: false,
              }),
              items: q.items.map((item) => ({
                id: item.id,
                text: item.text,
                points: parsePositiveInt(String(item.points ?? 1), 1),
                options: item.options.map((o) => ({
                  id: o.id,
                  text: o.text.trim(),
                  is_correct: o.isCorrect,
                  ...(o.imageUrl?.trim()
                    ? { image_url: o.imageUrl.trim() }
                    : {}),
                })),
              })),
            },
            type: q.type,
            points: taskPoints,
            media_play_limit: resolveMediaPlayLimitField(q),
            options: [],
          };
        }
        if (isOrderingQuestion(q)) {
          const taskPoints = sumOrderingTaskPoints(q);
          return {
            content: {
              ...buildTaskContentPayload({
                ...taskMedia,
                includeExample: false,
              }),
              items: q.items.map((item) => ({
                id: item.id,
                text: item.text,
                points: parsePositiveInt(String(item.points ?? 1), 1),
                elements: item.elements.map((el) => ({
                  id: el.id,
                  text: el.text.trim(),
                })),
              })),
            },
            type: "ordering" as const,
            points: taskPoints,
            media_play_limit: resolveMediaPlayLimitField(q),
            options: [],
          };
        }
        throw new Error(`Unsupported question type in submit payload: ${(q as QuestionField).type}`);
      }),
    };

    const result = testId
      ? await updateFullTest(testId, payload)
      : await saveFullTest(payload);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/dashboard/tests");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
      <div className="sticky top-0 z-10 flex shrink-0 justify-center">
        <Badge
          variant="outline"
          className={cn(
            "px-4 py-2 text-sm font-medium shadow-sm",
            pointsMatch
              ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
              : "border-destructive bg-destructive/10 text-destructive",
          )}
        >
          Распределено баллов: {distributedPoints} / {resolvedMaxScore}
        </Badge>
      </div>

      <UnifiedQuestionEditor
        questions={questions}
        onQuestionsChange={setQuestions}
        pending={pending}
      />

      <div className="flex shrink-0 flex-col gap-3">
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-fit min-w-40">
          {pending
            ? testId
              ? "Сохранение…"
              : "Создание…"
            : testId
              ? isPublished
                ? "Сохранить и опубликовать"
                : "Сохранить черновик"
              : isPublished
                ? "Создать и опубликовать"
                : "Сохранить черновик"}
        </Button>
      </div>
    </form>
  );
}
