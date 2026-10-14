# Shortcuts to the package's scripts (package.json), which are the commands of record.
# make test PROJECT=firefox runs one browser only.
PROJECT ?=

.PHONY: install build check format test size lint-package clean

install:
	pnpm install

build:
	pnpm run build

check:
	pnpm run check

format:
	pnpm run format

test:
	pnpm run test $(if $(PROJECT),--project=$(PROJECT))

size:
	pnpm run size

lint-package:
	pnpm run lint:package

clean:
	rm -rf dist test-results playwright-report tests/astro/fixture/dist-* tests/astro/fixture/node_modules *.tgz
