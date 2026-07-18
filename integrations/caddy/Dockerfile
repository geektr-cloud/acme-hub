FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git

WORKDIR /build

# Copy caddy plugin source
COPY . /build/plugin

# Install xcaddy
RUN go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest

# Build caddy with acmehub plugin
RUN CGO_ENABLED=0 xcaddy build \
    --with github.com/geektr-cloud/acme-hub/integrations/caddy=/build/plugin

FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /build/caddy /usr/bin/caddy

EXPOSE 80 443 2019

ENTRYPOINT ["/usr/bin/caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile"]
