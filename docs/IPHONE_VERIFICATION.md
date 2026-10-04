# iPhone Verification (PWA-004)

Standalone mode can only be verified on a real device. Use a production deployment
over HTTPS (service workers need a secure origin; `localhost` on a Mac is not reachable
as a secure origin from the iPhone).

Requirements: iOS/iPadOS 15.4 or later (native `<dialog>`, CSS `:has()`,
`Intl.supportedValuesOf`, `dvh` units, WebGL 2 for the map).

## Install

1. Open the app in Safari, wait for it to load once.
2. Share → "Add to Home Screen". The suggested name is "Travel"; the icon is the teal map pin.
3. Start it from the Home Screen → no Safari toolbar (standalone), teal theme.

## Checklist

- [ ] Status bar area: content is not hidden behind the status bar or the notch.
- [ ] Bottom navigation sits above the home indicator; sheets' buttons are reachable.
- [ ] Every screen has an in-app way back (no browser back button in standalone).
- [ ] Inputs don't zoom the page when focused; date, time and select pickers open natively.
- [ ] Sheets open from the bottom, scroll inside, close via ✕ / backdrop.
- [ ] Reorder buttons, map gestures (pan/zoom) and marker taps work with touch.
- [ ] External links (place website, booking links) open in Safari, not inside the app.
- [ ] Offline: Airplane Mode → start the app from the Home Screen → trips load, edits save;
      the offline note is shown; map shows its fallback message; place search says it needs
      internet.
- [ ] Back online: map tiles and place search work again.
- [ ] Update: deploy a new version → "Update available" appears in the app; "Reload" switches
      to it; trips are unchanged.
- [ ] Settings → Storage shows the persistent storage status.
- [ ] Settings → "Share / Save to Files" saves the backup JSON to Files; "Choose backup file"
      picks it again from Files and restores it.

## Known iOS behaviour

- Data of an installed PWA is separate from Safari's data for the same site.
- iOS may remove website data under storage pressure; export JSON backups regularly (Phase 11).

## Last verification

Not yet verified on a device.
