import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** Unextended Prisma client for tenant resolution and platform bypass queries. */
export const basePrisma = new PrismaClient();
