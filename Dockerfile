## Multi-stage build for smaller, safer runtime image.
## - Build on Debian (glibc) to keep native deps compatible with distroless.
## - Runtime uses distroless (nonroot, no shell).

FROM node:22-bookworm-slim AS build

WORKDIR /app

# Build tools only in the builder stage (for any native Node modules).
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		python3 \
		make \
		g++ \
		ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Install full deps for build (includes devDependencies like typescript).
RUN npm ci

COPY . ./
RUN npm run build

# Remove devDependencies after build to keep runtime small.
RUN npm prune --omit=dev \
	&& npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build --chown=nonroot:nonroot /app/package.json /app/package.json
COPY --from=build --chown=nonroot:nonroot /app/node_modules /app/node_modules
COPY --from=build --chown=nonroot:nonroot /app/dist /app/dist

# Match `npm run start` behavior (`node --trace-deprecation ./dist/index.js`).
CMD ["--trace-deprecation", "dist/index.js"]

