// Shop-wide basis for quoting third-party designs (owner decision, 2026-10-12).
//
// BaSa3D quotes MakerWorld models as a personal print-on-request service ("in giúp cá nhân"),
// not as resale of the design. So a design whose license forbids commercial use (MakerWorld's default
// "Standard Digital File License", CC *-NC) does NOT block a quote: the admin panel records this
// policy as the basis on the quote snapshot (`licenseAcknowledged: true` + `licenseBasis`) instead of
// asking staff to tick a box every time. The server still requires the basis to be present on such
// snapshots (schemas.ts), so every quote of a restricted design carries an auditable reason.
//
// If the shop's business model changes (e.g. selling printed copies from stock), change this policy
// — do not just remove the schema check.

export const PRINT_SERVICE_LICENSE_BASES = ['PERSONAL_NON_COMMERCIAL'] as const;
export type PrintServiceLicenseBasis = (typeof PRINT_SERVICE_LICENSE_BASES)[number];

export const PRINT_SERVICE_POLICY = {
  licenseBasis: 'PERSONAL_NON_COMMERCIAL' as PrintServiceLicenseBasis,
  label: 'In giúp cá nhân theo yêu cầu, phi thương mại',
} as const;
