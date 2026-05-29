export interface MealHistory {
  id: string
  user_id: string
  restaurant_name: string
  restaurant_id: string | null
  is_custom: boolean
  period: string
  date: string
  created_at: string
}

export interface Blacklist {
  id: string
  user_id: string
  restaurant_name: string
  restaurant_id: string | null
  created_at: string
}

export interface Group {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  nickname: string | null
  joined_at: string
}

export interface UserPrefs {
  user_id: string
  avoid_cats: string[] | null
  dietary_notes: string | null
  updated_at: string
}

export interface CustomRestaurant {
  id: string
  user_id: string
  name: string
  category: string | null
  address: string | null
  location_lat: number | null
  location_lng: number | null
  photo_url: string | null
  notes: string | null
  created_at: string
}
