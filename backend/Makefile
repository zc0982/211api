.PHONY: build generate test test-unit test-integration test-race-service test-e2e

VERSION ?= $(shell ./scripts/resolve-version.sh)
LDFLAGS ?= -s -w -X main.Version=$(VERSION)

# 带 integration tag 的测试所在的包。integration 与 unit 共享大量无 tag 的
# 测试文件（Go 语义：无 tag 文件在所有 tag 下都编译），若 integration 也跑
# ./... 会把 unit 已经跑过的 4000+ 测试重跑一遍。这里只跑真正含
# integration 用例的包，避免重复。
INTEGRATION_PKGS := ./internal/middleware \
	./internal/pkg/tlsfingerprint \
	./internal/repository \
	./internal/server/routes

build:
	CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -trimpath -o bin/server ./cmd/server

generate:
	go generate ./ent
	go generate ./cmd/server

test:
	go test ./...
	golangci-lint run ./...

test-unit:
	go test -tags=unit ./...

test-race-service:
	go test -tags=unit -race -count=1 ./internal/service

test-integration:
	go test -tags=integration $(INTEGRATION_PKGS)

# 校验 INTEGRATION_PKGS 未漏包：若有新增 integration tag 的包未登记则报错
test-integration-pkgs-check:
	@actual="$$(grep -rl '//go:build.*integration' --include='*_test.go' . \
		| xargs -n1 dirname | sed 's|^\./||' | sort -u | sed 's|^|./|')"; \
	declared="$$(printf '%s\n' $(INTEGRATION_PKGS) | sort -u)"; \
	if [ "$$actual" != "$$declared" ]; then \
		echo "INTEGRATION_PKGS 与实际带 integration tag 的包不一致："; \
		echo "--- Makefile 已登记 ---"; echo "$$declared"; \
		echo "--- 代码中实际存在 ---"; echo "$$actual"; \
		echo "请更新 backend/Makefile 的 INTEGRATION_PKGS"; \
		exit 1; \
	fi; \
	echo "INTEGRATION_PKGS 校验通过"

test-e2e:
	./scripts/e2e-test.sh

test-e2e-local:
	go test -tags=e2e -v -timeout=300s ./internal/integration/...
