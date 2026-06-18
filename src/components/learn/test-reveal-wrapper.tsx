"use client";

import { useEffect, useState } from "react";

import {
  getStudentQuizPreviewTitle,
  initStudentQuiz,
  type InitStudentQuizSuccess,
  type StudentTestType,
} from "@/app/actions/student-quiz-actions";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
import { useLanguage } from "@/components/providers/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, Loader2 } from "lucide-react";

type TestRevealWrapperProps = {
  testId: string;
};

export function TestRevealWrapper({ testId }: TestRevealWrapperProps) {
  const { t } = useLanguage();
  const fallbackTitle = t("lesson_view.defaultQuizTitle");
  const [cardTitle, setCardTitle] = useState(fallbackTitle);
  const [testType, setTestType] = useState<StudentTestType | null>(null);
  const [quizData, setQuizData] = useState<InitStudentQuizSuccess | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTitle() {
      const res = await getStudentQuizPreviewTitle(testId);
      if (cancelled || !res.success) {
        return;
      }
      setCardTitle(res.title);
      setTestType(res.testType);
    }

    void loadTitle();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  async function handleStart() {
    setIsLoading(true);
    try {
      const res = await initStudentQuiz(testId);
      if (res.success) {
        setQuizData(res);
      } else {
        console.error("[TestRevealWrapper]", res.error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (quizData) {
    return (
      <QuizPlayer
        attemptId={quizData.attemptId}
        testTitle={quizData.test.title}
        testDescription={quizData.test.description}
        questions={quizData.questions}
        isForKids={quizData.test.isForKids}
        timeLimitMinutes={quizData.test.timeLimitMinutes}
        focusedMode
        onExit={() => setQuizData(null)}
      />
    );
  }

  return (
    <Card className="border-primary/20 bg-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Brain className="text-primary size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg leading-snug">{cardTitle}</CardTitle>
              {testType ? (
                <Badge variant="outline" className="shrink-0">
                  {testType === "training"
                    ? t("lesson_view.trainingTestBadge")
                    : t("lesson_view.finalTestBadge")}
                </Badge>
              ) : null}
            </div>
            <CardDescription>
              {t("lesson_view.startQuizDescription")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          size="lg"
          onClick={handleStart}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              {t("lesson_view.loading")}
            </>
          ) : (
            t("lesson_view.takeTest")
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
