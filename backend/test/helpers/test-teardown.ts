import { afterAll } from "vitest";
import { cleanupRegisteredTestUsers } from "./test-user-registry";

afterAll(async () => {
  await cleanupRegisteredTestUsers();
});
