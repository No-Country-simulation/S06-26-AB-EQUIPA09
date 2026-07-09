# Deploy em produção

Este projeto já tem um caminho de produção com Docker Compose:

- `postgres`: banco PostgreSQL persistente;
- `api`: backend Bun/Elysia;
- `web`: frontend React servido por Nginx;
- proxy `/api` no Nginx para o backend.

## 1. Preparar o servidor

Num VPS Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

Clonar o projeto:

```bash
git clone <repo-url> sqlens
cd sqlens
```

## 2. Configurar variáveis de produção

Criar o ficheiro real a partir do exemplo:

```bash
cp .env.production.example .env.production
```

Editar os valores obrigatórios:

- `APP_URL`: domínio público, por exemplo `https://sqlens.seudominio.com`;
- `CORS_ORIGINS`: o mesmo domínio público;
- `JWT_SECRET`: string aleatória com pelo menos 32 caracteres;
- `SIGNED_URL_SECRET`: outro segredo aleatório;
- `ENCRYPTION_KEY`: chave hexadecimal com 64 caracteres;
- `DB_PASSWORD`: password forte do Postgres;
- `GROQ_API_KEY`: chave para o agente IA, se o agente for usado;
- `STAFF_SEED_PASSWORD`: password forte para o primeiro staff.

Gerar uma `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

## 3. Subir a aplicação

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Verificar estado:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
```

O frontend fica exposto na porta definida por `WEB_PORT`, por omissão:

```txt
http://IP_DO_SERVIDOR/
```

## 4. Criar staff inicial

Depois da API estar saudável:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api bun src/db/seed.ts
```

Entrar em:

```txt
/staff/login
```

## 5. Carregar dados CVSS

Usar o fluxo simples pelo front:

1. Entrar como staff.
2. Abrir `/staff/ingestao`.
3. Usar **Upload CVSS**.
4. Enviar pelo menos `antenas_flp.csv` ou `antenas_flp (1).csv` e `tensor_concentracao.csv`.

Também é possível executar pelo container:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api bun scripts/ingest-cvss.ts /caminho/para/cvss
```

## 6. Domínio e HTTPS

Para produção real, colocar o domínio apontado para o servidor e usar HTTPS.

Opções comuns:

- Cloudflare Tunnel na frente do serviço `web`;
- Caddy ou Traefik com Let’s Encrypt;
- Nginx externo com Certbot.

Importante: em `NODE_ENV=production`, os cookies são marcados como `secure`, então login por browser deve usar HTTPS em produção.

## 7. Atualizar versão em produção

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

As migrations rodam automaticamente quando o container `api` inicia.

## 8. Comandos úteis

```bash
# logs
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# reiniciar apenas API
docker compose --env-file .env.production -f docker-compose.prod.yml restart api

# parar tudo
docker compose --env-file .env.production -f docker-compose.prod.yml down

# backup simples do Postgres
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$DB_USER" "$DB_DATABASE" > backup.sql
```
