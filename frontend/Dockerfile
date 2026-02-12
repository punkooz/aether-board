FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV PORT=5173
ENV BACKEND_URL=http://backend:3000
EXPOSE 5173
CMD ["npm", "run", "start"]
