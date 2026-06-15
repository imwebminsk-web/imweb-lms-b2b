"use client";

import { useState } from "react";

import {
  initStudentQuiz,
  type InitStudentQuizSuccess,
} from "@/app/actions/student-quiz-actions";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
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
  /** Заголовок карточки до старта теста. */
  title?: string;
};

export function TestRevealWrapper({
  testId,
  title = "Проверка знаний",
}: TestRevealWrapperProps) {
  const [quizData, setQuizData] = useState<InitStudentQuizSuccess | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <QuizPlayer
          attemptId={quizData.attemptId}
          testTitle={quizData.test.title}
          testDescription={quizData.test.description}
          questions={quizData.questions}
          isForKids={quizData.test.isForKids}
          timeLimitMinutes={quizData.test.timeLimitMinutes}
        />
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Brain className="text-primary size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg leading-snug">{title}</CardTitle>
            <CardDescription>
              Нажмите кнопку, чтобы начать тестирование
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
              Загрузка…
            </>
          ) : (
            "Начать тестирование"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
