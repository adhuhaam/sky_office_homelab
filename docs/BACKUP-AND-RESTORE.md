# Backup and restore

Pre-.NET rewrite freeze created **2026-07-14**. Live stack was left running (online logical dump).

## Backup location

```
/home/adhuhaam/backups/sky-office-20260714-1442/
├── db/
│   ├── leoos.dump          # custom-format pg_dump (restore with pg_restore)
│   ├── leoos.dump.toc.txt  # TOC listing (verified)
│   ├── leoos.sql.gz        # plain SQL (gzip)
│   └── appdb.dump          # empty compose-default DB (harmless)
├── apps-tree.tar.gz        # apps/ source + deploy files (no node_modules, no postgresql/data, no .git)
├── secrets/secrets.tar.gz  # api/.env, postgresql/.env, infra/certs (mode 600)
├── git/apps-pre-dotnet.bundle
└── meta/MANIFEST.txt
```

Git tag on homelab repo: `backup/pre-dotnet-20260714`

## What was verified

- `pg_restore -l` on `leoos.dump` — TOC present (~125 entries, tables including `users`, `passports`, `billing_*`, …)
- `gunzip -t leoos.sql.gz` — OK

## Restore Postgres (`leoos`)

```bash
# Into existing Docker Postgres (destructive to current leoos data)
docker cp /home/adhuhaam/backups/sky-office-20260714-1442/db/leoos.dump postgres:/tmp/leoos.dump
docker exec -it postgres \
  pg_restore -U leoos -d leoos --clean --if-exists /tmp/leoos.dump
```

Or create a fresh database and restore without `--clean`.

Plain SQL alternative:

```bash
gunzip -c …/leoos.sql.gz | docker exec -i postgres psql -U leoos -d leoos
```

## Restore app tree

```bash
# Example: extract to a scratch directory, not over live apps without review
mkdir -p /tmp/sky-office-restore
tar -xzf /home/adhuhaam/backups/sky-office-20260714-1442/apps-tree.tar.gz -C /tmp/sky-office-restore
```

Re-run `pnpm install` inside `leo-os/` after restore. Re-deploy web: `pnpm deploy:web`.

## Restore secrets

```bash
# Review before overwriting live secrets
tar -tzf …/secrets/secrets.tar.gz
# tar -xzf …/secrets/secrets.tar.gz -C /home/adhuhaam/apps
```

## Restore git

```bash
git clone /home/adhuhaam/backups/sky-office-20260714-1442/git/apps-pre-dotnet.bundle sky-office-homelab-restored
# or: git fetch …/apps-pre-dotnet.bundle 'refs/tags/*:refs/tags/*'
```

## Remotes

| Remote | URL |
|--------|-----|
| Homelab (this `apps/` repo) | `git@github.com:adhuhaam/sky_office_homelab.git` |
| App monorepo (source) | [https://github.com/adhuhaam/sky-office.git](https://github.com/adhuhaam/sky-office.git) |

**Before any push:** update the root [README.md](../README.md) with current system behavior when asked (README is the public how-it-works surface).

## Related

- [MIGRATION-DOTNET.md](MIGRATION-DOTNET.md) — ASP.NET Core rewrite plan
- [OPERATIONS.md](OPERATIONS.md) — day-to-day access
