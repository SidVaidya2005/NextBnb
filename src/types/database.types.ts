// ============================================================================
// GENERATED FILE — do not edit by hand.
//
// Source of truth for every row/enum shape in NextBnb. Regenerate after EVERY
// schema migration via the Supabase MCP `generate_typescript_types` (or
// `npx supabase gen types typescript --project-id mbrcgzpmqhmdfhjqytnq`).
//
// Derive types from here rather than re-declaring columns:
//   type Listing = Database['public']['Tables']['listings']['Row']
// ============================================================================

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blocked_dates: {
        Row: {
          created_at: string
          end_date: string
          id: string
          listing_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          listing_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          listing_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancelled_at: string | null
          check_in: string
          check_out: string
          cleaning_fee: number
          created_at: string
          guest_id: string
          guests_count: number
          id: string
          listing_id: string
          nights: number
          price_per_night: number
          service_fee: number
          status: Database["public"]["Enums"]["booking_status"]
          total: number
        }
        Insert: {
          cancelled_at?: string | null
          check_in: string
          check_out: string
          cleaning_fee?: number
          created_at?: string
          guest_id: string
          guests_count?: number
          id?: string
          listing_id: string
          nights: number
          price_per_night: number
          service_fee: number
          status?: Database["public"]["Enums"]["booking_status"]
          total: number
        }
        Update: {
          cancelled_at?: string | null
          check_in?: string
          check_out?: string
          cleaning_fee?: number
          created_at?: string
          guest_id?: string
          guests_count?: number
          id?: string
          listing_id?: string
          nights?: number
          price_per_night?: number
          service_fee?: number
          status?: Database["public"]["Enums"]["booking_status"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          listing_id: string
          position: number
          public_id: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          listing_id: string
          position?: number
          public_id?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          listing_id?: string
          position?: number
          public_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          amenities: string[]
          bathrooms: number
          bedrooms: number
          beds: number
          check_in_time: string | null
          check_out_time: string | null
          city: string
          cleaning_fee: number
          country: string
          created_at: string
          description: string | null
          host_id: string
          house_rules: string | null
          id: string
          is_published: boolean
          max_guests: number
          min_nights: number
          neighborhood: string | null
          price_per_night: number
          property_type: Database["public"]["Enums"]["property_type"]
          state: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          bathrooms?: number
          bedrooms?: number
          beds?: number
          check_in_time?: string | null
          check_out_time?: string | null
          city: string
          cleaning_fee?: number
          country: string
          created_at?: string
          description?: string | null
          host_id: string
          house_rules?: string | null
          id?: string
          is_published?: boolean
          max_guests: number
          min_nights?: number
          neighborhood?: string | null
          price_per_night: number
          property_type: Database["public"]["Enums"]["property_type"]
          state?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          bathrooms?: number
          bedrooms?: number
          beds?: number
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string
          cleaning_fee?: number
          country?: string
          created_at?: string
          description?: string | null
          host_id?: string
          house_rules?: string | null
          id?: string
          is_published?: boolean
          max_guests?: number
          min_nights?: number
          neighborhood?: string | null
          price_per_night?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          state?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          guest_id: string
          host_id: string
          id: string
          last_message_at: string
          listing_id: string | null
        }
        Insert: {
          created_at?: string
          guest_id: string
          host_id: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
        }
        Update: {
          created_at?: string
          guest_id?: string
          host_id?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_admin: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          listing_id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          listing_id: string
          rating: number
          reviewer_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      booking_status: "confirmed" | "cancelled"
      property_type:
        | "home"
        | "apartment"
        | "villa"
        | "cabin"
        | "cottage"
        | "loft"
        | "guesthouse"
        | "tiny_home"
        | "treehouse"
        | "other"
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
      booking_status: ["confirmed", "cancelled"],
      property_type: [
        "home",
        "apartment",
        "villa",
        "cabin",
        "cottage",
        "loft",
        "guesthouse",
        "tiny_home",
        "treehouse",
        "other",
      ],
    },
  },
} as const
