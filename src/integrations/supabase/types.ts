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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_call_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error_type: string | null
          finish_reason: string | null
          id: string
          input_tokens: number | null
          mode: string | null
          output_tokens: number | null
          patient_id: string | null
          practitioner_id: string
          specialty_id: string | null
          success: boolean | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error_type?: string | null
          finish_reason?: string | null
          id?: string
          input_tokens?: number | null
          mode?: string | null
          output_tokens?: number | null
          patient_id?: string | null
          practitioner_id: string
          specialty_id?: string | null
          success?: boolean | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error_type?: string | null
          finish_reason?: string | null
          id?: string
          input_tokens?: number | null
          mode?: string | null
          output_tokens?: number | null
          patient_id?: string | null
          practitioner_id?: string
          specialty_id?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_prompts: {
        Row: {
          author: string | null
          created_at: string | null
          description: string | null
          has_protocols: boolean | null
          id: string
          is_active: boolean | null
          specialty_icon: string | null
          specialty_id: string
          specialty_name: string
          system_prompt: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          description?: string | null
          has_protocols?: boolean | null
          id?: string
          is_active?: boolean | null
          specialty_icon?: string | null
          specialty_id: string
          specialty_name: string
          system_prompt: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string | null
          description?: string | null
          has_protocols?: boolean | null
          id?: string
          is_active?: boolean | null
          specialty_icon?: string | null
          specialty_id?: string
          specialty_name?: string
          system_prompt?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      lab_results: {
        Row: {
          created_at: string
          id: string
          lab_ref_max: number | null
          lab_ref_min: number | null
          lab_ref_text: string | null
          marker_id: string
          session_id: string
          text_value: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          lab_ref_max?: number | null
          lab_ref_min?: number | null
          lab_ref_text?: string | null
          marker_id: string
          session_id: string
          text_value?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          lab_ref_max?: number | null
          lab_ref_min?: number | null
          lab_ref_text?: string | null
          marker_id?: string
          session_id?: string
          text_value?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lab_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_sessions: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          session_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          session_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_anamneses: {
        Row: {
          id: string
          patient_id: string
          specialty_id: string
          expectativa_consulta: string | null
          queixas_principais: string | null
          objetivos: string | null
          nota_saude: number | null
          o_que_melhoraria: string | null
          fase_melhor: string | null
          evento_marcante: string | null
          comorbidades: string | null
          peso_altura: string | null
          suplementacao: string | null
          medicamentos_continuos: string | null
          tipo_sanguineo: string | null
          estado_pele: string | null
          estado_cabelos: string | null
          estado_unhas: string | null
          memoria_concentracao: string | null
          imunidade: string | null
          consumo_cafe: string | null
          habitos: string[] | null
          sintomas_atuais: string[] | null
          evacuacoes_por_dia: string | null
          tipo_fezes: string | null
          uso_antibiotico_2anos: string | null
          estufamento_gases: string | null
          litros_agua_dia: string | null
          dorme_bem: string | null
          horario_sono: string | null
          acorda_cansado: string | null
          dificuldade_dormir: string | null
          nivel_estresse: number | null
          faz_terapia: string | null
          atividade_relaxamento: string | null
          hobbies: string | null
          atividade_fisica: string | null
          recordatorio_alimentar: string | null
          intolerancias_alimentares: string | null
          episodios_compulsao: string | null
          culpa_apos_comer: string | null
          preferencias_alimentares: string | null
          aversoes_alimentares: string | null
          ciclo_regular: string | null
          metodo_contraceptivo: string | null
          deseja_engravidar: string | null
          tem_tpm: string | null
          specialty_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          specialty_id: string
          expectativa_consulta?: string | null
          queixas_principais?: string | null
          objetivos?: string | null
          nota_saude?: number | null
          o_que_melhoraria?: string | null
          fase_melhor?: string | null
          evento_marcante?: string | null
          comorbidades?: string | null
          peso_altura?: string | null
          suplementacao?: string | null
          medicamentos_continuos?: string | null
          tipo_sanguineo?: string | null
          estado_pele?: string | null
          estado_cabelos?: string | null
          estado_unhas?: string | null
          memoria_concentracao?: string | null
          imunidade?: string | null
          consumo_cafe?: string | null
          habitos?: string[] | null
          sintomas_atuais?: string[] | null
          evacuacoes_por_dia?: string | null
          tipo_fezes?: string | null
          uso_antibiotico_2anos?: string | null
          estufamento_gases?: string | null
          litros_agua_dia?: string | null
          dorme_bem?: string | null
          horario_sono?: string | null
          acorda_cansado?: string | null
          dificuldade_dormir?: string | null
          nivel_estresse?: number | null
          faz_terapia?: string | null
          atividade_relaxamento?: string | null
          hobbies?: string | null
          atividade_fisica?: string | null
          recordatorio_alimentar?: string | null
          intolerancias_alimentares?: string | null
          episodios_compulsao?: string | null
          culpa_apos_comer?: string | null
          preferencias_alimentares?: string | null
          aversoes_alimentares?: string | null
          ciclo_regular?: string | null
          metodo_contraceptivo?: string | null
          deseja_engravidar?: string | null
          tem_tpm?: string | null
          specialty_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          specialty_id?: string
          expectativa_consulta?: string | null
          queixas_principais?: string | null
          objetivos?: string | null
          nota_saude?: number | null
          o_que_melhoraria?: string | null
          fase_melhor?: string | null
          evento_marcante?: string | null
          comorbidades?: string | null
          peso_altura?: string | null
          suplementacao?: string | null
          medicamentos_continuos?: string | null
          tipo_sanguineo?: string | null
          estado_pele?: string | null
          estado_cabelos?: string | null
          estado_unhas?: string | null
          memoria_concentracao?: string | null
          imunidade?: string | null
          consumo_cafe?: string | null
          habitos?: string[] | null
          sintomas_atuais?: string[] | null
          evacuacoes_por_dia?: string | null
          tipo_fezes?: string | null
          uso_antibiotico_2anos?: string | null
          estufamento_gases?: string | null
          litros_agua_dia?: string | null
          dorme_bem?: string | null
          horario_sono?: string | null
          acorda_cansado?: string | null
          dificuldade_dormir?: string | null
          nivel_estresse?: number | null
          faz_terapia?: string | null
          atividade_relaxamento?: string | null
          hobbies?: string | null
          atividade_fisica?: string | null
          recordatorio_alimentar?: string | null
          intolerancias_alimentares?: string | null
          episodios_compulsao?: string | null
          culpa_apos_comer?: string | null
          preferencias_alimentares?: string | null
          aversoes_alimentares?: string | null
          ciclo_regular?: string | null
          metodo_contraceptivo?: string | null
          deseja_engravidar?: string | null
          tem_tpm?: string | null
          specialty_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_anamneses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_specialty_notes: {
        Row: {
          id: string
          patient_id: string
          specialty_id: string
          impressao_clinica: string | null
          hipoteses_diagnosticas: string | null
          foco_consulta: string | null
          observacoes_exames: string | null
          conduta_planejada: string | null
          pontos_atencao: string | null
          medicamentos_prescritos: string | null
          resposta_tratamento: string | null
          proximos_passos: string | null
          notas_livres: string | null
          exames_em_dia: boolean | null
          adesao_tratamento: string | null
          motivacao_paciente: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          specialty_id?: string
          impressao_clinica?: string | null
          hipoteses_diagnosticas?: string | null
          foco_consulta?: string | null
          observacoes_exames?: string | null
          conduta_planejada?: string | null
          pontos_atencao?: string | null
          medicamentos_prescritos?: string | null
          resposta_tratamento?: string | null
          proximos_passos?: string | null
          notas_livres?: string | null
          exames_em_dia?: boolean | null
          adesao_tratamento?: string | null
          motivacao_paciente?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          specialty_id?: string
          impressao_clinica?: string | null
          hipoteses_diagnosticas?: string | null
          foco_consulta?: string | null
          observacoes_exames?: string | null
          conduta_planejada?: string | null
          pontos_atencao?: string | null
          medicamentos_prescritos?: string | null
          resposta_tratamento?: string | null
          proximos_passos?: string | null
          notas_livres?: string | null
          exames_em_dia?: boolean | null
          adesao_tratamento?: string | null
          motivacao_paciente?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_specialty_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_analyses: {
        Row: {
          created_at: string
          full_text: string | null
          id: string
          mode: string
          model_used: string | null
          patient_id: string
          patient_plan: string | null
          patterns: Json | null
          prescription_table: Json | null
          protocol_recommendations: Json | null
          specialty_id: string
          specialty_name: string | null
          suggestions: Json | null
          summary: string | null
          technical_analysis: string | null
          trends: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_text?: string | null
          id?: string
          mode?: string
          model_used?: string | null
          patient_id: string
          patient_plan?: string | null
          patterns?: Json | null
          prescription_table?: Json | null
          protocol_recommendations?: Json | null
          specialty_id?: string
          specialty_name?: string | null
          suggestions?: Json | null
          summary?: string | null
          technical_analysis?: string | null
          trends?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_text?: string | null
          id?: string
          mode?: string
          model_used?: string | null
          patient_id?: string
          patient_plan?: string | null
          patterns?: Json | null
          prescription_table?: Json | null
          protocol_recommendations?: Json | null
          specialty_id?: string
          specialty_name?: string | null
          suggestions?: Json | null
          summary?: string | null
          technical_analysis?: string | null
          trends?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_analyses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          activity_level: string | null
          birth_date: string | null
          created_at: string
          id: string
          main_complaints: string | null
          name: string
          objectives: string[] | null
          practitioner_id: string
          restrictions: string | null
          sex: string
          sport_modality: string | null
        }
        Insert: {
          activity_level?: string | null
          birth_date?: string | null
          created_at?: string
          id?: string
          main_complaints?: string | null
          name: string
          objectives?: string[] | null
          practitioner_id: string
          restrictions?: string | null
          sex: string
          sport_modality?: string | null
        }
        Update: {
          activity_level?: string | null
          birth_date?: string | null
          created_at?: string
          id?: string
          main_complaints?: string | null
          name?: string
          objectives?: string[] | null
          practitioner_id?: string
          restrictions?: string | null
          sex?: string
          sport_modality?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
