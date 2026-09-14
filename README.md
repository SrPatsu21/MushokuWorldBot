# MushokuWorldBot

## secrets

```shell
mkdir -p secrets

touch \
  secrets/db_password.txt \
  secrets/discord_token.txt \
  secrets/revolt_token.txt \
  secrets/db_password.txt
```

## build

```shell
DOCKER_BUILDKIT=1 docker compose build --no-cache
docker compose up -d
docker compose logs -f bot
```

```shell
docker compose build
docker compose up -d
```

```shell
docker compose exec db psql -U bot_user -d mushoku_db -c "SELECT * FROM user_profiles;"
```

```shell
docker compose exec db psql -U bot_user -d mushoku_db -c "SELECT * FROM linked_accounts;"
```

```shell
docker compose exec bot sh -c 'export DATABASE_URL="postgresql://bot_user:$(cat /run/secrets/db_password)@db:5432/mushoku_db" && bunx prisma db push'
```

```shell
docker compose exec db psql -U bot_user -d mushoku_db -c "
DELETE FROM user_actions WHERE profile_id = 2;
DELETE FROM linked_accounts WHERE profile_id = 2;
DELETE FROM swordsman_classes WHERE profile_id = 2;
DELETE FROM mage_classes WHERE profile_id = 2;
DELETE FROM user_profiles WHERE id = 2;
"
```
