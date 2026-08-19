"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { getTestDraftForEdit, updateFullTest } from "@/app/actions/test-actions";
import { UnifiedQuestionEditor } from "@/components/admin/tests/unified-question-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuestionField } from "@/types/create-test-form";
import { buildTaskContentPayload } from "@/lib/utils/task-content";
import {
  isPuzzleQuestion,
  isImageLabelingQuestion,
  isGroupedFillBlanksQuestion,
  isChoiceQuestion,
  isOrderingQuestion,
  parsePositiveInt,
  resolveMediaPlayLimitField,
  taskMediaFromQuestion,
  sumGroupedFillBlanksPoints,
  sumChoiceTaskPoints,
  sumOrderingTaskPoints,
  resolveAdminQuestionMaxPoints,
} from "@/lib/admin/test-question-form-utils";
import { hasRichTextContent } from "@/lib/utils/rich-text-content";

export function InlineTestEditor({ testId }: { testId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<QuestionField[]>([]);
  const [settings, setSettings] = useState({
    title: "",
    description: "",
    timeLimit: "0",
    autoCheck: true,
    saveToJournal: true,
    isForKids: false,
    testType: "final",
    maxScore: "100",
    isPublished: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadTest() {
      setLoading(true);
      const res = await getTestDraftForEdit(testId);
      if (cancelled) return;
      if (res.success) {
        const data = res.data.initialData;
        const initialQuestions = data.questions || [];
        const initialMaxScore = data.maxScore || 100;
        const initialPoints = initialQuestions.reduce(
          (sum, q) => sum + resolveAdminQuestionMaxPoints(q),
          0
        );
        const canPublish = initialPoints === initialMaxScore;

        setSettings({
          title: data.titleTeacher || data.title || "",
          description: data.description || "",
          timeLimit: String(data.timeLimit || 0),
          autoCheck: data.autoCheck ?? true,
          saveToJournal: data.saveToJournal ?? true,
          isForKids: data.isForKids ?? false,
          testType: data.testType || "final",
          maxScore: String(initialMaxScore),
          isPublished: canPublish ? (data.isPublished ?? true) : false,
        });
        setQuestions(initialQuestions);
      } else {
        toast.error(res.error || "Не удалось загрузить тест");
      }
      setLoading(false);
    }
    void loadTest();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  async function handleSave() {
    setSaving(true);
    
    // Validation
    for (const q of questions) {
      if (!hasRichTextContent(q.text)) {
        toast.error("Формулировка задания обязательна для всех заданий.");
        setSaving(false);
        return;
      }
    }

    const finalTitle = settings.title.trim() || "Встроенный тест";
    const currentPoints = questions.reduce(
      (sum, q) => sum + resolveAdminQuestionMaxPoints(q),
      0
    );
    const maxScoreNum = parsePositiveInt(settings.maxScore, 100);

    const payload = {
      title: finalTitle,
      description: settings.description.trim() || null,
      folder_name: null,
      is_published: currentPoints === maxScoreNum ? settings.isPublished : false,
      title_teacher: finalTitle,
      title_student: finalTitle,
      test_type: settings.testType as "training" | "final",
      auto_check: settings.autoCheck,
      save_to_journal: settings.saveToJournal,
      max_score: parsePositiveInt(settings.maxScore, 100),
      time_limit: parsePositiveInt(settings.timeLimit, 0),
      is_for_kids: settings.isForKids,
      questions: questions.map((q) => {
        const points = parsePositiveInt(String(q.points ?? 1), 1);
        const taskMedia = taskMediaFromQuestion(q);
        
        if (isPuzzleQuestion(q)) {
          return {
            content: buildTaskContentPayload({ ...taskMedia, includeExample: false }),
            type: q.type,
            points,
            media_play_limit: resolveMediaPlayLimitField(q),
            options: q.options.map((o) => ({
              content: { left: o.left.trim(), right: o.right.trim() },
              is_correct: true as const,
            })),
          };
        }
        if (isImageLabelingQuestion(q)) {
          return {
            content: buildTaskContentPayload({ ...taskMedia, includeExample: false }),
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
          return {
            content: {
              ...buildTaskContentPayload({ ...taskMedia, includeExample: false }),
              items: q.items.map((item) => {
                const payload: Record<string, unknown> = {
                  id: item.id,
                  text: item.text,
                  points: parsePositiveInt(String(item.points ?? 1), 1),
                  segments: item.segments,
                  wordBank: item.wordBank,
                  correctMapping: item.correctMapping,
                };
                if (item.parsedHtml?.trim()) payload.parsedHtml = item.parsedHtml;
                return payload;
              }),
            },
            type: q.type,
            points: sumGroupedFillBlanksPoints(q),
            media_play_limit: resolveMediaPlayLimitField(q),
            options: [],
          };
        }
        if (isChoiceQuestion(q)) {
          return {
            content: {
              ...buildTaskContentPayload({ ...taskMedia, includeExample: false }),
              items: q.items.map((item) => ({
                id: item.id,
                text: item.text,
                points: parsePositiveInt(String(item.points ?? 1), 1),
                options: item.options.map((o) => ({
                  id: o.id,
                  text: o.text.trim(),
                  is_correct: o.isCorrect,
                  ...(o.imageUrl?.trim() ? { image_url: o.imageUrl.trim() } : {}),
                })),
              })),
            },
            type: q.type,
            points: sumChoiceTaskPoints(q),
            media_play_limit: resolveMediaPlayLimitField(q),
            options: [],
          };
        }
        if (isOrderingQuestion(q)) {
          return {
            content: {
              ...buildTaskContentPayload({ ...taskMedia, includeExample: false }),
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
            points: sumOrderingTaskPoints(q),
            media_play_limit: resolveMediaPlayLimitField(q),
            options: [],
          };
        }
        throw new Error(`Unsupported question type: ${(q as QuestionField).type}`);
      }),
    };

    const result = await updateFullTest(testId, payload);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success("Встроенный тест сохранен");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPoints = questions.reduce(
    (sum, q) => sum + resolveAdminQuestionMaxPoints(q),
    0
  );
  const maxScoreNum = parsePositiveInt(settings.maxScore, 100);
  const willPublish = settings.isPublished && currentPoints === maxScoreNum;

  return (
    <div className="space-y-6">
      <Accordion type="single" collapsible className="w-full rounded-lg border bg-card px-4">
        <AccordionItem value="settings" className="border-none">
          <AccordionTrigger className="hover:no-underline py-4">
            <span className="font-semibold">⚙️ Настройки теста</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="inline-title">Название теста</Label>
              <Input
                id="inline-title"
                value={settings.title}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-desc">Описание (необязательно)</Label>
              <Input
                id="inline-desc"
                value={settings.description}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Тип теста</Label>
              <Select
                value={settings.testType}
                onValueChange={(v) => setSettings({ ...settings, testType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="training">Тренировочный</SelectItem>
                  <SelectItem value="final">Итоговый</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="inline-max-score">Максимальный балл</Label>
                <Badge 
                  variant={currentPoints === maxScoreNum ? "default" : "destructive"}
                  className={currentPoints === maxScoreNum ? "bg-green-500 hover:bg-green-600" : ""}
                >
                  Распределено баллов: {currentPoints} / {maxScoreNum}
                </Badge>
              </div>
              <Input
                id="inline-max-score"
                type="number"
                min="1"
                value={settings.maxScore}
                onChange={(e) => setSettings({ ...settings, maxScore: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-time">Ограничение по времени (минуты, 0 = без лимита)</Label>
              <Input
                id="inline-time"
                type="number"
                min="0"
                value={settings.timeLimit}
                onChange={(e) => setSettings({ ...settings, timeLimit: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="inline-published">Опубликован</Label>
                <p className="text-muted-foreground text-xs">Доступен для прохождения учениками.</p>
                {currentPoints !== maxScoreNum && (
                  <p className="text-destructive text-xs font-medium mt-1">
                    Публикация доступна после распределения всех баллов
                  </p>
                )}
              </div>
              <Switch
                id="inline-published"
                checked={currentPoints === maxScoreNum ? settings.isPublished : false}
                disabled={currentPoints !== maxScoreNum}
                onCheckedChange={(c) => setSettings({ ...settings, isPublished: c })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="inline-journal">Записывать в журнал</Label>
                <p className="text-muted-foreground text-xs">Результат попадёт в журнал оценок.</p>
              </div>
              <Switch
                id="inline-journal"
                checked={settings.saveToJournal}
                onCheckedChange={(c) => setSettings({ ...settings, saveToJournal: c })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="inline-kids">Детский режим</Label>
                <p className="text-muted-foreground text-xs">Оценки смайликами вместо баллов.</p>
              </div>
              <Switch
                id="inline-kids"
                checked={settings.isForKids}
                onCheckedChange={(c) => setSettings({ ...settings, isForKids: c })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end">
        <Badge 
          variant={currentPoints === maxScoreNum ? "default" : "destructive"}
          className={currentPoints === maxScoreNum ? "bg-green-500 hover:bg-green-600" : ""}
        >
          Распределено баллов: {currentPoints} / {maxScoreNum}
        </Badge>
      </div>

      <UnifiedQuestionEditor
        questions={questions}
        onQuestionsChange={setQuestions}
        pending={saving}
      />

      <Button
        onClick={handleSave}
        disabled={saving}
        variant={willPublish ? "default" : "secondary"}
        className="w-full sm:w-auto"
      >
        {saving ? (
          <>
            <Loader2Icon className="mr-2 size-4 animate-spin" />
            Сохранение...
          </>
        ) : willPublish ? (
          "Сохранить и Опубликовать"
        ) : (
          "Сохранить черновик"
        )}
      </Button>
    </div>
  );
}