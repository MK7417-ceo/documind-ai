# DocuMind AI — frontend (Vite dev server, for local Docker runs)
FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Allow the browser to reach the backend; override at build time if needed.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
