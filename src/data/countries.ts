import { Country } from '../types';

export interface CountryWithContinent extends Country {
    continent: string;
}

export const ALL_COUNTRIES: CountryWithContinent[] = [
    // NORTH AMERICA
    { name: "United States", code: "US", flag: "🇺🇸", continent: "NORTH_AMERICA" },
    { name: "Canada", code: "CA", flag: "🇨🇦", continent: "NORTH_AMERICA" },
    { name: "Mexico", code: "MX", flag: "🇲🇽", continent: "NORTH_AMERICA" },

    // EUROPE
    { name: "United Kingdom", code: "GB", flag: "🇬🇧", continent: "EUROPE" },
    { name: "Germany", code: "DE", flag: "🇩🇪", continent: "EUROPE" },
    { name: "France", code: "FR", flag: "🇫🇷", continent: "EUROPE" },
    { name: "Italy", code: "IT", flag: "🇮🇹", continent: "EUROPE" },
    { name: "Spain", code: "ES", flag: "🇪🇸", continent: "EUROPE" },
    { name: "Netherlands", code: "NL", flag: "🇳🇱", continent: "EUROPE" },
    { name: "Sweden", code: "SE", flag: "🇸🇪", continent: "EUROPE" },
    { name: "Switzerland", code: "CH", flag: "🇨🇭", continent: "EUROPE" },
    { name: "Belgium", code: "BE", flag: "🇧🇪", continent: "EUROPE" },
    { name: "Austria", code: "AT", flag: "🇦🇹", continent: "EUROPE" },
    { name: "Norway", code: "NO", flag: "🇳🇴", continent: "EUROPE" },
    { name: "Denmark", code: "DK", flag: "🇩🇰", continent: "EUROPE" },
    { name: "Ireland", code: "IE", flag: "🇮🇪", continent: "EUROPE" },
    { name: "Poland", code: "PL", flag: "🇵🇱", continent: "EUROPE" },
    { name: "Portugal", code: "PT", flag: "🇵🇹", continent: "EUROPE" },
    { name: "Russia", code: "RU", flag: "🇷🇺", continent: "EUROPE" },
    { name: "Turkey", code: "TR", flag: "🇹🇷", continent: "EUROPE" },
    { name: "Ukraine", code: "UA", flag: "🇺🇦", continent: "EUROPE" },

    // ASIA
    { name: "Japan", code: "JP", flag: "🇯🇵", continent: "ASIA" },
    { name: "China", code: "CN", flag: "🇨🇳", continent: "ASIA" },
    { name: "India", code: "IN", flag: "🇮🇳", continent: "ASIA" },
    { name: "South Korea", code: "KR", flag: "🇰🇷", continent: "ASIA" },
    { name: "Singapore", code: "SG", flag: "🇸🇬", continent: "ASIA" },
    { name: "UAE", code: "AE", flag: "🇦🇪", continent: "ASIA" },
    { name: "Saudi Arabia", code: "SA", flag: "🇸🇦", continent: "ASIA" },
    { name: "Israel", code: "IL", flag: "🇮🇱", continent: "ASIA" },
    { name: "Thailand", code: "TH", flag: "🇹🇭", continent: "ASIA" },
    { name: "Vietnam", code: "VN", flag: "🇻🇳", continent: "ASIA" },
    { name: "Indonesia", code: "ID", flag: "🇮🇩", continent: "ASIA" },
    { name: "Malaysia", code: "MY", flag: "🇲🇾", continent: "ASIA" },
    { name: "Philippines", code: "PH", flag: "🇵🇭", continent: "ASIA" },

    // OCEANIA
    { name: "Australia", code: "AU", flag: "🇦🇺", continent: "OCEANIA" },
    { name: "New Zealand", code: "NZ", flag: "🇳🇿", continent: "OCEANIA" },

    // SOUTH AMERICA
    { name: "Brazil", code: "BR", flag: "🇧🇷", continent: "SOUTH_AMERICA" },
    { name: "Argentina", code: "AR", flag: "🇦🇷", continent: "SOUTH_AMERICA" },
    { name: "Chile", code: "CL", flag: "🇨🇱", continent: "SOUTH_AMERICA" },
    { name: "Colombia", code: "CO", flag: "🇨🇴", continent: "SOUTH_AMERICA" },
    { name: "Peru", code: "PE", flag: "🇵🇪", continent: "SOUTH_AMERICA" },

    // AFRICA
    { name: "South Africa", code: "ZA", flag: "🇿🇦", continent: "AFRICA" },
    { name: "Egypt", code: "EG", flag: "🇪🇬", continent: "AFRICA" },
    { name: "Nigeria", code: "NG", flag: "🇳🇬", continent: "AFRICA" },
    { name: "Kenya", code: "KE", flag: "🇰🇪", continent: "AFRICA" },

    // GLOBAL
    { name: "Global / International", code: "GLOBAL", flag: "🌍", continent: "GLOBAL" }
];
