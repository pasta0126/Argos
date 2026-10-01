FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_* vars into the bundle at build time (a static site has no runtime env).
# docker-compose.yml passes it from ARGOS_API_URL in .env.
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL is required (set ARGOS_API_URL in web/.env)" >&2; exit 1)
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine
# Templates are rendered at startup with the container's ARGOS_* environment.
ENV NGINX_ENVSUBST_FILTER=^ARGOS_
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/*.template /etc/nginx/templates/
COPY nginx/40-argos-legacy-redirects.sh /docker-entrypoint.d/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
