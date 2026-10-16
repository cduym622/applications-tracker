# syntax=docker/dockerfile:1

# Local development image: the Vite dev server, which proxies /api to the API
# container. Production serves the Vite build from S3 and does not use it.
FROM node:22-slim

WORKDIR /app

# Install as the image's node user so Vite can write its cache under
# node_modules/.vite at runtime.
RUN chown node:node /app
USER node

RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci

COPY --chown=node:node . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
