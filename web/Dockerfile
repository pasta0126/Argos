# Build context is the repo root (see docker-compose.yml): the build bundles server/examples.
FROM node:22-slim AS build
WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
COPY server/examples /app/server/examples

# Vite bakes VITE_* vars into the bundle at build time (a static site has no runtime env).
ARG VITE_API_URL=https://argos-api.northernarchive.com
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
