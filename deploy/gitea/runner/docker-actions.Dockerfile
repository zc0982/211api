ARG DOCKER_CLI_IMAGE
ARG NODE_DOCKER_ACTIONS_BASE_IMAGE

FROM ${DOCKER_CLI_IMAGE} AS docker_cli
FROM ${NODE_DOCKER_ACTIONS_BASE_IMAGE}

ARG DOCKER_CLI_IMAGE
ARG NODE_DOCKER_ACTIONS_BASE_IMAGE
ARG DOCKER_ACTIONS_DOCKERFILE_SHA256

COPY --from=docker_cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker_cli /usr/local/libexec/docker/cli-plugins/ /usr/local/libexec/docker/cli-plugins/

LABEL io.211api.base.docker-cli="${DOCKER_CLI_IMAGE}" \
      io.211api.base.node-docker-actions="${NODE_DOCKER_ACTIONS_BASE_IMAGE}" \
      io.211api.source.dockerfile-sha256="${DOCKER_ACTIONS_DOCKERFILE_SHA256}"
