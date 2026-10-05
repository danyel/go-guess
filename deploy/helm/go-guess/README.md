# Go Guess Helm chart

This chart deploys Go Guess as two images, an API and a web front end, plus its
own PostgreSQL and RabbitMQ, and publishes one HTTPS host per tenant under
`https://<tenant>.guess.urpi.be`.

## 1. What the chart creates

| Resource | Name | Purpose |
|---|---|---|
| Deployment | `go-guess-api` | Go API, runs migrations and seeds before serving |
| Deployment | `go-guess-web` | nginx serving the built React application |
| Service | `api` | Cluster-internal API, proxied by the web image |
| Service | `go-guess-web` | Cluster-internal web front end, ingress backend |
| Ingress | `go-guess` | One rule and one TLS SAN per tenant host |
| Issuer | `go-guess-selfsigned` | cert-manager self-signed issuer |
| Certificate | `go-guess-web-ca` | Chart CA that signs the leaf certificate |
| Certificate | `go-guess-web` | Leaf certificate covering every tenant host |
| StatefulSet | `go-guess-postgresql` | PostgreSQL, `emptyDir` or persistent volume |
| StatefulSet | `go-guess-rabbitmq` | RabbitMQ, `emptyDir` or persistent volume |
| Secret | `go-guess-secrets` | JWT secret, connection URLs, broker credentials |

A single web deployment serves every tenant host. The API resolves the tenant
from the request `Host` header, so adding a tenant means adding one entry to
`tenants`, not deploying another stack.

## 2. Prerequisites

- A Kubernetes cluster reachable through `KUBECONFIG`.
- A `StorageClass` when `postgresql.persistence.enabled` or
  `rabbitmq.persistence.enabled` is `true`.
- ingress-nginx with the `nginx` ingress class: `make ingress-nginx-install`.
- cert-manager when `ingress.tls.enabled` is `true`: `make cert-manager-install`.
- Cluster nodes trusting `batty1039.startdedicated.net:5000` as an insecure
  registry, or an HTTPS registry.

Run everything the chart depends on in one step:

```bash
make cluster-prepare
```

## 3. Deploy

```bash
make helm-lint
make helm-deploy-development
```

The development profile uses `latest` images, development fixtures, ephemeral
storage, and namespace `go-insane-development`. Production uses released tags,
production fixtures, persistent volumes, and namespace `go-insane-production`:

```bash
make helm-deploy-production
```

Both targets accept per-tenant Go Loose credentials from the environment:

```bash
export GO_LOOSE_NMBS_CLIENT_ID=...
export GO_LOOSE_NMBS_CLIENT_SECRET=...
export GO_LOOSE_YPTO_CLIENT_ID=...
export GO_LOOSE_YPTO_CLIENT_SECRET=...
make helm-deploy-production
```

After a successful install the release notes list every tenant URL and the
command that exports the CA certificate. With the local platform, prefer
`docs/KUBERNETES-DEPLOYMENTS.md` in the infrastructure repository, which covers
`/etc/hosts` entries and CA trust for the whole platform.

## 4. Tenants and hosts

`tenants` is the list of slugs and `domain` is the shared parent domain:

```yaml
domain: guess.urpi.be
tenants:
  - nmbs
  - ypto
```

The chart derives, without any extra configuration:

- `GO_LOOSE_APP_DOMAIN=<domain>`, so the API accepts `nmbs.<domain>` and
  `ypto.<domain>` as tenant hosts.
- One ingress rule per tenant, all pointing at `go-guess-web`.
- One certificate SAN per tenant, so a single secret covers every host.
- `FRONTEND_URL`, when `api.frontendURL` is empty, as
  `https://<first tenant>.<domain>`. This is the fallback used to build
  invitation and meeting links, so the first entry is the tenant that receives
  shareable links.

A slug must be a single DNS label. The API rejects slugs containing a dot, and
the certificate would not match a two-level host.

Adding a tenant therefore requires three things: the slug in `tenants`, a DNS
record pointing at the ingress controller, and a Go Loose client when browser
sign-in is used.

## 5. Values

### Top level

