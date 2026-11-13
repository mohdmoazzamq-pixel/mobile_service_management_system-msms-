FROM node:20-alpine

WORKDIR /app

# Copy backend dependency definitions
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy the entire application
COPY . .

# Environment defaults
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start unified server serving frontend and API
CMD ["node", "server.js"]
