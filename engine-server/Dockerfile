# Cloud engine for Chess by Chaos. Build from the repository root:
#   npm run build:engine-server && docker build -f engine-server/Dockerfile -t cbc-engine .
FROM node:22-slim
WORKDIR /app
COPY .cache/engine-server.mjs ./server.mjs
COPY node_modules/stockfish/bin/stockfish-19-lite-single.js node_modules/stockfish/bin/stockfish-19-lite-single.wasm ./stockfish/
COPY node_modules/stockfish/Copying.txt ./stockfish/COPYING.txt
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.mjs"]
