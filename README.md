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
docker compose up -d --build
```
