# Deploying with Docker

The site runs as three containers, all namespaced by `COMPOSE_PROJECT_NAME`:

| Container | What it does | Reachable from |
|---|---|---|
| `web` | nginx serving the built storefront + admin, proxying `/api` and `/uploads` | `127.0.0.1:WEB_PORT` on the server only |
| `api` | FastAPI (uvicorn). Applies pending migrations every time it starts | `web` only |
| `db` | Postgres 18 | `api` only (private network, never published) |

Data lives in two named volumes: `<project>_db-data` (the database) and `<project>_uploads` (images uploaded in the admin panel). Product images from the catalogue are baked into the `web` image.

## Live setup (stremio-server-2, 92.4.84.246)

Installed 2026-09-29 on Ubuntu 22.04 (ARM):

- **Caddy** on the host owns 80/443 and fetches HTTPS certificates. Config: `/etc/caddy/Caddyfile` (template: [`deploy/Caddyfile`](deploy/Caddyfile)).
- **Jenkins** in Docker (`deploy/jenkins/`, configuration as code), on `127.0.0.1:8080`, served at `jenkins.92.4.84.246.sslip.io`. It polls the `website` branch every 5 minutes and runs the [`Jenkinsfile`](Jenkinsfile): build images -> `docker compose up -d` -> smoke test through nginx -> API -> database.
- **This site** as Compose project `hooksnthreads`, `web` on `127.0.0.1:8090`, served at `hooksnthreads.92.4.84.246.sslip.io`. Settings: `/opt/hooksnthreads/hooksnthreads.env` (root:docker, 640).
- **Firewall:** iptables allows 22/80/443 only; Postgres is never exposed.

Deploying a change = push to `website`. Passwords and server commands are in the private credentials file, not in git.

## Several sites on one server

Each site is its own Compose project with its own `COMPOSE_PROJECT_NAME` and `WEB_PORT`, so containers, networks and volumes never collide. One reverse proxy on the server owns ports 80/443, handles HTTPS, and routes each domain to its site's localhost port.

With [Caddy](https://caddyserver.com) (automatic HTTPS certificates), `/etc/caddy/Caddyfile`:

```
hooksnthreads.shop, www.hooksnthreads.shop {
    reverse_proxy 127.0.0.1:8080
}

other-site.com {
    reverse_proxy 127.0.0.1:8081
}
```

The same works with nginx or Traefik: proxy the domain to `127.0.0.1:<WEB_PORT>` and pass `X-Forwarded-Proto` / `X-Forwarded-For` (Caddy does this by default).

## First deployment

On the server (Docker Engine + Compose v2 installed):

```bash
git clone -b website https://github.com/VrajVS/HooksnThreads.git hooksnthreads
cd hooksnthreads
cp .env.example .env        # then edit every value
docker compose up -d --build
docker compose ps           # all three should become "healthy"
```

Then load the data. **Either** bring over your existing database (recommended: it has the full catalogue, admin users, orders and settings):

```bash
# On your computer: export the local database (adjust the path to your PostgreSQL 18 install)
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -Fc -d hooksnthreads -f hnt.dump

# Copy hnt.dump (and server/uploads if you uploaded images in the admin) to the server, then:
docker compose exec -T db pg_restore -U hooksnthreads -d hooksnthreads --clean --if-exists --no-owner < hnt.dump
docker compose cp ./uploads/. api:/app/uploads/
docker compose exec -u root api chown -R app:app /app/uploads
docker compose restart api
```

**Or** start empty and create the first Super Admin from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` in `.env`:

```bash
docker compose exec api python scripts/seed.py
```

`seed.py` also inserts the 27 original demo products and 5 categories. Don't run it against a restored database: it resets those products to their placeholder titles and images.

## Updating

```bash
git pull
docker compose up -d --build
```

Migrations run automatically when the `api` container starts.

## Backups

```bash
# Database
docker compose exec -T db pg_dump -U hooksnthreads -Fc hooksnthreads > backup-$(date +%F).dump
# Uploaded images
docker run --rm -v hooksnthreads_uploads:/data -v "$PWD":/out alpine tar czf /out/uploads-$(date +%F).tgz -C /data .
```

Restore a database backup with the same `pg_restore` command as in *First deployment*.

## Useful commands

```bash
docker compose logs -f api                    # API logs (email verification links are logged here)
docker compose exec db psql -U hooksnthreads  # database shell
docker compose down                           # stop (data volumes are kept)
```

## Notes

- `COOKIE_SECURE=true` requires HTTPS. When trying the stack locally over `http://localhost:8080`, set `COOKIE_SECURE=false` and `PUBLIC_URL=http://localhost:8080`, or logins won't stick.
- No email provider is configured yet: customer verification links are written to the `api` logs instead of being emailed.
- Local development is unchanged: `npm run dev` still runs Vite and uvicorn directly.
