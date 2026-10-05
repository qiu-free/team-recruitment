FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
USER appuser

EXPOSE 3000
CMD ["npm", "start"]
