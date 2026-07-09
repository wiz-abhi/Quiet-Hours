# Quiet Hours — Socket Mode Slack agent.
# No inbound port needed: the app opens an outbound websocket to Slack.
FROM node:22-slim

WORKDIR /app

# Install production deps first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# The JSON ledger lives here; mount a volume in production if you want it
# to survive restarts (fine to lose for the demo — sessions are per-night).
RUN mkdir -p data

ENV NODE_ENV=production

CMD ["node", "src/app.js"]
