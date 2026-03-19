import { z } from "zod";

export const UpdateYourVue2ConfigSchema = z.object({
  target: z.enum(["vite", "webpack"]).default("vite"),
  useCompat: z.boolean().default(false),
  generateTypes: z.boolean().default(false),
  backup: z.boolean().default(true),
  backupDir: z.string().optional(),
  install: z.boolean().default(false)
});

export type UpdateYourVue2Config = z.infer<typeof UpdateYourVue2ConfigSchema>;

