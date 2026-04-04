// Settings keys stored in the DB/localStorage
export const SETTINGS_KEYS = {
  baseUrl: "ha_base_url",
  accessToken: "ha_access_token",
  /** JSON string[] of entity IDs the user wants visible on the dashboard */
  selectedEntities: "ha_selected_entities",
} as const

// Home Assistant REST API paths (appended to base URL)
export const HA_API = {
  states: "/api/states",
  services: "/api/services",
  config: "/api/config",
} as const

// Entity domain prefixes we care about for the smart home zone
export const SUPPORTED_DOMAINS = [
  "light",
  "switch",
  "fan",
  "climate",
] as const

export type SupportedDomain = (typeof SUPPORTED_DOMAINS)[number]
