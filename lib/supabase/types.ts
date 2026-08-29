/**
 * Hand-maintained database types.
 *
 * Regenerate against a live project with:
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 * Until then this file is the contract; keep it in step with
 * supabase/migrations/.
 */

export type MemberRole = 'owner' | 'member' | 'viewer'
export type ItemStatus = 'active' | 'in_transit' | 'archived'
export type ItemCondition = 'new' | 'excellent' | 'good' | 'fair' | 'worn'
export type BundleKind = 'outfit' | 'kit' | 'bin'
export type PackingStatus = 'draft' | 'active' | 'done' | 'cancelled'
export type ReminderKind = 'warranty' | 'expiry' | 'service'

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[]

export type HouseholdRow = {
  id: string
  name: string
  created_at: string
}

export type HouseholdMemberRow = {
  id: string
  household_id: string
  user_id: string
  role: MemberRole
  display_name: string
  avatar_emoji: string
  created_at: string
}

export type AllowedEmailRow = {
  id: string
  email: string
  household_id: string
  role: MemberRole
  display_name: string | null
  invited_by: string | null
  redeemed_at: string | null
  created_at: string
}

export type LocationRow = {
  id: string
  household_id: string
  name: string
  emoji: string
  color: string
  address: string | null
  lat: number | null
  lng: number | null
  radius_m: number
  notes: string | null
  is_default: boolean
  sort_order: number
  created_at: string
}

export type CategoryRow = {
  id: string
  household_id: string
  slug: string
  label: string
  icon: string
  attribute_schema: Json
  is_private: boolean
  sort_order: number
  created_at: string
}

export type ItemRow = {
  id: string
  household_id: string
  name: string
  category_id: string | null
  location_id: string | null
  owner_member_id: string | null
  quantity: number
  attributes: Record<string, string | number | string[]>
  condition: ItemCondition | null
  purchase_date: string | null
  purchase_price: number | null
  currency: string
  est_value: number | null
  warranty_ends_at: string | null
  expires_at: string | null
  status: ItemStatus
  is_private: boolean
  is_pinned: boolean
  notes: string | null
  ai_confidence: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ItemPhotoRow = {
  id: string
  household_id: string
  item_id: string
  storage_path: string
  is_primary: boolean
  width: number | null
  height: number | null
  taken_at: string | null
  exif_lat: number | null
  exif_lng: number | null
  created_at: string
}

export type ItemMovementRow = {
  id: string
  household_id: string
  item_id: string
  from_location_id: string | null
  to_location_id: string | null
  moved_by: string | null
  reason: string | null
  packing_list_id: string | null
  created_at: string
}

export type BundleRow = {
  id: string
  household_id: string
  name: string
  kind: BundleKind
  emoji: string
  location_id: string | null
  qr_slug: string | null
  notes: string | null
  created_at: string
}

export type BundleItemRow = {
  bundle_id: string
  item_id: string
}

export type PackingListRow = {
  id: string
  household_id: string
  title: string
  status: PackingStatus
  origin_location_id: string | null
  target_location_id: string | null
  depart_on: string | null
  generated_by: string
  rationale: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export type PackingListItemRow = {
  id: string
  household_id: string
  packing_list_id: string
  item_id: string
  to_location_id: string | null
  reason: string | null
  checked: boolean
  checked_at: string | null
}

export type ChatThreadRow = {
  id: string
  household_id: string
  title: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ChatMessageRow = {
  id: string
  household_id: string
  thread_id: string
  role: 'user' | 'assistant'
  content: Json
  created_at: string
}

export type ReminderRow = {
  id: string
  household_id: string
  item_id: string
  kind: ReminderKind
  due_on: string
  dismissed_at: string | null
  created_at: string
}

/**
 * Row -> the {Row, Insert, Update} triple supabase-js expects.
 *
 * `Required` lists only the columns an insert must actually supply. Everything
 * else is optional because the database fills it: a generated id, a default, or
 * a nullable column. That cannot be derived from the Row type alone — `name:
 * string` and `quantity: number` look identical from here, but one has a
 * default and one does not.
 */
type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Row>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      households: Table<HouseholdRow, 'name'>
      household_members: Table<
        HouseholdMemberRow,
        'household_id' | 'user_id' | 'display_name'
      >
      allowed_emails: Table<AllowedEmailRow, 'email' | 'household_id'>
      locations: Table<LocationRow, 'household_id' | 'name'>
      categories: Table<CategoryRow, 'household_id' | 'slug' | 'label'>
      items: Table<ItemRow, 'household_id' | 'name'>
      item_photos: Table<ItemPhotoRow, 'household_id' | 'item_id' | 'storage_path'>
      item_movements: Table<ItemMovementRow, 'household_id' | 'item_id'>
      bundles: Table<BundleRow, 'household_id' | 'name'>
      bundle_items: Table<BundleItemRow, 'bundle_id' | 'item_id'>
      packing_lists: Table<PackingListRow, 'household_id' | 'title'>
      packing_list_items: Table<
        PackingListItemRow,
        'household_id' | 'packing_list_id' | 'item_id'
      >
      chat_threads: Table<ChatThreadRow, 'household_id'>
      chat_messages: Table<
        ChatMessageRow,
        'household_id' | 'thread_id' | 'role' | 'content'
      >
      reminders: Table<ReminderRow, 'household_id' | 'item_id' | 'kind' | 'due_on'>
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      member_role: MemberRole
      item_status: ItemStatus
      item_condition: ItemCondition
      bundle_kind: BundleKind
      packing_status: PackingStatus
      reminder_kind: ReminderKind
    }
    CompositeTypes: { [_ in never]: never }
  }
}

/** Convenience shapes used across the UI. */
export type ItemWithRelations = ItemRow & {
  category: Pick<CategoryRow, 'id' | 'slug' | 'label' | 'icon'> | null
  location: Pick<LocationRow, 'id' | 'name' | 'emoji' | 'color'> | null
  photos: Pick<ItemPhotoRow, 'id' | 'storage_path' | 'is_primary'>[]
}
