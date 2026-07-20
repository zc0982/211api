ARG NODE_ACTIONS_BASE_IMAGE=scratch
ARG GO_CI_IMAGE=scratch

FROM ${NODE_ACTIONS_BASE_IMAGE} AS node_runtime
FROM ${GO_CI_IMAGE}

ARG NODE_ACTIONS_BASE_IMAGE
ARG GO_CI_IMAGE
ARG GO_ACTIONS_DOCKERFILE_SHA256

LABEL org.opencontainers.image.title="211API Go Actions job image" \
      org.opencontainers.image.description="Digest-locked Go toolchain with the Node runtime required by JavaScript Actions" \
      io.211api.base.go="${GO_CI_IMAGE}" \
      io.211api.base.node-actions="${NODE_ACTIONS_BASE_IMAGE}" \
      io.211api.source.dockerfile-sha256="${GO_ACTIONS_DOCKERFILE_SHA256}"

COPY --from=node_runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node_runtime /usr/local/LICENSE /usr/local/share/licenses/node/LICENSE
COPY --from=node_runtime /usr/local/README.md /usr/local/share/doc/node/README.md
COPY --from=node_runtime /usr/local/CHANGELOG.md /usr/local/share/doc/node/CHANGELOG.md
