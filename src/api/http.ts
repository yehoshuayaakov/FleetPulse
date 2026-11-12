export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly headers: Headers,
    readonly body: unknown,
  ) {
    super(`Request failed with HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export async function requestJson(
  path: `/api/${string}`,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(path, init);

  if (response.ok) {
    return response.json();
  }

  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // A proxy or upstream server can return a plain-text error.
  }
  throw new HttpError(response.status, response.headers, body);
}
