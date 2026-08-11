# Releases

ImageLab uses semantic versioning and GitHub Releases on the stable channel.

## Version source

`package.json` is the canonical version source. Build-time code reads it to expose `APP_VERSION`, build commit, and build time. Never hand-edit a version in `app/`, `public/release.json`, or `public/sw.js`.

## Preparing a release

1. Choose the next semantic version:
   - patch: compatible fixes;
   - minor: compatible features;
   - major: intentional breaking changes.
2. Update `package.json` using `npm version <version> --no-git-tag-version` or an equivalent reviewed change.
3. Add concise notes to `CHANGELOG.md` under the version heading.
4. Run:

   ```bash
   npm install --package-lock-only --ignore-scripts
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

5. Merge the verified release commit to `main`.
6. Create and push an annotated tag that exactly matches the package version, for example:

   ```bash
   git tag -a v1.2.0 -m "ImageLab v1.2.0"
   git push origin v1.2.0
   ```

The release workflow checks the tag/package match, runs the verification suite, then creates the GitHub Release using the matching `CHANGELOG.md` section when available.

## Release notes

Release notes should be short and practical. Group user-visible work under headings such as **What's new**, **Fixes**, and **Performance**. Do not claim an improvement without a corresponding shipped change.

## Rollback and hotfixes

For a bad stable release, publish a newer patch release rather than rewriting a public tag. The service worker's versioned cache allows installed clients to keep their currently active shell until they explicitly accept a prepared update.
