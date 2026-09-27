# LAO-EMS Versioning

Current version: **v0.1.0**

LAO-EMS follows Semantic Versioning: `MAJOR.MINOR.PATCH`.

- PATCH: fixes, UI/text changes, refactoring, small compatible changes.
- MINOR: new features/modules/workflows or compatible schema capabilities.
- MAJOR: incompatible production changes after v1.0.0.
- While the system is in v0.x development, every merged change must still increment the version; breaking development changes increment MINOR.

## Release checklist

1. Change `lao-ems/VERSION`.
2. Change `APP_VERSION` in `lao-ems/assets/js/version.js`.
3. Update the `?v=` cache key for `app.css` and `app.js` in `lao-ems/index.html`.
4. Use the new version in the PR/release description.
5. The GitHub Actions version check must pass before merge.
