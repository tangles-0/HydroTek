import * as z from "zod"

export async function parseResponse<T extends z.ZodTypeAny>(response: Response, schema: T): Promise<z.infer<T>> {
  if (!response.ok) {
    throw new ResponseError(response.status, response.statusText)
  }

  try {
    return (await schema.parseAsync(await response.json())) as z.infer<T>
  } catch (e) {
    console.error(e)
    throw new ResponseError(response.status, "Response was not in expected format.")
  }
}

export class ResponseError extends Error {
  constructor(
    public status: number,
    public statusText: string
  ) {
    super(statusText)
  }
}
