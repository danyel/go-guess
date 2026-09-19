FROM golang:1.27.1-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM golang:1.27.1-alpine AS tools
RUN GOBIN=/out go install github.com/pressly/goose/v3/cmd/goose@v3.26.0

FROM alpine:3.22
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /out/api /usr/local/bin/api
COPY --from=tools /out/goose /usr/local/bin/goose
COPY migrations ./migrations
USER app
EXPOSE 8080
CMD ["sh", "-c", "goose -dir migrations postgres \"$DATABASE_URL\" up && exec api"]
