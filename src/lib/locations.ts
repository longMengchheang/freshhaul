export const LOCATION_BY_COUNTRY = {
  Cambodia: [
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
  ],
  Thailand: [
    "Bangkok",
    "Chiang Mai",
    "Chiang Rai",
    "Chonburi",
    "Nakhon Ratchasima",
    "Rayong",
    "Sa Kaeo",
    "Trat",
    "Ubon Ratchathani",
    "Surin",
  ],
  Vietnam: [
    "An Giang",
    "Can Tho",
    "Dong Nai",
    "Hai Phong",
    "Hanoi",
    "Ho Chi Minh City",
    "Khanh Hoa",
    "Long An",
    "Quang Ninh",
    "Tay Ninh",
  ],
  Laos: [
    "Attapeu",
    "Bokeo",
    "Champasak",
    "Khammouane",
    "Luang Prabang",
    "Savannakhet",
    "Vientiane",
    "Xayaboury",
  ],
} as const;

export type SupportedCountry = keyof typeof LOCATION_BY_COUNTRY;
export type SupportedCountryCode = "KH" | "TH" | "VN" | "LA";

export const COUNTRY_OPTIONS = Object.keys(LOCATION_BY_COUNTRY) as SupportedCountry[];
export const DEFAULT_COUNTRY: SupportedCountry = "Cambodia";
export const DEFAULT_COUNTRY_CODE: SupportedCountryCode = "KH";

const COUNTRY_CODE_BY_NAME: Record<SupportedCountry, SupportedCountryCode> = {
  Cambodia: "KH",
  Thailand: "TH",
  Vietnam: "VN",
  Laos: "LA",
};

const COUNTRY_NAME_BY_CODE: Record<SupportedCountryCode, SupportedCountry> = {
  KH: "Cambodia",
  TH: "Thailand",
  VN: "Vietnam",
  LA: "Laos",
};

export function getProvincesForCountry(country: string): readonly string[] {
  return LOCATION_BY_COUNTRY[country as SupportedCountry] ?? LOCATION_BY_COUNTRY[DEFAULT_COUNTRY];
}

export function getCountryCode(countryName: string): SupportedCountryCode {
  return COUNTRY_CODE_BY_NAME[countryName as SupportedCountry] ?? DEFAULT_COUNTRY_CODE;
}

export function getCountryName(countryCode: string): SupportedCountry {
  return COUNTRY_NAME_BY_CODE[countryCode as SupportedCountryCode] ?? DEFAULT_COUNTRY;
}
