export default async function handler(req, res) {

  // Allow only http://localhost:* or a single user-defined origin
  const origin = req.headers.origin || '';
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/i.test(origin);
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const isAllowedOrigin = origin === allowedOrigin;

  if (isLocalhost || isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  // Short-circuit pre-flight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { API_AUTH_TOKEN } = process.env;

  if (!API_AUTH_TOKEN) {
    return res.status(500).json({ error: "API_AUTH_TOKEN is missing from env" });
  }

  try {
    // Remove the leading "/api/" from req.url
    // e.g. "/api/foo/bar" -> "foo/bar"
    const path = req.url.replace(/^\/api\//, '');

    if (!path || path === "/" || path === "") {
      return res.status(400).json({
        error:
          "This is just the root path of the proxy! It doesn't do anything on its own. You need to append the path of the 1inch API you want to talk to",
      });
    }    

    // Build the target URL, removing any leading slash from path to prevent double slashes
    const targetUrl = `https://api.1inch.dev/${path.replace(/^\//, "")}`;

    // Prepare headers
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${API_AUTH_TOKEN}`);

    // Only forward essential headers
    const allowedHeaders = [
      "accept",
      "accept-encoding",
      "accept-language",
      "content-type",
      "authorization",
      "user-agent"
    ];
    for (let [key, value] of Object.entries(req.headers)) {
      if (
        key.toLowerCase() !== "host" &&
        allowedHeaders.includes(key.toLowerCase())
      ) {
        headers.set(key, value);
      }
    }

    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });

    const text = await response.text();

    // If the response code is anything other than a 200, check if there is a response body before parsing it.
    if (response.status !== 200) {
      const contentLength = response.headers.get("content-length");
      if (!contentLength || parseInt(contentLength, 10) === 0) {
        return res.status(response.status).json({ error: "No content returned" });
      }
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      return res.status(500).json({ error: "Invalid JSON from upstream", raw: text });
    }
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
