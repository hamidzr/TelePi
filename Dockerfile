FROM node:22-alpine

# match host UID/GID so bind-mounted directories are writable
ARG USER_UID=1000
ARG USER_GID=1000

RUN apk add --no-cache git bash openssh-client

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build

# create non-root user whose UID/GID matches the host user (bind-mount writes);
# node:alpine ships a 'node' user at UID/GID 1000 - remove it first if it conflicts
RUN existing_user=$(getent passwd ${USER_UID} | cut -d: -f1 || true); \
    existing_group=$(getent group ${USER_GID} | cut -d: -f1 || true); \
    [ -n "$existing_user" ] && deluser "$existing_user" 2>/dev/null || true; \
    [ -n "$existing_group" ] && delgroup "$existing_group" 2>/dev/null || true; \
    addgroup -g ${USER_GID} telepi \
    && adduser -D -u ${USER_UID} -G telepi telepi \
    && mkdir -p /workspace /home/telepi/.pi/agent /home/telepi/.npm-global /home/telepi/.ssh \
    && ssh-keyscan github.com >> /home/telepi/.ssh/known_hosts 2>/dev/null \
    && chown -R telepi:telepi /workspace /home/telepi

USER telepi

# Configure npm global prefix to a user-writable directory so that
# pi-coding-agent can install extensions (e.g. npm:pi-mcporter) without root.
ENV NPM_CONFIG_PREFIX=/home/telepi/.npm-global
ENV PATH="/home/telepi/.npm-global/bin:${PATH}"

CMD ["node", "dist/index.js"]
