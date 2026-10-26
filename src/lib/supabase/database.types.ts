
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
            "order_items": {
                  Row: {
                    "id": string,"order_id": string,"product_id": string,"product_name": string,"quantity": number,"subtotal": number,"unit_cost": number | null,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"order_id": string,"product_id": string,"product_name": string,"quantity": number,"subtotal": number,"unit_cost"?: number | null,"unit_price": number
                  }
                  Update: {
                    "id"?: string,"order_id"?: string,"product_id"?: string,"product_name"?: string,"quantity"?: number,"subtotal"?: number,"unit_cost"?: number | null,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "actor_type": string,"changed_at": string,"changed_by": string | null,"from_status": string | null,"id": string,"notes": string | null,"order_id": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_type": string,"changed_at"?: string,"changed_by"?: string | null,"from_status"?: string | null,"id"?: string,"notes"?: string | null,"order_id": string,"to_status": string
                  }
                  Update: {
                    "actor_type"?: string,"changed_at"?: string,"changed_by"?: string | null,"from_status"?: string | null,"id"?: string,"notes"?: string | null,"order_id"?: string,"to_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "cancellation_reason": string | null,"completed_at": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string | null,"customer_email": string | null,"customer_name": string,"customer_phone": string | null,"id": string,"idempotency_key": string | null,"order_code": string,"order_status": string,"order_type": string,"payment_status": string,"pickup_at": string | null,"queue_priority": boolean,"queued_at": string | null,"total_amount": number,"tracking_code_hash": string | null,"tracking_code_salt": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancellation_reason"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_email"?: string | null,"customer_name": string,"customer_phone"?: string | null,"id"?: string,"idempotency_key"?: string | null,"order_code": string,"order_status": string,"order_type": string,"payment_status"?: string,"pickup_at"?: string | null,"queue_priority"?: boolean,"queued_at"?: string | null,"total_amount"?: number,"tracking_code_hash"?: string | null,"tracking_code_salt"?: number,"updated_at"?: string
                  }
                  Update: {
                    "cancellation_reason"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_email"?: string | null,"customer_name"?: string,"customer_phone"?: string | null,"id"?: string,"idempotency_key"?: string | null,"order_code"?: string,"order_status"?: string,"order_type"?: string,"payment_status"?: string,"pickup_at"?: string | null,"queue_priority"?: boolean,"queued_at"?: string | null,"total_amount"?: number,"tracking_code_hash"?: string | null,"tracking_code_salt"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"order_id": string,"paid_at": string,"payment_method": string,"received_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"order_id": string,"paid_at"?: string,"payment_method": string,"received_by": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"order_id"?: string,"paid_at"?: string,"payment_method"?: string,"received_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "created_at": string,"cost_price": number | null,"description": string | null,"id": string,"image_url": string | null,"is_available": boolean,"name": string,"price": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cost_price"?: number | null,"description"?: string | null,"id"?: string,"image_url"?: string | null,"is_available"?: boolean,"name": string,"price": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"cost_price"?: number | null,"description"?: string | null,"id"?: string,"image_url"?: string | null,"is_available"?: boolean,"name"?: string,"price"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"is_active": boolean,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"id": string,"is_active"?: boolean,"role": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start"?: string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"store_settings": {
                  Row: {
                    "business_hours": NonNullable<Json>,"id": number,"manual_qris_enabled": boolean,"min_preorder_minutes": number,"slot_interval_minutes": number,"store_name": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_hours": NonNullable<Json>,"id"?: number,"manual_qris_enabled"?: boolean,"min_preorder_minutes"?: number,"slot_interval_minutes"?: number,"store_name": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_hours"?: NonNullable<Json>,"id"?: number,"manual_qris_enabled"?: boolean,"min_preorder_minutes"?: number,"slot_interval_minutes"?: number,"store_name"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assert_active_staff":
{ Args: { "p_actor": string,"p_roles"?: (string)[] }; Returns: {
              "created_at": string,
"full_name": string,
"id": string,
"is_active": boolean,
"role": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_order":
{ Args: { "p_actor": string,"p_order_id": string,"p_reason": string }; Returns: Json
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"clear_queue_priority":
{ Args: { "p_actor": string,"p_order_id": string }; Returns: Json
                           },
"complete_order":
{ Args: { "p_actor": string,"p_order_id": string }; Returns: Json
                           },
"confirm_preorder":
{ Args: { "p_actor": string,"p_notes"?: string,"p_order_id": string }; Returns: Json
                           },
"create_preorder":
{ Args: { "p_customer_name": string,"p_email": string,"p_idempotency_key": string,"p_items": Json,"p_phone": string,"p_pickup_at": string,"p_tracking_code_hash": string,"p_tracking_code_salt": number }; Returns: Json
                           },
"create_walkin_order":
{ Args: { "p_actor": string,"p_customer_name": string,"p_idempotency_key": string,"p_items": Json,"p_payment_method": string }; Returns: Json
                           },
"dashboard_metrics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"enqueue_preorder":
{ Args: { "p_actor": string,"p_order_id": string }; Returns: Json
                           },
"mark_ready":
{ Args: { "p_actor": string,"p_order_id": string }; Returns: Json
                           },
"next_order_code":
{ Args: { "p_type": string }; Returns: string
                           },
"prioritize_queue_order":
{ Args: { "p_actor": string,"p_order_id": string }; Returns: Json
                           },
"promote_next_queued":
{ Args: { "p_actor"?: string }; Returns: Json
                           },
"record_manual_payment":
{ Args: { "p_actor": string,"p_order_id": string,"p_payment_method": string }; Returns: Json
                           },
"reject_preorder":
{ Args: { "p_actor": string,"p_order_id": string,"p_reason": string }; Returns: Json
                           },
"report_best_sellers":
{ Args: { "p_from": string,"p_limit"?: number,"p_to": string }; Returns: {
              "product_name": string,"quantity": number,"revenue": number
            }[]
                           },
"report_cashiers":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "cash_transactions": number,"cashier_id": string,"cashier_name": string,"profit": number,"qris_transactions": number,"revenue": number,"transactions": number
            }[]
                           },
"report_sales":
{ Args: { "p_from": string,"p_group"?: string,"p_to": string }; Returns: {
              "bucket": string,"profit": number,"revenue": number,"transactions": number
            }[]
                           },
"report_transactions":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "amount": number,"cashier_id": string,"cashier_name": string,"customer_name": string,"order_code": string,"order_type": string,"paid_at": string,"payment_method": string,"profit": number
            }[]
                           },
"resolve_order_items":
{ Args: { "p_items": Json }; Returns: {
              "product_id": string,"product_name": string,"quantity": number,"subtotal": number,"unit_price": number
            }[]
                           },
"start_preparing":
{ Args: { "p_actor": string,"p_order_id": string }; Returns: Json
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
