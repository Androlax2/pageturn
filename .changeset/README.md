# Changesets

Each change a user will notice comes with a changeset: `pnpm changeset`, pick the bump
(patch for a fix, minor for something new or, before 1.0, anything that breaks), and
write one or two sentences for the changelog, in the words a site's developer would use.

On `main`, the release workflow gathers them into a "Version Packages" pull request that
bumps the version and writes `CHANGELOG.md`. Merging it publishes to npm.
