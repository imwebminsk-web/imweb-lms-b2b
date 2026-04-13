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
          description: string | null
          id: string
          images_gallery: Json
          languages: string[]
          level: Database["public"]["Enums"]["course_level"]
          price: string
          slug: string
          start_date: string | null
          start_date_type: Database["public"]["Enums"]["start_date_type"]
          status: Database["public"]["Enums"]["course_status"]
          target_audience: Database["public"]["Enums"]["target_audience"]
          teacher_id: string
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          images_gallery?: Json
          languages?: string[]
          level?: Database["public"]["Enums"]["course_level"]
          price?: string
          slug: string
          start_date?: string | null
          start_date_type?: Database["public"]["Enums"]["start_date_type"]
          status?: Database["public"]["Enums"]["course_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          teacher_id: string
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          images_gallery?: Json
          languages?: string[]
          level?: Database["public"]["Enums"]["course_level"]
          price?: string
          slug?: string
          start_date?: string | null
          start_date_type?: Database["public"]["Enums"]["start_date_type"]
          status?: Database["public"]["Enums"]["course_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
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
      lessons: {
        Row: {
          content: Json
          id: string
          module_id: string
          order_index: number
          test_id: string | null
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
        }
        Insert: {
          content?: Json
          id?: string
          module_id: string
          order_index?: number
          test_id?: string | null
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
        }
        Update: {
          content?: Json
          id?: string
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
      modules: {
        Row: {
          course_id: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          course_id: string
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          course_id?: string
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
          order_index: number
          test_id: string
          type: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          id?: string
          order_index: number
          test_id: string
          type?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          order_index?: number
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
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["attempt_status"] | null
          student_id: string
          test_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["attempt_status"] | null
          student_id: string
          test_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["attempt_status"] | null
          student_id?: string
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
      tests: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_published: boolean | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attempt_status: "in_progress" | "completed"
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
      lesson_type: "video" | "text" | "test"
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
      attempt_status: ["in_progress", "completed"],
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
      lesson_type: ["video", "text", "test"],
      profile_role: ["admin", "teacher", "student"],
      start_date_type: ["fixed", "on_demand"],
      target_audience: ["kids", "adults"],
    },
  },
} as const
