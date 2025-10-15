#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/docker-publish.sh [OPTIONS]

Builds and/or pushes the ActivityWatch MCP Docker image to GitHub Container Registry.
Tags are derived from the current package.json version (`v<version>` and `dev`).
Additional docker build flags may be appended after "--".

Options:
  -t, --tag TAG        Additional tag to publish (can be repeated)
  -f, --file PATH      Path to Dockerfile (default: docker/Dockerfile)
      --context PATH   Build context directory (default: repository root)
      --build-only     Build the image but skip push
      --push-only      Push the image without rebuilding
      --dry-run        Alias for --build-only
  -h, --help           Show this help message

Environment variables:
  REGISTRY            Registry hostname (default: ghcr.io)
  IMAGE_REPOSITORY    Repository in owner/name format. Auto-detected when possible.
  PUSH                Set to 0 to skip push (same as --build-only)
  BUILD               Set to 0 to skip build (same as --push-only)
  DOCKER_BUILD_ARGS   Extra args appended to docker build (space-delimited)
USAGE
}

read_package_version() {
  local version
  version=$(node -p "const fs = require('fs'); const data = JSON.parse(fs.readFileSync('package.json', 'utf8')); if (!data.version) { throw new Error('missing version'); } data.version;" 2>/dev/null) || return 1
  printf '%s' "$version"
}

USER_TAGS=()
DOCKERFILE="docker/Dockerfile"
BUILD_CONTEXT="."
DO_BUILD=${BUILD:-1}
DO_PUSH=${PUSH:-1}
EXTRA_BUILD_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tag)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 1; }
      USER_TAGS+=("$2")
      shift 2
      ;;
    -f|--file)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 1; }
      DOCKERFILE="$2"
      shift 2
      ;;
    --context)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 1; }
      BUILD_CONTEXT="$2"
      shift 2
      ;;
    --build-only)
      DO_BUILD=1
      DO_PUSH=0
      shift
      ;;
    --push-only)
      DO_BUILD=0
      DO_PUSH=1
      shift
      ;;
    --dry-run)
      DO_BUILD=1
      DO_PUSH=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      EXTRA_BUILD_ARGS+=("$@")
      break
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -n "${DOCKER_BUILD_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_BUILD_ARGS+=(${DOCKER_BUILD_ARGS})
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found" >&2
  exit 1
fi

REGISTRY=${REGISTRY:-ghcr.io}

if [[ "$DO_BUILD" == 0 && "$DO_PUSH" == 0 ]]; then
  echo "Nothing to do: both build and push steps are disabled" >&2
  exit 1
fi

detect_repo_slug() {
  if [[ -n "${IMAGE_REPOSITORY:-}" ]]; then
    echo "$IMAGE_REPOSITORY"
    return
  fi
  if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
    echo "$GITHUB_REPOSITORY"
    return
  fi
  local remote
  remote=$(git config --get remote.origin.url 2>/dev/null || true)
  if [[ -n "$remote" ]]; then
    remote=${remote%.git}
    if [[ "$remote" =~ github.com[:/](.+)$ ]]; then
      echo "${BASH_REMATCH[1]}"
      return
    fi
  fi
  echo ""
}

REPO_SLUG=$(detect_repo_slug)
if [[ -z "$REPO_SLUG" ]]; then
  echo "Unable to determine repository owner/name. Set IMAGE_REPOSITORY or GITHUB_REPOSITORY." >&2
  exit 1
fi

IMAGE_PATH=$(printf '%s' "$REPO_SLUG" | tr '[:upper:]' '[:lower:]')
VERSION=$(read_package_version) || {
  echo "Unable to determine version from package.json." >&2
  exit 1
}

printf 'Resolved package version: v%s\n' "$VERSION"

TAGS=("v$VERSION-dev" "dev")
if [[ ${#USER_TAGS[@]} -gt 0 ]]; then
  TAGS+=("${USER_TAGS[@]}")
fi

SOURCE_LABEL="org.opencontainers.image.source=https://github.com/${REPO_SLUG}"

IMAGE_REFS=()
for tag in "${TAGS[@]}"; do
  IMAGE_REFS+=("${REGISTRY}/${IMAGE_PATH}:${tag}")
done

print_ref_list() {
  for ref in "${IMAGE_REFS[@]}"; do
    printf '  - %s\n' "$ref"
  done
}

if [[ "$DO_BUILD" == 1 ]]; then
  printf 'Building image with tags:\n'
  print_ref_list

  BUILD_CMD=(docker build -f "$DOCKERFILE" --label "$SOURCE_LABEL")
  for ref in "${IMAGE_REFS[@]}"; do
    BUILD_CMD+=(-t "$ref")
  done
  if [[ ${#EXTRA_BUILD_ARGS[@]} -gt 0 ]]; then
    BUILD_CMD+=("${EXTRA_BUILD_ARGS[@]}")
  fi
  BUILD_CMD+=("$BUILD_CONTEXT")

  "${BUILD_CMD[@]}"
else
  printf 'Skipping build. Tags:\n'
  print_ref_list
fi

if [[ "$DO_PUSH" == 1 ]]; then
  if [[ "$DO_BUILD" == 0 ]]; then
    for ref in "${IMAGE_REFS[@]}"; do
      if ! docker image inspect "$ref" >/dev/null 2>&1; then
        echo "Image $ref not found locally. Run with build enabled first." >&2
        exit 1
      fi
    done
  fi
  for ref in "${IMAGE_REFS[@]}"; do
    printf 'Pushing image %s\n' "$ref"
    docker push "$ref"
  done
else
  printf 'Skipping push. Tags:\n'
  print_ref_list
fi
