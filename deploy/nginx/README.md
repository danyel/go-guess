# Dedicated-server reverse proxy

Production exposes only the Go Guess application through Kubernetes NodePort
`31374`. PostgreSQL and RabbitMQ remain available only through their
cluster-internal services.

## DNS

In one.com, create an `A` record for `goguess.urpi.be` pointing to the dedicated
server's public IPv4 address. Add an `AAAA` record only when the server and its
firewall are configured for public IPv6. Wait for:

```bash
dig +short goguess.urpi.be
```

to return the dedicated server address before requesting a certificate.

## Nginx and Certbot

The included virtual host assumes Rancher runs in Docker on the Nginx server.
It reaches the embedded K3s NodePort through Rancher's Docker bridge address,
`172.17.0.2:31374`. Confirm that address with `docker inspect rancher` before
installing the configuration.

```bash
sudo install -m 0644 deploy/nginx/goguess.urpi.be.conf \
  /etc/nginx/sites-available/goguess.urpi.be.conf
sudo ln -s /etc/nginx/sites-available/goguess.urpi.be.conf \
  /etc/nginx/sites-enabled/goguess.urpi.be.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d goguess.urpi.be
sudo certbot renew --dry-run
```

Certbot adds the HTTPS listener, certificate paths, and HTTP-to-HTTPS redirect
to this virtual host. Allow inbound TCP ports `80` and `443`. Do not expose
NodePort `31374`, PostgreSQL `5432`, RabbitMQ `5672`, or RabbitMQ management
ports to the public internet. If Rancher uses a different Docker address,
replace `172.17.0.2` in `proxy_pass` with the current Rancher container address.

## Deploy and verify

Deploy the production profile:

```bash
make helm-deploy-production
kubectl -n go-guess-production get pods
kubectl -n go-guess-production get service go-guess
curl --fail http://172.17.0.2:31374/api/health
curl --fail https://goguess.urpi.be/api/health
```

The `go-guess` service should show `80:31374/TCP`. The PostgreSQL and RabbitMQ
services should remain `ClusterIP` services without NodePorts.
