// Main-site tracking remains disabled pending an approved dataset mapping.
// The existing Reels dataset must not be assumed suitable for Core/Agency.
// Before publishing, verify automatic advanced matching and automatic events
// are OFF in the chosen dataset's Meta Events Manager settings. This code adds
// no CAPI integration or customer matching data.
export const MARKETING_PIXEL_CONFIG = Object.freeze({
  enabled: false,
  pixelId: '',
});

// Separate from the opt-out settings used by Connect and Reels.
export const MARKETING_CONSENT_KEY = 'hubber-main:marketing-consent:v1';
export const MARKETING_LEAD_KEY_PREFIX = 'hubber-main:marketing-lead:v1:';
