const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9]/g;

export function normalizeProvinceName(value: string) {
  return value.trim().toLowerCase().replace(NON_ALPHANUMERIC_PATTERN, "");
}

export function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase();
}

export function isSameProvince(left: string, right: string) {
  return normalizeProvinceName(left) === normalizeProvinceName(right);
}

export function isSameLocation(
  leftCountryCode: string,
  leftProvince: string,
  rightCountryCode: string,
  rightProvince: string,
) {
  return (
    normalizeCountryCode(leftCountryCode) === normalizeCountryCode(rightCountryCode) &&
    isSameProvince(leftProvince, rightProvince)
  );
}

export function getRouteMatchProfile(input: {
  fromCountryCode: string;
  fromProvince: string;
  toCountryCode: string;
  toProvince: string;
  pickupCountryCode: string;
  pickupProvince: string;
  deliveryCountryCode: string;
  deliveryProvince: string;
}) {
  const fromMatchesPickup = isSameLocation(
    input.fromCountryCode,
    input.fromProvince,
    input.pickupCountryCode,
    input.pickupProvince,
  );
  const toMatchesDelivery = isSameLocation(
    input.toCountryCode,
    input.toProvince,
    input.deliveryCountryCode,
    input.deliveryProvince,
  );

  return {
    exact: fromMatchesPickup && toMatchesDelivery,
    fromMatchesPickup,
    toMatchesDelivery,
  };
}
