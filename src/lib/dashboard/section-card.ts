export type DashboardSectionCard = {
  label: string;
  value: string;
  trendPercent: string;
  trendUp: boolean;
  footerTitle: string;
  footerHint: string;
};

export type TeacherDashboardMetrics = {
  totalCourses: number;
  totalCohorts: number;
  totalStudents: number;
  pendingReviews: number;
};

export type AdminDashboardMetrics = {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
};
