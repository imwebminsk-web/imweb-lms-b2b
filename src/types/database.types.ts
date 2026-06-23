export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      courses: {
        Row: {
          age_group: string | null
          category: string | null
          created_at: string
          description: string | null
          detailed_description: string | null
          delivery_format: string | null
          duration_unit: string | null
          duration_value: number | null
          has_certificate: boolean
          id: string
          image_url: string | null
          level: Database["public"]["Enums"]["course_level"] | null
          marketing_audience: string | null
          language: string | null
          price: string
          promotional_images: string[] | null
          slug: string
          start_date: string | null
          start_date_type: Database["public"]["Enums"]["start_date_type"]
          status: Database["public"]["Enums"]["course_status"]
          target_audience: Database["public"]["Enums"]["target_audience"]
          teacher_id: string
          title: string
          video_url: string | null
          vimeo_url: string | null
          youtube_url: string | null
        }
        Insert: {
          age_group?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          detailed_description?: string | null
          delivery_format?: string | null
          duration_unit?: string | null
          duration_value?: number | null
          has_certificate?: boolean
          id?: string
          image_url?: string | null
          level?: Database["public"]["Enums"]["course_level"] | null
          marketing_audience?: string | null
          language?: string | null
          price?: string
          promotional_images?: string[]
          slug: string
          start_date?: string | null
          start_date_type?: Database["public"]["Enums"]["start_date_type"]
          status?: Database["public"]["Enums"]["course_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          teacher_id: string
          title: string
          video_url?: string | null
          vimeo_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          age_group?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          detailed_description?: string | null
          delivery_format?: string | null
          duration_unit?: string | null
          duration_value?: number | null
          has_certificate?: boolean
          id?: string
          image_url?: string | null
          level?: Database["public"]["Enums"]["course_level"] | null
          marketing_audience?: string | null
          language?: string | null
          price?: string
          promotional_images?: string[]
          slug?: string
          start_date?: string | null
          start_date_type?: Database["public"]["Enums"]["start_date_type"]
          status?: Database["public"]["Enums"]["course_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          teacher_id?: string
          title?: string
          video_url?: string | null
          vimeo_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_active: boolean
          is_chat_enabled: boolean
          name: string
          pin_code: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_chat_enabled?: boolean
          name: string
          pin_code: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_chat_enabled?: boolean
          name?: string
          pin_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_assignments: {
        Row: {
          cohort_id: string
          created_at: string
          due_date: string | null
          id: string
          is_required: boolean
          lesson_id: string | null
          test_id: string | null
        }
        Insert: {
          cohort_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_required?: boolean
          lesson_id?: string | null
          test_id?: string | null
        }
        Update: {
          cohort_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_required?: boolean
          lesson_id?: string | null
          test_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohort_assignments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_assignments_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_receipts: {
        Row: {
          cohort_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_receipts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_messages: {
        Row: {
          cohort_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_messages_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          cohort_id: string | null
          course_id: string
          enrolled_at: string
          id: string
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          course_id: string
          enrolled_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          course_id?: string
          enrolled_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_published: boolean
          module_id: string
          order_index: number
          test_id: string | null
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          module_id: string
          order_index?: number
          test_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["lesson_type"]
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          module_id?: string
          order_index?: number
          test_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["lesson_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_blocks: {
        Row: {
          content: Json
          created_at: string
          id: string
          lesson_id: string
          order_index: number
          type: Database["public"]["Enums"]["lesson_block_type"]
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          lesson_id: string
          order_index?: number
          type: Database["public"]["Enums"]["lesson_block_type"]
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          lesson_id?: string
          order_index?: number
          type?: Database["public"]["Enums"]["lesson_block_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_blocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          student_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          student_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          full_name: string | null
          id: string
          profession: string | null
          role: Database["public"]["Enums"]["profile_role"]
          specialization: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id: string
          profession?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          specialization?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string
          profession?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          specialization?: string | null
        }
        Relationships: []
      }
      profile_secrets: {
        Row: {
          email: string | null
          id: string
        }
        Insert: {
          email?: string | null
          id: string
        }
        Update: {
          email?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_secrets_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          answer_data: Json | null
          attempt_id: string
          created_at: string | null
          id: string
          option_id: string
          question_id: string
        }
        Insert: {
          answer_data?: Json | null
          attempt_id: string
          created_at?: string | null
          id?: string
          option_id: string
          question_id: string
        }
        Update: {
          answer_data?: Json | null
          attempt_id?: string
          created_at?: string | null
          id?: string
          option_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "student_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          content: string
          created_at: string
          grade: number | null
          id: string
          lesson_block_id: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          teacher_comment: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          grade?: number | null
          id?: string
          lesson_block_id: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          teacher_comment?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          grade?: number | null
          id?: string
          lesson_block_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          teacher_comment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_lesson_block_id_fkey"
            columns: ["lesson_block_id"]
            isOneToOne: false
            referencedRelation: "lesson_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          content: Json
          id: string
          is_correct: boolean
          order_index: number
          question_id: string
        }
        Insert: {
          content: Json
          id?: string
          is_correct?: boolean
          order_index: number
          question_id: string
        }
        Update: {
          content?: Json
          id?: string
          is_correct?: boolean
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          media_play_limit: number
          order_index: number
          points: number
          test_id: string
          type: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          id?: string
          media_play_limit?: number
          order_index: number
          points?: number
          test_id: string
          type?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          media_play_limit?: number
          order_index?: number
          points?: number
          test_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      student_attempts: {
        Row: {
          completed_at: string | null
          id: string
          is_training_mode: boolean
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["attempt_status"] | null
          student_id: string
          teacher_comment: string | null
          test_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_training_mode?: boolean
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["attempt_status"] | null
          student_id: string
          teacher_comment?: string | null
          test_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_training_mode?: boolean
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["attempt_status"] | null
          student_id?: string
          teacher_comment?: string | null
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          has_unread_student: boolean
          has_unread_teacher: boolean
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          has_unread_student?: boolean
          has_unread_teacher?: boolean
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          has_unread_student?: boolean
          has_unread_teacher?: boolean
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      taxonomies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          type: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          type: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          type?: string
          value?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          auto_check: boolean
          created_at: string | null
          description: string | null
          folder_name: string | null
          id: string
          is_for_kids: boolean
          is_published: boolean | null
          max_score: number
          save_to_journal: boolean
          test_type: string
          time_limit: number
          title: string
          title_student: string | null
          title_teacher: string | null
          user_id: string | null
        }
        Insert: {
          auto_check?: boolean
          created_at?: string | null
          description?: string | null
          folder_name?: string | null
          id?: string
          is_for_kids?: boolean
          is_published?: boolean | null
          max_score?: number
          save_to_journal?: boolean
          test_type?: string
          time_limit?: number
          title: string
          title_student?: string | null
          title_teacher?: string | null
          user_id?: string | null
        }
        Update: {
          auto_check?: boolean
          created_at?: string | null
          description?: string | null
          folder_name?: string | null
          id?: string
          is_for_kids?: boolean
          is_published?: boolean | null
          max_score?: number
          save_to_journal?: boolean
          test_type?: string
          time_limit?: number
          title?: string
          title_student?: string | null
          title_teacher?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_cohort_student_emails: {
        Args: {
          p_cohort_id: string
        }
        Returns: {
          email: string | null
          full_name: string | null
          user_id: string
        }[]
      }
      get_my_pending_review_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          cohort_id: string
          pending_count: number
        }[]
      }
      get_my_student_progress: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          type: string
          title: string
          status: string
          points: number | null
          course_id: string
          course_slug: string
          course_title: string
          lesson_id: string
          test_id: string | null
          lesson_block_id: string | null
          assignment_submission_id: string | null
          has_completed_test_attempt: boolean
        }[]
      }
      get_users_emails: {
        Args: {
          p_user_ids: string[]
        }
        Returns: {
          email: string | null
          user_id: string
        }[]
      }
      join_cohort_by_pin: {
        Args: {
          p_pin: string
        }
        Returns: Json
      }
      mark_support_ticket_read: {
        Args: {
          p_ticket_id: string
          p_role: string
        }
        Returns: undefined
      }
      touch_support_ticket: {
        Args: {
          p_ticket_id: string
          p_sender_role: string
        }
        Returns: undefined
      }
    }
    Enums: {
      attempt_status: "in_progress" | "completed" | "pending_review"
      submission_status: "pending" | "approved" | "rejected"
      course_level:
        | "0"
        | "A1"
        | "A2"
        | "B1"
        | "B1+"
        | "B2"
        | "B2+"
        | "C1"
        | "C2"
      course_status: "draft" | "published"
      lesson_block_type:
        | "text"
        | "image"
        | "youtube"
        | "vimeo"
        | "assignment"
        | "quiz"
      lesson_type: "video" | "text" | "test" | "quiz"
      profile_role: "admin" | "teacher" | "student"
      start_date_type: "fixed" | "on_demand"
      target_audience: "kids" | "adults"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attempt_status: ["in_progress", "completed", "pending_review"],
      submission_status: ["pending", "approved", "rejected"],
      course_level: [
        "0",
        "A1",
        "A2",
        "B1",
        "B1+",
        "B2",
        "B2+",
        "C1",
        "C2",
      ],
      course_status: ["draft", "published"],
      lesson_block_type: [
        "text",
        "image",
        "youtube",
        "vimeo",
        "assignment",
        "quiz",
      ],
      lesson_type: ["video", "text", "test", "quiz"],
      profile_role: ["admin", "teacher", "student"],
      start_date_type: ["fixed", "on_demand"],
      target_audience: ["kids", "adults"],
    },
  },
} as const
