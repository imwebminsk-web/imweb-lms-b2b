"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  getUniqueTestFolders,
  saveFullTest,
  updateFullTest,
} from "@/app/actions/test-actions";
import {
  ChoiceTaskItemsEditor,
  createDefaultChoiceSubItem,
} from "@/components/admin/questions/ChoiceTaskItemsEditor";
import {
  OrderingItemsEditor,
  createDefaultOrderingSubItem,
} from "@/components/admin/questions/OrderingItemsEditor";
import {
  GroupedFillBlanksItemsEditor,
  createDefaultGroupedFillBlanksItem,
  type GroupedFillBlanksQuestionType,
} from "@/components/admin/questions/GroupedFillBlanksItemsEditor";
import { ImageLabelingImageUploadField } from "@/components/admin/questions/ImageLabelingImageUploadField";
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
  LabelingPairField,
  ChoiceOptionField,
  PuzzleOptionField,
  QuestionField,
  QuestionKind,
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

function defaultOptionsForType(
  kind: Exclude<
    QuestionKind,
    | "image_labeling"
    | "fill_in_the_blanks"
    | "fill_in_the_blanks_multi"
    | "fill_blanks_typing"
    | "fill_blanks_typing_multi"
    | "text_input"
    | "ordering"
    | "single_choice"
    | "multiple_choice"
  >,
): Extract<
  QuestionField,
  { type: "matching_puzzle" | "dnd_puzzle" }
>["options"] {
  return [
    { left: "", right: "" },
    { left: "", right: "" },
  ];
}

function defaultImageLabelingQuestion(): Extract<
  QuestionField,
  { type: "image_labeling" }
> {
  return {
    text: "",
    type: "image_labeling",
    points: 1,
    exampleText: "",
    mediaPlayLimit: 0,
    labelingPairs: [{ url: "", correctWord: "", title: "" }],
  };
}

function defaultGroupedFillBlanksQuestion(
  type: GroupedFillBlanksQuestionType,
): Extract<
  QuestionField,
  {
    type:
      | "fill_in_the_blanks"
      | "fill_in_the_blanks_multi"
      | "fill_blanks_typing"
      | "fill_blanks_typing_multi"
      | "text_input";
  }
> {
  const item = createDefaultGroupedFillBlanksItem(type);
  return {
    text: "",
    type,
    points: item.points,
    exampleText: "",
    mediaPlayLimit: 0,
    items: [item],
  };
}

function defaultOrderingQuestion(): Extract<
  QuestionField,
  { type: "ordering" }
> {
  const item = createDefaultOrderingSubItem();
  return {
    text: "",
    type: "ordering",
    points: item.points,
    exampleText: "",
    mediaPlayLimit: 0,
    items: [item],
  };
}

function defaultChoiceQuestion(
  type: "single_choice" | "multiple_choice",
): Extract<QuestionField, { type: "single_choice" | "multiple_choice" }> {
  const item = createDefaultChoiceSubItem();
  return {
    text: "",
    type,
    points: item.points,
    exampleText: "",
    mediaPlayLimit: 0,
    items: [item],
  };
}

function emptyQuestion(): QuestionField {
  return defaultChoiceQuestion("single_choice");
}

function sumChoiceTaskPoints(
  q: Extract<QuestionField, { type: "single_choice" | "multiple_choice" }>,
): number {
  return q.items.reduce(
    (sum, item) => sum + parsePositiveInt(String(item.points ?? 1), 1),
    0,
  );
}

function isChoiceQuestion(
  q: QuestionField,
): q is Extract<QuestionField, { type: "single_choice" | "multiple_choice" }> {
  return q.type === "single_choice" || q.type === "multiple_choice";
}

function isOrderingQuestion(
  q: QuestionField,
): q is Extract<QuestionField, { type: "ordering" }> {
  return q.type === "ordering";
}

