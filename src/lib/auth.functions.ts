import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public check used by the dynamic /auth page to decide whether to show the
 * "log in" or the "sign up" password step for a given email address.
 */
export const checkEmailExists = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exists, error } = await (supabaseAdmin.rpc as never as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>)("email_exists", {
      check_email: data.email,
    });

    if (error) throw new Error(error.message);
    return { exists: Boolean(exists) };
  });
