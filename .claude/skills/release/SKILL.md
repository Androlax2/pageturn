---
name: release
description: Use when preparing a pageturn release, writing a changeset, or asked about versioning, the changelog or publishing to npm. Explains the Changesets flow and the checks; never publishes.
---

# Releasing pageturn

pageturn is released by Changesets and GitHub Actions. **Never run `npm publish`,
`pnpm publish` or `changeset publish` yourself**, and do not push or tag unless asked.

## The flow

1. Each change users will notice has a changeset: `pnpm changeset`, or a file in
   `.changeset/` like

   ```md
   ---
   "pageturn": patch
   ---

   A morph defined from a classic script in the head now lands on the page reached.
   ```

   `patch` for a fix, `minor` for a feature or a breaking change while the version is
   0.x. Written for users: what they see, not how the code changed.
2. On `main`, `.github/workflows/release.yml` opens or updates a "Version Packages" pull
   request: the version bumped, `CHANGELOG.md` written from the changesets.
3. Before it is merged, the release checklist is done by hand on the packed version
   (`pnpm pack`): `docs/release-checklist.md`.
4. Merging it makes `main` a release: the workflow publishes the version with
   `npm publish` (`pnpm run release`) if npm has not got it, through npm's Trusted
   Publishing (no token), with provenance; then it creates the tag `pageturn@<version>`
   and the GitHub release from that version's section of `CHANGELOG.md`.

## Checks to run when preparing one

```sh
pnpm run check && pnpm run size && pnpm run lint:package && pnpm run test
pnpm changeset status          # which changesets are pending
pnpm pack                      # the tarball users would get; look at its file list
```

`lint:package` runs `attw --pack`, which needs a writable npm cache
(`npm_config_cache=<a writable folder>` if `~/.npm` is read-only).
