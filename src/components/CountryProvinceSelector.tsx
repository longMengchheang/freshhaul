'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRY_OPTIONS, getProvincesForCountry } from '@/lib/locations';

interface CountryProvinceSelectorProps {
  country: string;
  province: string;
  countryLabel?: string;
  provinceLabel?: string;
  countryPlaceholder?: string;
  provincePlaceholder?: string;
  size?: 'sm' | 'md';
  onCountryChange: (nextCountry: string) => void;
  onProvinceChange: (nextProvince: string) => void;
}

export default function CountryProvinceSelector({
  country,
  province,
  countryLabel = 'Country',
  provinceLabel = 'Province',
  countryPlaceholder = 'Choose country',
  provincePlaceholder = 'Choose province',
  size = 'md',
  onCountryChange,
  onProvinceChange,
}: CountryProvinceSelectorProps) {
  const provinceOptions = getProvincesForCountry(country);
  const triggerHeightClass = size === 'sm' ? 'h-11' : 'h-12';

  const handleCountryChange = (nextCountry: string) => {
    onCountryChange(nextCountry);
    const nextProvinceOptions = getProvincesForCountry(nextCountry);
    if (province && !nextProvinceOptions.includes(province)) {
      onProvinceChange('');
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>{countryLabel}</Label>
        <Select value={country} onValueChange={(value) => value && handleCountryChange(value)}>
          <SelectTrigger className={`${triggerHeightClass} bg-white text-base`}>
            <SelectValue placeholder={countryPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_OPTIONS.map((countryName) => (
              <SelectItem key={countryName} value={countryName}>
                {countryName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{provinceLabel}</Label>
        <Select value={province} onValueChange={(value) => value && onProvinceChange(value)}>
          <SelectTrigger className={`${triggerHeightClass} bg-white text-base`}>
            <SelectValue placeholder={provincePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {provinceOptions.map((provinceName) => (
              <SelectItem key={provinceName} value={provinceName}>
                {provinceName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
