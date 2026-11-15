
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_kind": string,"actor_name": string | null,"actor_user_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"entity": string,"entity_id": string | null,"household_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_kind": string,"actor_name"?: string | null,"actor_user_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"household_id": string,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_kind"?: string,"actor_name"?: string | null,"actor_user_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"household_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "household"
      referencedColumns: ["id"]
    }
                  ]
                },"household": {
                  Row: {
                    "country": string,"created_at": string,"default_locale": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"created_at"?: string,"default_locale"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"default_locale"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"household_profile": {
                  Row: {
                    "created_at": string,"customs": string | null,"feeding_intent": string | null,"firstborn": boolean | null,"has_supplementary": boolean | null,"health_fund": string | null,"household_id": string,"rh_negative": boolean | null,"sex": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customs"?: string | null,"feeding_intent"?: string | null,"firstborn"?: boolean | null,"has_supplementary"?: boolean | null,"health_fund"?: string | null,"household_id": string,"rh_negative"?: boolean | null,"sex"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"customs"?: string | null,"feeding_intent"?: string | null,"firstborn"?: boolean | null,"has_supplementary"?: boolean | null,"health_fund"?: string | null,"household_id"?: string,"rh_negative"?: boolean | null,"sex"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_profile_household_id_fkey"
      columns: ["household_id"]
isOneToOne: true
      referencedRelation: "household"
      referencedColumns: ["id"]
    }
                  ]
                },"invite": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"household_id": string,"id": string,"invited_by": string,"revoked_at": string | null,"role": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"household_id": string,"id"?: string,"invited_by": string,"revoked_at"?: string | null,"role"?: string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"household_id"?: string,"id"?: string,"invited_by"?: string,"revoked_at"?: string | null,"role"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invite_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "household"
      referencedColumns: ["id"]
    }
                  ]
                },"member": {
                  Row: {
                    "created_at": string,"gender_form": string,"household_id": string,"locale": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gender_form"?: string,"household_id": string,"locale"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"gender_form"?: string,"household_id"?: string,"locale"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "household"
      referencedColumns: ["id"]
    }
                  ]
                },"pregnancy": {
                  Row: {
                    "created_at": string,"dating_method": string,"edd": string | null,"fetuses": number,"household_id": string,"lmp": string | null,"transfer_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dating_method": string,"edd"?: string | null,"fetuses"?: number,"household_id": string,"lmp"?: string | null,"transfer_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"dating_method"?: string,"edd"?: string | null,"fetuses"?: number,"household_id"?: string,"lmp"?: string | null,"transfer_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pregnancy_household_id_fkey"
      columns: ["household_id"]
isOneToOne: true
      referencedRelation: "household"
      referencedColumns: ["id"]
    }
                  ]
                },"task_state": {
                  Row: {
                    "acted_at": string,"acted_by": string,"household_id": string,"kb_item_id": string,"kb_version": number,"note": string | null,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acted_at"?: string,"acted_by": string,"household_id": string,"kb_item_id": string,"kb_version": number,"note"?: string | null,"state": string
                  }
                  Update: {
                    "acted_at"?: string,"acted_by"?: string,"household_id"?: string,"kb_item_id"?: string,"kb_version"?: number,"note"?: string | null,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_state_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "household"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"create_household":
{ Args: { "p_locale"?: string,"p_name": string }; Returns: string
                           },
"is_member":
{ Args: { "h": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
