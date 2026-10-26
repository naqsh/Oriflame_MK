import { z } from "zod";

/** Matches FastAPI `HealthResponse` (backend/app/schemas/health.py). */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
