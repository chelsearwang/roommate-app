# start from an official Node.js image — bundles Node, npm, and a minimal Linux environment together
FROM node:20-alpine

# every command below runs from this folder inside container
WORKDIR /app

# copy these two files first
COPY package*.json ./
RUN npm install

# copy everything else
COPY . .

# prisma generate client
RUN npx prisma generate

# documents which port the app listens on
EXPOSE 3000

# command to actually start server when a container launches
CMD ["node", "src/index.js"]