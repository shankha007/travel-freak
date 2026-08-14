export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      albums: {
        Row: {
          cover_media_id: string | null
          created_at: string
          id: string
          order_index: number
          title: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_media_id?: string | null
          created_at?: string
          id?: string
          order_index?: number
          title: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_media_id?: string | null
          created_at?: string
          id?: string
          order_index?: number
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_cover_media_fk"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          content_html: string
          content_json: Json
          cover_media_id: string | null
          created_at: string
          deleted_at: string | null
          excerpt: string
          id: string
          published_at: string | null
          reading_minutes: number
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          slug: string
          theme: string
          title: string
          trip_id: string | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          content_html?: string
          content_json?: Json
          cover_media_id?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string
          id?: string
          published_at?: string | null
          reading_minutes?: number
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          theme?: string
          title: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          content_html?: string
          content_json?: Json
          cover_media_id?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string
          id?: string
          published_at?: string | null
          reading_minutes?: number
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          theme?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled_at: string | null
          id: string
          message: string
          name: string
          source_path: string | null
          topic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled_at?: string | null
          id?: string
          message: string
          name: string
          source_path?: string | null
          topic: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled_at?: string | null
          id?: string
          message?: string
          name?: string
          source_path?: string | null
          topic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      media: {
        Row: {
          album_id: string | null
          alt_text: string
          blurhash: string | null
          bytes: number
          caption: string
          created_at: string
          deleted_at: string | null
          duration_s: number | null
          exif_lat: number | null
          exif_lng: number | null
          height: number | null
          id: string
          is_featured: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          mime: string
          processing_status: Database["public"]["Enums"]["processing_status"]
          public_path: string | null
          storage_path: string
          taken_at: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          album_id?: string | null
          alt_text?: string
          blurhash?: string | null
          bytes?: number
          caption?: string
          created_at?: string
          deleted_at?: string | null
          duration_s?: number | null
          exif_lat?: number | null
          exif_lng?: number | null
          height?: number | null
          id?: string
          is_featured?: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          mime: string
          processing_status?: Database["public"]["Enums"]["processing_status"]
          public_path?: string | null
          storage_path: string
          taken_at?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          album_id?: string | null
          alt_text?: string
          blurhash?: string | null
          bytes?: number
          caption?: string
          created_at?: string
          deleted_at?: string | null
          duration_s?: number | null
          exif_lat?: number | null
          exif_lng?: number | null
          height?: number | null
          id?: string
          is_featured?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          mime?: string
          processing_status?: Database["public"]["Enums"]["processing_status"]
          public_path?: string | null
          storage_path?: string
          taken_at?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          body: string
          created_at: string
          happened_at: string | null
          id: string
          kind: Database["public"]["Enums"]["memory_kind"]
          media_id: string | null
          order_index: number
          trip_id: string
          trip_place_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          happened_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["memory_kind"]
          media_id?: string | null
          order_index?: number
          trip_id: string
          trip_place_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          happened_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["memory_kind"]
          media_id?: string | null
          order_index?: number
          trip_id?: string
          trip_place_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_trip_place_id_fkey"
            columns: ["trip_place_id"]
            isOneToOne: false
            referencedRelation: "trip_places"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          limits: Json
          name: string
          price_inr: number
          price_inr_yearly: number
          price_usd: number
          price_usd_yearly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          limits?: Json
          name: string
          price_inr?: number
          price_inr_yearly?: number
          price_usd?: number
          price_usd_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_inr?: number
          price_inr_yearly?: number
          price_usd?: number
          price_usd_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          city: string | null
          country_code: string | null
          created_at: string
          default_trip_visibility: Database["public"]["Enums"]["visibility"]
          display_name: string
          fuzz_home_location: boolean
          id: string
          is_public: boolean
          onboarded_at: string | null
          social_links: Json
          strip_exif_on_publish: boolean
          travel_interests: string[]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          default_trip_visibility?: Database["public"]["Enums"]["visibility"]
          display_name?: string
          fuzz_home_location?: boolean
          id: string
          is_public?: boolean
          onboarded_at?: string | null
          social_links?: Json
          strip_exif_on_publish?: boolean
          travel_interests?: string[]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          default_trip_visibility?: Database["public"]["Enums"]["visibility"]
          display_name?: string
          fuzz_home_location?: boolean
          id?: string
          is_public?: boolean
          onboarded_at?: string | null
          social_links?: Json
          strip_exif_on_publish?: boolean
          travel_interests?: string[]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      share_links: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          post_id: string | null
          revoked_at: string | null
          token: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          post_id?: string | null
          revoked_at?: string | null
          token?: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          post_id?: string | null
          revoked_at?: string | null
          token?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          over_quota_since: string | null
          plan_code: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          over_quota_since?: string | null
          plan_code: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          over_quota_since?: string | null
          plan_code?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      trip_collaborators: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          role: Database["public"]["Enums"]["collaborator_role"]
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: Database["public"]["Enums"]["collaborator_role"]
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: Database["public"]["Enums"]["collaborator_role"]
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_collaborators_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_places: {
        Row: {
          arrival_date: string | null
          city_name: string | null
          country_code: string
          created_at: string
          departure_date: string | null
          id: string
          latitude: number | null
          location: unknown
          longitude: number | null
          notes: string
          order_index: number
          place_kind: Database["public"]["Enums"]["place_kind"]
          region_code: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arrival_date?: string | null
          city_name?: string | null
          country_code: string
          created_at?: string
          departure_date?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          notes?: string
          order_index?: number
          place_kind?: Database["public"]["Enums"]["place_kind"]
          region_code?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arrival_date?: string | null
          city_name?: string | null
          country_code?: string
          created_at?: string
          departure_date?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          notes?: string
          order_index?: number
          place_kind?: Database["public"]["Enums"]["place_kind"]
          region_code?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_places_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          audio_count: number
          budget_planned: number | null
          cover_media_id: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          end_date: string | null
          id: string
          media_bytes: number
          photo_count: number
          published_at: string | null
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          summary: string
          title: string
          traveler_count: number
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          updated_at: string
          user_id: string
          video_count: number
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          audio_count?: number
          budget_planned?: number | null
          cover_media_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          media_bytes?: number
          photo_count?: number
          published_at?: string | null
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          summary?: string
          title: string
          traveler_count?: number
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
          user_id: string
          video_count?: number
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          audio_count?: number
          budget_planned?: number | null
          cover_media_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          media_bytes?: number
          photo_count?: number
          published_at?: string | null
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          summary?: string
          title?: string
          traveler_count?: number
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
          user_id?: string
          video_count?: number
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "trips_cover_media_fk"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          ai_calls_used: number
          period_start: string
          storage_bytes: number
          trips_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_calls_used?: number
          period_start?: string
          storage_bytes?: number
          trips_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_calls_used?: number
          period_start?: string
          storage_bytes?: number
          trips_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      visited_countries: {
        Row: {
          country_code: string
          created_at: string
          region_code: string
          user_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          region_code?: string
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          region_code?: string
          user_id?: string
        }
        Relationships: []
      }
      visited_regions: {
        Row: {
          city_names: string[]
          country_code: string
          featured_media_id: string | null
          first_visit: string | null
          last_visit: string | null
          region_code: string
          state: Database["public"]["Enums"]["region_state"]
          trip_ids: string[]
          updated_at: string
          user_id: string
          visit_count: number
          visit_trip_ids: string[]
        }
        Insert: {
          city_names?: string[]
          country_code: string
          featured_media_id?: string | null
          first_visit?: string | null
          last_visit?: string | null
          region_code?: string
          state?: Database["public"]["Enums"]["region_state"]
          trip_ids?: string[]
          updated_at?: string
          user_id: string
          visit_count?: number
          visit_trip_ids?: string[]
        }
        Update: {
          city_names?: string[]
          country_code?: string
          featured_media_id?: string | null
          first_visit?: string | null
          last_visit?: string | null
          region_code?: string
          state?: Database["public"]["Enums"]["region_state"]
          trip_ids?: string[]
          updated_at?: string
          user_id?: string
          visit_count?: number
          visit_trip_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "visited_regions_featured_media_id_fkey"
            columns: ["featured_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          best_season: string | null
          country_code: string
          created_at: string
          currency: string
          est_budget: number | null
          id: string
          notes: string
          priority: number
          region_code: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          best_season?: string | null
          country_code: string
          created_at?: string
          currency?: string
          est_budget?: number | null
          id?: string
          notes?: string
          priority?: number
          region_code?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          best_season?: string | null
          country_code?: string
          created_at?: string
          currency?: string
          est_budget?: number | null
          id?: string
          notes?: string
          priority?: number
          region_code?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      can_edit_trip: { Args: { p_trip_id: string }; Returns: boolean }
      can_read_trip: { Args: { p_trip_id: string }; Returns: boolean }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      is_trip_collaborator: { Args: { p_trip_id: string }; Returns: boolean }
      list_deleted_trips: {
        Args: never
        Returns: {
          deleted_at: string
          end_date: string
          id: string
          photo_count: number
          place_count: number
          post_count: number
          slug: string
          start_date: string
          summary: string
          title: string
          visibility: Database["public"]["Enums"]["visibility"]
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      post_shows_branding_badge: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      public_place_counts: {
        Args: { p_user_id: string }
        Returns: {
          place_count: number
          place_kind: string
        }[]
      }
      public_resume_stats: {
        Args: { p_user_id: string }
        Returns: {
          first_trip: string
          latest_trip: string
          travel_days: number
          trips_count: number
          years_travelling: number
        }[]
      }
      refresh_visited_regions: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      resolve_post_share_link: { Args: { p_token: string }; Returns: string }
      resolve_share_link: { Args: { p_token: string }; Returns: string }
      restore_trip: { Args: { p_trip_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      shows_branding_badge: { Args: { p_user_id: string }; Returns: boolean }
      soft_delete_media: { Args: { p_media_id: string }; Returns: boolean }
      soft_delete_trip: { Args: { p_trip_id: string }; Returns: boolean }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      submit_contact_message: {
        Args: {
          p_email: string
          p_message: string
          p_name: string
          p_source_path?: string
          p_topic: string
        }
        Returns: string
      }
      trip_shows_branding_badge: {
        Args: { p_trip_id: string }
        Returns: boolean
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      collaborator_role: "owner" | "editor" | "viewer"
      media_kind: "image" | "video" | "audio"
      memory_kind:
        | "note"
        | "photo"
        | "audio"
        | "video"
        | "quote"
        | "favorite_location"
      place_kind:
        | "city"
        | "mountain"
        | "beach"
        | "forest"
        | "unesco"
        | "national_park"
        | "other"
      processing_status: "pending" | "processing" | "ready" | "failed"
      region_state: "visited" | "current" | "planned" | "unvisited"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "expired"
      trip_status: "planning" | "upcoming" | "ongoing" | "completed"
      trip_type: "solo" | "couple" | "friends" | "family" | "business"
      visibility: "private" | "unlisted" | "public"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      collaborator_role: ["owner", "editor", "viewer"],
      media_kind: ["image", "video", "audio"],
      memory_kind: [
        "note",
        "photo",
        "audio",
        "video",
        "quote",
        "favorite_location",
      ],
      place_kind: [
        "city",
        "mountain",
        "beach",
        "forest",
        "unesco",
        "national_park",
        "other",
      ],
      processing_status: ["pending", "processing", "ready", "failed"],
      region_state: ["visited", "current", "planned", "unvisited"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "expired",
      ],
      trip_status: ["planning", "upcoming", "ongoing", "completed"],
      trip_type: ["solo", "couple", "friends", "family", "business"],
      visibility: ["private", "unlisted", "public"],
    },
  },
} as const