| Key | Default | Description |
|---|---|---|
| `nameOverride` | `""` | Overrides the chart name in resource names and labels |
| `fullnameOverride` | `""` | Replaces the generated resource name prefix |
| `domain` | `guess.urpi.be` | Parent domain of every tenant host. `guess-dev.urpi.be` in the development profile |
| `tenants` | `[nmbs, ypto]` | Tenant slugs served by the release |
| `imagePullSecrets` | `[]` | Pull secrets added to both pods |

### api

| Key | Default | Description |
|---|---|---|
| `api.replicaCount` | `1` | API replicas, keep at `1` while migrations run on startup |
| `api.image.repository` | `batty1039.startdedicated.net:5000/go-guess-api` | API image |
| `api.image.tag` | `0.0.1` | API image tag |
| `api.image.pullPolicy` | `IfNotPresent` | API pull policy |
| `api.environment` | `development` | `APP_ENV`, `production` seeds production fixtures only |
| `api.frontendURL` | `""` | Fallback public URL for invitation and meeting links |
| `api.tokenTTL` | `8h` | `TOKEN_TTL` for issued API tokens |
| `api.maxUploadMB` | `10` | `MAX_UPLOAD_MB` upload limit, match `proxy-body-size` |
| `api.service.name` | `api` | Service DNS name, fixed by the web image |
| `api.service.type` | `ClusterIP` | API service type |
| `api.service.port` | `8080` | API service port |
| `api.goLoose.enabled` | `true` | Enables Go Loose browser sign-in |
| `api.goLoose.authDomain` | `auth.urpi.be` | Tenant login host `https://<tenant>.<authDomain>`. `auth-dev.urpi.be` in the development profile |
| `api.goLoose.ca.existingSecret` | `""` | Secret holding the Go Loose CA bundle |
| `api.goLoose.ca.key` | `ca.crt` | Key projected from that secret |
| `api.goLoose.ca.mountPath` | `/certs/local-ca.crt` | `GO_LOOSE_CA_FILE` target |
| `api.goLoose.tenants.<slug>.clientID` | `""` | Go Loose client ID for that tenant |
| `api.goLoose.tenants.<slug>.clientSecret` | `""` | Go Loose client secret for that tenant |
| `api.resources` | `50m`/`128Mi` to `500m`/`512Mi` | API requests and limits |
| `api.podAnnotations`, `api.podLabels` | `{}` | Extra pod metadata |
| `api.podSecurityContext` | `{}` | Pod security context |
| `api.securityContext` | non-root, read-only root filesystem | Container security context |
| `api.strategy.type` | `Recreate` | Old pod exits before migrations run again |

### web

| Key | Default | Description |
|---|---|---|
| `web.replicaCount` | `2` | nginx replicas, safe to scale because nginx is stateless |
| `web.image.repository` | `batty1039.startdedicated.net:5000/go-guess-web` | Web image |
| `web.image.tag` | `0.0.1` | Web image tag |
| `web.image.pullPolicy` | `IfNotPresent` | Web pull policy |
| `web.service.type` | `ClusterIP` | Web service type |
| `web.service.port` | `80` | Web service port |
| `web.service.nodePort` | `null` | Node port when the type is `NodePort` |
| `web.resources` | `25m`/`32Mi` to `300m`/`128Mi` | Web requests and limits |
| `web.podAnnotations`, `web.podLabels` | `{}` | Extra pod metadata |
| `web.podSecurityContext` | `{}` | Pod security context |
| `web.securityContext` | root, `NET_BIND_SERVICE` only | Container security context |
| `web.strategy` | rolling, `maxUnavailable: 0` | Keeps the ingress backed up during rollout |

Neither container has a forced uid. Both images declare their own user, the API
as `app` and nginx as `nginx`, and `runAsNonRoot` validates it.

The web security context differs from the API one on purpose. nginx binds the
privileged port `80` and forks workers as the `nginx` user, so the pod runs as
root with `CHOWN`, `SETGID`, `SETUID`, and `NET_BIND_SERVICE`, and mounts
writable `emptyDir` volumes at `/var/cache/nginx`, `/var/run`, and `/tmp`.

### ingress

