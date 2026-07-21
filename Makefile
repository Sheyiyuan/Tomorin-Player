SHELL := /bin/bash
.DEFAULT_GOAL := help

GO ?= go
NODE ?= node
PNPM ?= pnpm
POWERSHELL ?= powershell
VERSION ?= $(if $(APP_VERSION),$(APP_VERSION),$(shell $(NODE) -p "require('./frontend/package.json').version"))
CLEAN ?= 1
ARTIFACT_ROOT ?= build
WAILS_ARGS ?=

FRONTEND_DIR := frontend
WAILS_RUNNER := bash scripts/wails.sh
CLEAN_FLAG := $(if $(filter 1 true yes,$(CLEAN)),-c,)
WAILS_CLEAN_FLAG := $(if $(filter 1 true yes,$(CLEAN)),-clean,)
WINDOWS_PS_CLEAN_FLAG := $(if $(filter 1 true yes,$(CLEAN)),-Clean,)
UNAME_S := $(shell uname -s 2>/dev/null || printf 'Windows')

.PHONY: help install test test-go test-frontend vet typecheck lint frontend-build \
	check dev bindings build package package-deb package-rpm package-linux \
	package-windows package-macos verify-app-icon verify-linux-packages clean

help: ## Show available targets
	@printf '%s\n' \
		'Half Beat Player development commands' \
		'' \
		'  make install                 Install locked frontend dependencies' \
		'  make test                    Run Go and frontend tests' \
		'  make check                   Run the complete quality gate' \
		'  make dev                     Start Wails development mode' \
		'  make bindings                Regenerate Wails bindings' \
		'  make build                   Build the current platform' \
		'  make package                 Package for the current host platform' \
		'  make package-linux           Build DEB and RPM packages once' \
		'  make package-deb             Build a Debian package' \
		'  make package-rpm             Build an RPM package' \
		'  make package-windows         Build Windows executable and NSIS installer' \
		'  make package-macos           Build macOS universal app and DMG' \
		'  make verify-app-icon         Verify the canonical Wails icon source' \
		'  make verify-linux-packages   Verify DEB/RPM installation with Docker' \
		'  make clean                   Remove generated build output' \
		'' \
		'Variables:' \
		'  VERSION=x.y.z               Override package version' \
		'  CLEAN=0                     Reuse existing Wails build output' \
		'  WAILS_CMD=/path/to/wails    Override the Wails executable' \
		'  WAILS_ARGS="..."            Append arguments to Wails dev/build'

install: ## Install frontend dependencies from the lockfile
	$(PNPM) --dir $(FRONTEND_DIR) install --frozen-lockfile

test: verify-app-icon test-go test-frontend ## Run all automated tests

test-go:
	$(GO) test ./...

test-frontend:
	$(PNPM) --dir $(FRONTEND_DIR) run test

vet:
	$(GO) vet ./...

typecheck:
	$(PNPM) --dir $(FRONTEND_DIR) run typecheck

lint:
	$(PNPM) --dir $(FRONTEND_DIR) run lint

frontend-build:
	$(PNPM) --dir $(FRONTEND_DIR) run build

check: verify-app-icon ## Run tests, static analysis, typechecking, lint, and frontend build
	$(PNPM) --dir $(FRONTEND_DIR) run typecheck
	$(PNPM) --dir $(FRONTEND_DIR) run lint
	$(PNPM) --dir $(FRONTEND_DIR) run test
	$(PNPM) --dir $(FRONTEND_DIR) run build
	$(GO) test ./...
	$(GO) vet ./...

dev: verify-app-icon ## Start Wails development mode
	$(WAILS_RUNNER) dev $(WAILS_ARGS)

bindings: ## Regenerate frontend bindings from exported Go methods
	$(WAILS_RUNNER) generate module

build: verify-app-icon ## Build the application for the current platform
	APP_VERSION="$(VERSION)" VITE_APP_VERSION="$(VERSION)" \
		$(WAILS_RUNNER) build $(WAILS_CLEAN_FLAG) $(WAILS_ARGS)

package: ## Package for the current host platform
	@case "$(UNAME_S)" in \
		Linux) $(MAKE) package-linux ;; \
		Darwin) $(MAKE) package-macos ;; \
		MINGW*|MSYS*|CYGWIN*|Windows*) $(MAKE) package-windows ;; \
		*) printf 'Unsupported host platform: %s\n' "$(UNAME_S)" >&2; exit 1 ;; \
	esac

package-deb: ## Build a Debian package
	APP_VERSION="$(VERSION)" bash scripts/build-deb.sh

package-rpm: ## Build an RPM package
	APP_VERSION="$(VERSION)" bash scripts/build-rpm.sh

package-linux: ## Build DEB and RPM packages while compiling the app once
	APP_VERSION="$(VERSION)" bash scripts/build-deb.sh
	APP_VERSION="$(VERSION)" SKIP_APP_BUILD=1 bash scripts/build-rpm.sh

package-windows: ## Build Windows executable and NSIS installer
ifeq ($(OS),Windows_NT)
	APP_VERSION="$(VERSION)" $(POWERSHELL) -NoProfile -ExecutionPolicy Bypass \
		-File scripts/windows/build-windows.ps1 $(WINDOWS_PS_CLEAN_FLAG) -NSIS
else
	APP_VERSION="$(VERSION)" bash scripts/windows/build-windows.sh $(CLEAN_FLAG)
endif

package-macos: ## Build a universal macOS app and DMG
	APP_VERSION="$(VERSION)" bash scripts/build-macos.sh $(CLEAN_FLAG)

verify-app-icon: ## Verify build/appicon.png before Wails reads it
	$(GO) run ./scripts/verify-app-icon

verify-linux-packages: ## Install and remove DEB/RPM packages in clean containers
	bash scripts/verify-linux-packages.sh "$(ARTIFACT_ROOT)"

clean: ## Remove generated build output
	rm -rf build/bin build/darwin build/windows build/deb build/rpm \
		frontend/dist frontend/package.json.md5 wails.json.tmp wails.json.bak
