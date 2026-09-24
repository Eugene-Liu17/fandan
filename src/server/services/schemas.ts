/** Zod pieces shared by service input schemas. */
import { z } from "zod";
import { isPlainDate, type PlainDate } from "@/domain/date";

/** A `YYYY-MM-DD` calendar date. */
export const plainDateSchema = z
  .string()
  .refine(isPlainDate, { message: "Expected a YYYY-MM-DD date" })
  .transform((s) => s as PlainDate);
