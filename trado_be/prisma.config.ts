import { defineConfig } from "prisma/config";

// Load dotenv dynamically
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch (error) {
  // dotenv not available, will use environment variables directly
  console.warn("dotenv not found, using environment variables directly");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
