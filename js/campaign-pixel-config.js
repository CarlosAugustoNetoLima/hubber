// Main-site Meta Pixel (opt-in, consent-gated). Reuses the HUBBER REELS dataset
// (ad account HUBBER USA (DOLAR) 1303690145088831): Nicolas authorized sharing
// it with the Reels product on 2026-10-07. The Reels subdomain keeps its own,
// separate installation (partials/meta-pixel.html); this config does not touch it.
// This code sends no customer data, no advanced matching and adds no CAPI.
// Check in Events Manager that automatic advanced matching stays OFF.
export const MARKETING_PIXEL_CONFIG = Object.freeze({
  enabled: true,
  pixelId: '1622410909278763',
});

// Separate from the opt-out settings used by Connect and Reels.
export const MARKETING_CONSENT_KEY = 'hubber-main:marketing-consent:v1';
export const MARKETING_LEAD_KEY_PREFIX = 'hubber-main:marketing-lead:v1:';