function sumOrderingTaskPoints(
  q: Extract<QuestionField, { type: "ordering" }>,
): number {
  return q.items.reduce(
    (sum, item) => sum + parsePositiveInt(String(item.points ?? 1), 1),
    0,
  );
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function resolveMediaPlayLimitField(q: QuestionField): number {
  return parseNonNegativeInt(String(q.mediaPlayLimit ?? 0), 0);
}

function taskMediaFromQuestion(q: QuestionField) {
  return {
    text: q.text,
    exampleText: q.exampleText ?? "",
  };
}

function isPuzzleQuestion(
  q: QuestionField,
): q is Extract<
  QuestionField,
  { type: "matching_puzzle" | "dnd_puzzle" }
> {
  return q.type === "matching_puzzle" || q.type === "dnd_puzzle";
}

function isImageLabelingQuestion(
  q: QuestionField,
): q is Extract<QuestionField, { type: "image_labeling" }> {
  return q.type === "image_labeling";
}

function isPartialPairScoringQuestion(q: QuestionField): boolean {
  return isPuzzleQuestion(q) || isImageLabelingQuestion(q);
}

/** Типы с баллами на уровне вложенных items (корневой input не показываем). */
function isItemLevelScoringQuestion(q: QuestionField): boolean {
  return (
    isChoiceQuestion(q) ||
    isOrderingQuestion(q) ||
    isGroupedFillBlanksQuestion(q)
  );
}

/** Сумма баллов задания в форме админки (аналог resolveQuestionMaxPoints для QuestionField). */
function resolveAdminQuestionMaxPoints(q: QuestionField): number {
  if (isChoiceQuestion(q)) {
    return sumChoiceTaskPoints(q);
  }
  if (isOrderingQuestion(q)) {
    return sumOrderingTaskPoints(q);
  }
  if (isGroupedFillBlanksQuestion(q)) {
    return sumGroupedFillBlanksPoints(q);
  }
  if (isPartialPairScoringQuestion(q)) {
    return sumPartialPairQuestionPoints(q);
  }
  return parsePositiveInt(String(q.points ?? 1), 1);
}

function taskUnitPointsLabel(q: QuestionField): string {
  if (isPuzzleQuestion(q)) {
    return "Баллы за каждую пару";
  }
  if (isImageLabelingQuestion(q)) {
    return "Баллы за каждую метку";
  }
  return "Баллы за вопрос";
}

function sumPartialPairQuestionPoints(q: QuestionField): number {
  const unitPoints = parsePositiveInt(String(q.points ?? 1), 1);
  if (isPuzzleQuestion(q)) {
    return unitPoints * Math.max(q.options.length, 1);
  }
  if (isImageLabelingQuestion(q)) {
    return unitPoints * Math.max(q.labelingPairs.length, 1);
  }
  return unitPoints;
}

function isGroupedFillBlanksQuestion(
  q: QuestionField,
): q is Extract<
  QuestionField,
  {
    type:
      | "fill_in_the_blanks"
      | "fill_in_the_blanks_multi"
      | "fill_blanks_typing"
      | "fill_blanks_typing_multi"
      | "text_input";
  }
> {
  return (
    q.type === "fill_in_the_blanks" ||
    q.type === "fill_in_the_blanks_multi" ||
    q.type === "fill_blanks_typing" ||
    q.type === "fill_blanks_typing_multi" ||
    q.type === "text_input"
  );
}

function sumGroupedFillBlanksPoints(
  q: Extract<
    QuestionField,
    {
      type:
        | "fill_in_the_blanks"
        | "fill_in_the_blanks_multi"
        | "fill_blanks_typing"
        | "fill_blanks_typing_multi"
        | "text_input";
    }
  >,
): number {
  return q.items.reduce((sum, item) => {
    const unitPoints = parsePositiveInt(String(item.points ?? 1), 1);
    if (isGapFillPartialScoringQuestionType(q.type)) {
      return (
        sum + unitPoints * countBlanksInGroupedFillBlanksItem(item)
      );
    }
    return sum + unitPoints;
  }, 0);
}

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
  const [isForKids, setIsForKids] = useState(initialData?.isForKids ?? false);
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
      is_for_kids: isForKids,
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

      <details className="rounded-lg border bg-muted/30 p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium">
          Список заданий ({questions.length})
        </summary>
        <ul className="mt-3 flex flex-col gap-1">
          {questions.map((q, qi) => (
            <li key={qi}>
              <button
                type="button"
                className={cn(
                  "hover:bg-muted w-full rounded-md px-2 py-2.5 text-left text-sm transition-colors",
                  mobileExpandedQuestionIndex === qi && "bg-muted font-medium",
                )}
                onClick={() => jumpToQuestion(qi)}
              >
                Задание {qi + 1} — {QUESTION_TYPE_LABELS[q.type]}
              </button>
            </li>
          ))}
        </ul>
      </details>

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>
            {testId ? "Редактирование теста" : "Новый тест"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-folder">Папка</Label>
            <Popover
              open={folderComboboxOpen}
              onOpenChange={(nextOpen) => {
                setFolderComboboxOpen(nextOpen);
                if (nextOpen) {
                  setSearchValue(folderName);
                } else {
                  setSearchValue("");
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  id="test-folder"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={folderComboboxOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className={cn("truncate", !folderName.trim() && "text-muted-foreground")}>
                    {folderName.trim() || "Без папки"}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput
                    value={searchValue}
                    onValueChange={setSearchValue}
                    placeholder="Найти или создать папку..."
                  />
                  <CommandList>
                    {filteredFolders.length === 0 && !canCreateCandidate ? (
                      <CommandEmpty>Папки не найдены.</CommandEmpty>
                    ) : null}
                    <CommandGroup>
                      {filteredFolders.map((folder) => (
                        <CommandItem
                          key={folder}
                          onClick={() => {
                            setFolderName(folder);
                            setFolderComboboxOpen(false);
                            setSearchValue("");
                          }}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              folderName === folder ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{folder}</span>
                        </CommandItem>
                      ))}
                      {canCreateCandidate ? (
                        <CommandItem
                          onClick={() => {
                            setFolderName(createCandidate);
                            setAvailableFolders((prev) =>
                              prev.some(
                                (folder) =>
                                  folder.toLocaleLowerCase("ru") ===
                                  createCandidate.toLocaleLowerCase("ru"),
                              )
                                ? prev
                                : [...prev, createCandidate].sort((a, b) =>
                                    a.localeCompare(b, "ru"),
                                  ),
                            );
                            setFolderComboboxOpen(false);
                            setSearchValue("");
                          }}
                        >
                          <Check className="size-4 opacity-0" />
                          <span className="truncate">Создать "{createCandidate}"</span>
                        </CommandItem>
                      ) : null}
                      <CommandItem
                        onClick={() => {
                          setFolderName("");
                          setFolderComboboxOpen(false);
                          setSearchValue("");
                        }}
                      >
                        <Check className={cn("size-4", folderName.trim() ? "opacity-0" : "opacity-100")} />
                        <span>Без папки</span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-muted-foreground text-xs">
              Выберите существующую папку или создайте новую.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-title-teacher">Название для учителя</Label>
            <Input
              id="test-title-teacher"
              value={titleTeacher}
              onChange={(e) => setTitleTeacher(e.target.value)}
              placeholder="Как вы видите этот тест в списке"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-title-student">Название для ученика</Label>
            <Input
              id="test-title-student"
              value={titleStudent}
              onChange={(e) => setTitleStudent(e.target.value)}
              placeholder={
                titleTeacher.trim() || "Если пусто — используется название для учителя"
              }
            />
            <p className="text-muted-foreground text-xs">
              Если поле пустое, ученик увидит название для учителя.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-type">Тип теста</Label>
            <Select
              value={testType}
              onValueChange={(value) => setTestType(value as TestTypeKind)}
            >
              <SelectTrigger id="test-type" className="w-full max-w-md">
                <SelectValue>{TEST_TYPE_LABELS[testType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">
                  {TEST_TYPE_LABELS.training}
                </SelectItem>
                <SelectItem value="final">{TEST_TYPE_LABELS.final}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Тренировочный тест можно пересдавать; итоговый — как контрольная
              работа.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-max-score">Максимальный балл</Label>
            <Input
              id="test-max-score"
              type="number"
              min={1}
              step={1}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-time-limit">
              Ограничение по времени (в минутах)
            </Label>
            <Input
              id="test-time-limit"
              type="number"
              min={0}
              max={600}
              step={1}
              inputMode="numeric"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              placeholder="0 — без ограничения"
            />
            <p className="text-muted-foreground text-xs">
              Укажите 0 или оставьте пустым, если лимит не нужен. По истечении
              времени тест завершится автоматически.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="test-save-journal">Записывать в журнал</Label>
              <p className="text-muted-foreground text-xs">
                Результат попадёт в журнал оценок.
              </p>
            </div>
            <Switch
              id="test-save-journal"
              checked={saveToJournal}
              onCheckedChange={setSaveToJournal}
            />
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="test-for-kids">
                Детский режим (оценки смайликами)
              </Label>
              <p className="text-muted-foreground text-xs">
                Вместо числовых баллов ученик увидит смайлики.
              </p>
            </div>
            <Switch
              id="test-for-kids"
              checked={isForKids}
              onCheckedChange={setIsForKids}
            />
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="test-published">Опубликовать тест</Label>
              <p className="text-muted-foreground text-xs">
                {pointsMatch
                  ? "Опубликованный тест доступен ученикам."
                  : "Публикация недоступна, пока сумма баллов за задания не совпадает с максимальным баллом. Можно сохранить как черновик."}
              </p>
            </div>
            <Switch
              id="test-published"
              checked={isPublished}
              onCheckedChange={setIsPublished}
              disabled={!pointsMatch}
            />
          </div>
        </CardContent>
      </Card>

      {questions.map((q, qi) => (
        <Card key={qi} id={`test-question-${qi}`} className="shrink-0">
          <CardHeader
            className="flex cursor-pointer flex-col items-start gap-3 space-y-0 lg:cursor-default lg:flex-row lg:items-center lg:justify-between"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                return;
              }
              setMobileExpandedQuestionIndex((current) =>
                current === qi ? -1 : qi,
              );
            }}
          >
            <div className="flex w-full flex-col flex-wrap items-start gap-3 sm:flex-row sm:items-center">
              <CardTitle className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-start">
                <span>Задание {qi + 1}</span>
                <span className="text-muted-foreground text-xs font-normal lg:hidden">
                  {mobileExpandedQuestionIndex === qi ? "Свернуть" : "Развернуть"}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {isItemLevelScoringQuestion(q) ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    Баллы за задание: {resolveAdminQuestionMaxPoints(q)}
                  </span>
                ) : (
                  <>
                    <Label
                      htmlFor={`q-points-${qi}`}
                      className="text-muted-foreground text-xs font-normal"
                    >
                      {taskUnitPointsLabel(q)}
                    </Label>
                    <Input
                      id={`q-points-${qi}`}
                      type="number"
                      min={1}
                      step={1}
                      className="h-8 w-20"
                      value={q.points ?? 1}
                      onChange={(e) =>
                        updateQuestion(qi, {
                          points: parsePositiveInt(e.target.value, 1),
                        })
                      }
                    />
                    {isPartialPairScoringQuestion(q) ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {resolveAdminQuestionMaxPoints(q)}
                      </Badge>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              onClick={(event) => {
                event.stopPropagation();
                removeQuestion(qi);
              }}
              disabled={questions.length <= 1}
            >
              Удалить задание
            </Button>
          </CardHeader>
          <CardContent
            className={cn(
              "space-y-4",
              mobileExpandedQuestionIndex !== qi && "max-lg:hidden",
            )}
          >
            <div className="space-y-2">
              <Label htmlFor={`q-text-${qi}`}>
                Формулировка задания (Инструкция и текст) *
              </Label>
              <Editor
                id={`q-text-${qi}`}
                value={q.text}
                onChange={(next) => updateQuestion(qi, { text: next })}
                disabled={pending}
              />
              <p className="text-muted-foreground text-xs">
                Заголовки, списки, изображения и аудио сохраняются как HTML для ученика.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`q-media-limit-${qi}`}>
                Лимит прослушиваний (0 = безлимит)
              </Label>
              <Input
                id={`q-media-limit-${qi}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="max-w-xs"
                value={q.mediaPlayLimit ?? 0}
                onChange={(e) =>
                  updateQuestion(qi, {
                    mediaPlayLimit: parseNonNegativeInt(e.target.value, 0),
                  })
                }
              />
              <p className="text-muted-foreground text-xs">
                Внимание: лимит работает только для загруженных аудио и видео. На
                ссылки YouTube (iframe) ограничение не действует.
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium" id={`q-type-label-${qi}`}>
                Тип выполнения
              </span>
              <Select
                value={q.type}
                onValueChange={(value) =>
                  changeQuestionType(qi, value as QuestionKind)
                }
              >
                <SelectTrigger
                  className="w-full max-w-md"
                  aria-labelledby={`q-type-label-${qi}`}
                >
                  <SelectValue>
                    {QUESTION_TYPE_LABELS[q.type]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_choice">
                    {QUESTION_TYPE_LABELS.single_choice}
                  </SelectItem>
                  <SelectItem value="multiple_choice">
                    {QUESTION_TYPE_LABELS.multiple_choice}
                  </SelectItem>
                  <SelectItem value="matching_puzzle">
                    {QUESTION_TYPE_LABELS.matching_puzzle}
                  </SelectItem>
                  <SelectItem value="dnd_puzzle">
                    {QUESTION_TYPE_LABELS.dnd_puzzle}
                  </SelectItem>
                  <SelectItem value="image_labeling">
                    {QUESTION_TYPE_LABELS.image_labeling}
                  </SelectItem>
                  <SelectItem value="fill_in_the_blanks">
                    {QUESTION_TYPE_LABELS.fill_in_the_blanks}
                  </SelectItem>
                  <SelectItem value="fill_in_the_blanks_multi">
                    {QUESTION_TYPE_LABELS.fill_in_the_blanks_multi}
                  </SelectItem>
                  <SelectItem value="fill_blanks_typing">
                    {QUESTION_TYPE_LABELS.fill_blanks_typing}
                  </SelectItem>
                  <SelectItem value="fill_blanks_typing_multi">
                    {QUESTION_TYPE_LABELS.fill_blanks_typing_multi}
                  </SelectItem>
                  <SelectItem value="text_input">
                    {QUESTION_TYPE_LABELS.text_input}
                  </SelectItem>
                  <SelectItem value="ordering">
                    {QUESTION_TYPE_LABELS.ordering}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isGroupedFillBlanksQuestion(q) ? (
              <GroupedFillBlanksItemsEditor
                items={q.items}
                questionType={q.type}
                onItemsChange={(items) => updateGroupedFillItems(qi, items)}
              />
            ) : isChoiceQuestion(q) ? (
              <ChoiceTaskItemsEditor
                items={q.items}
                isMultiple={q.type === "multiple_choice"}
                onItemsChange={(items) => updateChoiceItems(qi, items)}
              />
            ) : isOrderingQuestion(q) ? (
              <OrderingItemsEditor
                items={q.items}
                onItemsChange={(items) => updateOrderingItems(qi, items)}
              />
            ) : isImageLabelingQuestion(q) ? (
              <div className="space-y-3">
                <span className="text-sm font-medium">
                  Пары «картинка — правильное слово» (у ученика слова в банке
                  будут в случайном порядке)
                </span>
                {q.labelingPairs.map((pair, pi) => (
                  <div
                    key={pi}
                    className="flex flex-col gap-2 rounded-lg border border-dashed p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="min-w-0">
                        <ImageLabelingImageUploadField
                          value={pair.url}
                          onUrlChange={(url) =>
                            updateLabelingPair(qi, pi, { url })
                          }
                          disabled={pending}
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <label className="text-muted-foreground text-xs font-medium">
                          Правильное слово для этой картинки
                        </label>
                        <Input
                          className="min-w-0"
                          value={pair.correctWord}
                          onChange={(e) =>
                            updateLabelingPair(qi, pi, {
                              correctWord: e.target.value,
                            })
                          }
                          placeholder="Например: яблоко"
                          required
                        />
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <label className="text-muted-foreground text-xs font-medium">
                        Подпись к картинке (необязательно)
                      </label>
                      <Input
                        className="min-w-0"
                        value={pair.title}
                        onChange={(e) =>
                          updateLabelingPair(qi, pi, {
                            title: e.target.value,
                          })
                        }
                        placeholder="Краткий заголовок"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLabelingPair(qi, pi)}
                        disabled={q.labelingPairs.length <= 1}
                      >
                        Удалить пару
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addLabelingPair(qi)}
                >
                  + Пара
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="text-sm font-medium">Пары для сопоставления</span>
                {isPuzzleQuestion(q)
                  ? q.options.map((o, oi) => (
                      <div
                        key={oi}
                        className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-end"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <label className="text-muted-foreground text-xs font-medium">
                            Левая часть
                          </label>
                          <Input
                            className="min-w-0"
                            value={o.left}
                            onChange={(e) =>
                              updatePuzzleOption(qi, oi, {
                                left: e.target.value,
                              })
                            }
                            placeholder={`Пара ${oi + 1} — слева`}
                            required
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <label className="text-muted-foreground text-xs font-medium">
                            Правая часть
                          </label>
                          <Input
                            className="min-w-0"
                            value={o.right}
                            onChange={(e) =>
                              updatePuzzleOption(qi, oi, {
                                right: e.target.value,
                              })
                            }
                            placeholder={`Пара ${oi + 1} — справа`}
                            required
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => removeOption(qi, oi)}
                          disabled={q.options.length <= 1}
                        >
                          ✕
                        </Button>
                      </div>
                    ))
                  : null}
                {isPuzzleQuestion(q) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(qi)}
                  >
                    + Пара
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex shrink-0 flex-col gap-3">
        <Button type="button" variant="outline" onClick={addQuestion} className="w-fit">
          + Задание
        </Button>

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