| Key | Default | Description |
|---|---|---|
| `ingress.enabled` | `true` | Creates the multi-host ingress |
| `ingress.className` | `nginx` | Ingress class of the controller |
| `ingress.annotations` | body size `10m`, timeouts `3600`, buffering off, TLS redirect | Controller annotations |
| `ingress.path` | `/` | Path routed to the web service |
| `ingress.pathType` | `Prefix` | Path type of that route |
| `ingress.tls.enabled` | `true` | Terminates TLS on the controller |
| `ingress.tls.secretName` | `""` | Defaults to `<fullname>-web-tls` |
| `ingress.tls.existingSecret` | `""` | Uses a certificate managed outside the chart |

The proxy annotations matter for the interview feature: the API streams events
over server-sent events and accepts video uploads, so buffering off, a one-hour
read timeout, and a body size at least as large as `api.maxUploadMB` are
required, otherwise streams stall and uploads fail with `413`.

### certManager

| Key | Default | Description |
|---|---|---|
| `certManager.enabled` | `true` | Chart creates the certificates |
| `certManager.issuerRef` | `{}` | Uses an existing issuer instead of the chart CA |
| `certManager.duration` | `8760h` | Certificate lifetime |
| `certManager.renewBefore` | `720h` | Renewal window |
| `certManager.caSecretName` | `""` | Defaults to `<fullname>-web-ca` |

Three certificate objects are created in order: a self-signed `Issuer`, a CA
`Certificate` stored in `caSecretName`, and the leaf `Certificate` stored in the
ingress TLS secret with one `dnsNames` entry per tenant. Set `issuerRef` to sign
with a cluster issuer instead, for example an internal ACME issuer:

```yaml
certManager:
  issuerRef:
    name: internal-acme
    kind: ClusterIssuer
    group: cert-manager.io
```

Set `ingress.tls.existingSecret` to use a certificate the chart does not own,
and `certManager.enabled: false` to stop emitting cert-manager objects.

### Secrets, storage, and scheduling

| Key | Default | Description |
|---|---|---|
| `secrets.jwtSecret` | `""` | Generated and preserved across upgrades when empty |
| `secrets.databaseURL` | derived | Full URL, required when PostgreSQL is disabled |
| `secrets.rabbitmqURL` | derived | Full URL, required when RabbitMQ is disabled |
| `secrets.postgresqlPassword` | generated | PostgreSQL user password |
| `secrets.rabbitmqPassword` | generated | RabbitMQ user password |
| `postgresql.enabled` | `true` | Bundled PostgreSQL |
| `postgresql.persistence.enabled` | `true` | Persistent volume instead of `emptyDir` |
| `postgresql.persistence.size` | `8Gi` | Volume size |
| `postgresql.auth.username` | `go_guess` | Database user |
| `rabbitmq.enabled` | `true` | Bundled RabbitMQ |
| `rabbitmq.persistence.enabled` | `true` | Persistent volume instead of `emptyDir` |
| `rabbitmq.persistence.size` | `4Gi` | Volume size |
| `nodeSelector`, `tolerations`, `affinity` | empty | Applied to both deployments |

Generated secrets are read back with `lookup` on upgrade, so leaving them empty
rotates nothing and keeps sessions valid across releases.

## 6. External services

Disable the bundled StatefulSets and pass full connection URLs to use managed
PostgreSQL and RabbitMQ:

```bash
helm upgrade --install go-guess deploy/helm/go-guess \
  --namespace go-insane-production --create-namespace \
  -f deploy/helm/go-guess/values-production.yaml \
  --set postgresql.enabled=false \
  --set rabbitmq.enabled=false \
  --set-string secrets.databaseURL="$DATABASE_URL" \
  --set-string secrets.rabbitmqURL="$RABBITMQ_URL"
```

## 7. Upgrade and remove

```bash
make helm-deploy-production
helm -n go-insane-production history go-guess
helm -n go-insane-production rollback go-guess 1
make helm-down-production
```

Uninstalling removes the release secrets, so store `secrets.jwtSecret` and the
two connection URLs outside the cluster before deleting a release whose database
must survive.

## 8. Verify

```bash
kubectl -n go-insane-production get ingress go-guess
kubectl -n go-insane-production get certificate
kubectl -n go-insane-production rollout status deployment/go-guess-api
kubectl -n go-insane-production rollout status deployment/go-guess-web
curl --resolve nmbs.guess.urpi.be:443:127.0.0.1 --cacert go-guess-ca.crt \
  https://nmbs.guess.urpi.be/api/health
```

The test pod installed by `helm test` checks the API health endpoint and the web
root from inside the cluster.