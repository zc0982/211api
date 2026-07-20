#!/usr/bin/env bash

set -euo pipefail

usage() {
  printf 'Usage: docker {info|image inspect IMAGE}\n' >&2
}

case "${1:-}" in
  info)
    (($# == 1)) || {
      usage
      exit 64
    }
    operation=info
    ;;
  image)
    [[ "${2:-}" == inspect && -n "${3:-}" ]] || {
      usage
      exit 64
    }
    (($# == 3)) || {
      usage
      exit 64
    }
    operation=image-inspect
    image=$3
    ;;
  *)
    usage
    exit 64
    ;;
esac

docker_host="${DOCKER_HOST:-unix:///var/run/docker.sock}"
case "$docker_host" in
  unix:///*) socket_path="${docker_host#unix://}" ;;
  *)
    printf 'Only a local Unix Docker socket is allowed.\n' >&2
    exit 1
    ;;
esac
[[ -S "$socket_path" ]]

curl_docker() {
  curl \
    --silent \
    --show-error \
    --fail \
    --connect-timeout 5 \
    --max-time 15 \
    --unix-socket "$socket_path" \
    "$1"
}

case "$operation" in
  info)
    [[ "$(curl_docker http://docker/_ping)" == OK ]]
    ;;
  image-inspect)
    encoded_image="${image//%/%25}"
    encoded_image="${encoded_image//\//%2F}"
    encoded_image="${encoded_image//@/%40}"
    curl_docker "http://docker/images/${encoded_image}/json"
    ;;
esac
