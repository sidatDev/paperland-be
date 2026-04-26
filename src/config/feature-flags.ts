export const featureFlags = {
  VARIANT_MATRIX_ENABLED: process.env.VARIANT_MATRIX_ENABLED === 'true',
  IMPORT_V2_ENABLED: process.env.IMPORT_V2_ENABLED === 'true',
  GROUPED_INVENTORY_ENABLED: process.env.GROUPED_INVENTORY_ENABLED !== 'false', // default true
  VARIANT_URL_STATE_ENABLED: process.env.VARIANT_URL_STATE_ENABLED === 'true',
};
