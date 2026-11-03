# ============================================================================
# @avahui/postgres — Standalone PostgreSQL 17 Dockerfile
# ============================================================================
FROM postgres:17-alpine

COPY ./infrastructure/database/init/ /docker-entrypoint-initdb.d/

EXPOSE 5432
