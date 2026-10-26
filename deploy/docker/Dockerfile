# Keep workerd's system CA trust without the full buildpack image's unused
# compilers, image decoders, and database clients. Keep Node aligned with .nvmrc.
FROM node:22.23.4-bookworm-slim

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

# Corporate/build-environment CAs can be supplied without persisting them in
# image layers: docker build --secret id=proxy_ca,src=/path/to/ca.pem ...
RUN --mount=type=secret,id=proxy_ca \
  if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
  corepack enable \
  && NODE_USE_ENV_PROXY=1 corepack prepare pnpm@10.34.8 --activate \
  && NODE_USE_ENV_PROXY=1 npm install --global npm@11.21.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=secret,id=proxy_ca \
  if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
  NODE_USE_ENV_PROXY=1 pnpm install --frozen-lockfile

COPY . .

EXPOSE 3001

# The app's boot-time build reads this to show the notice pointing to the
# standalone image (deploy/standalone/), which replaces this one.
ENV VITE_OPENSEO_LEGACY_DOCKER=true

# Readiness probe against the unauthenticated setup/health endpoint. The long
# start period covers migrations plus the boot-time vite build (skipped when
# the previous start's build is still valid; see deploy/docker/docker-entrypoint.sh).
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(function(r){process.exit(r.ok?0:1)}).catch(function(){process.exit(1)})"

# Startup (preflight, migrations, conditional build, serve) lives in
# deploy/docker/docker-entrypoint.sh. The repo .npmrc raises the V8 heap ceiling
# (node-options) so the ~7400-module SSR build doesn't OOM under Node's ~2GB
# default.
CMD ["sh", "deploy/docker/docker-entrypoint.sh"]
