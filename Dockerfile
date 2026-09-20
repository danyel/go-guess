# Build the React frontend.
FROM node:26-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Compile the API and seed binaries.
FROM golang:1.27.1-alpine AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

# Build the migration CLI separately so its dependencies stay out of the app layer.
FROM golang:1.27.1-alpine AS tools
RUN GOBIN=/out go install github.com/pressly/goose/v3/cmd/goose@v3.26.0

# Run the frontend and API behind one HTTP endpoint.
FROM alpine:3.22
RUN apk add --no-cache ca-certificates nginx tzdata \
    && addgroup -S app \
    && adduser -S -G app -u 10001 app \
    && mkdir -p /app/frontend /app/migrations /tmp/nginx \
    && chown -R app:app /app /tmp/nginx

WORKDIR /app
COPY --from=frontend --chown=app:app /src/frontend/dist/ ./frontend/
COPY --from=backend /out/api /usr/local/bin/api
COPY --from=backend /out/seed /usr/local/bin/seed
COPY --from=tools /out/goose /usr/local/bin/goose
COPY --chown=app:app backend/migrations/ ./migrations/
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /usr/local/bin/go-guess-entrypoint

USER app
EXPOSE 8080
ENV ADDRESS=:8081 \
    APP_ENV=production \
    FRONTEND_URL=http://localhost:8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/go-guess-entrypoint"]
