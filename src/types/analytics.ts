export type TranscriptJournalAssessment = {
  type: "test" | "assignment";
  title: string;
  score: number | null;
  isPendingReview: boolean;
  testId: string | null;
  attemptId: string | null;
  blockId: string | null;
  assignmentStatus: "pending" | "approved" | "rejected" | null;
};

export interface EmployeeAnalyticsRow {
  id: string;
  fullName: string;
  team: string;
  jobTitle: string;
  assignedCourses: number;
  avgProgress: number;
  avgScore: number;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  courseStatus: 'completed' | 'in_progress' | 'not_started' | null;
  journalAssessments: { title: string; score: number | null; isPendingReview: boolean }[];
}

export interface EmployeeTranscriptCourse {
  courseId: string;
  courseTitle: string;
  status: 'completed' | 'in_progress' | 'not_started';
  progress: number;
  journalAssessments: TranscriptJournalAssessment[];
}

export type CourseProgressStatus = "completed" | "in_progress" | "not_started";

export interface CourseAnalyticsEmployeeRow {
  id: string;
  fullName: string;
  team: string;
  jobTitle: string;
  courseStatus: CourseProgressStatus;
  progress: number;
}
