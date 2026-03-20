export const CAMBODIAN_PROVINCES = [
  "Phnom Penh",
  "Banteay Meanchey",
  "Battambang",
  "Kampong Cham",
  "Kampong Chhnang",
  "Kampong Speu",
  "Kampong Thom",
  "Kampot",
  "Kandal",
  "Kep",
  "Koh Kong",
  "Kratie",
  "Mondulkiri",
  "Oddar Meanchey",
  "Pailin",
  "Preah Sihanouk",
  "Preah Vihear",
  "Pursat",
  "Prey Veng",
  "Ratanakiri",
  "Siem Reap",
  "Stung Treng",
  "Svay Rieng",
  "Takeo",
  "Tbong Khmum",
] as const;

export const PRODUCE_TYPES = [
  "Mango",
  "Durian",
  "Longan",
  "Dragon fruit",
  "Banana",
  "Pineapple",
  "Cassava leaves",
  "Fresh vegetables",
  "Seafood",
  "Chicken",
] as const;

export const TRUCK_TYPES = [
  "motor_trike",
  "pickup_reefer",
  "small_reefer_van",
  "medium_reefer_truck",
  "large_reefer_truck",
] as const;

export const TRUCK_TYPE_LABELS: Record<(typeof TRUCK_TYPES)[number], string> = {
  motor_trike: "Motor trike",
  pickup_reefer: "Pickup truck with cooling",
  small_reefer_van: "Small cold van",
  medium_reefer_truck: "Medium cold truck",
  large_reefer_truck: "Large cold truck",
};

export const TEMP_OPTIONS = [
  "ambient",
  "chill",
  "frozen",
] as const;

export const TEMP_OPTION_LABELS: Record<(typeof TEMP_OPTIONS)[number], string> = {
  ambient: "No cooling needed",
  chill: "Keep cool",
  frozen: "Keep frozen",
};
