export default async function handler(req, res) {

    // Allow only http://localhost:* to call this route
  const origin = req.headers.origin || '';
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/i.test(origin);

  // Only set the CORS header if origin is allowed
  if (isLocalhost) {
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
    console.error("Proxy path:", path); // changed to error

    if (!path || path === "/" || path === "") {
      console.error("Proxy root path hit, returning error."); // changed to error
      return res.status(400).json({
        error:
          "This is just the root path of the proxy! It doesn't do anything on its own. You need to append the path of the 1inch API you want to talk to",
      });
    }    

    // Build the target URL
    const targetUrl = `https://api.1inch.dev/${path}`;
    console.error("Target URL:", targetUrl); // changed to error

    // Prepare headers
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${API_AUTH_TOKEN}`);

    // Copy client headers, excluding host
    for (let [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() !== "host") {
        headers.set(key, value);
      }
    }
    console.error("Request headers:", Object.fromEntries(headers.entries())); // changed to error

    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });
    console.error("Response status:", response.status); // changed to error

    // Always log the raw response body for debugging
    const text = await response.text();
    console.error("Raw response body:", text); // changed to error

    // If the response code is anything other than a 200, check if there is a response body before parsing it.
    if (response.status !== 200) {
      const contentLength = response.headers.get("content-length");
      console.error("Non-200 response, content-length:", contentLength); // changed to error
      if (!contentLength || parseInt(contentLength, 10) === 0) {
        // If there is no content in a non-200 response, return this
        return res.status(response.status).json({ error: "No content returned" });
      }
    }

    // Parse response body and return it to the caller
    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      console.error("JSON parse error:", jsonErr); // changed to error
      console.error("Upstream returned non-JSON body:", text); // extra context
      return res.status(500).json({ error: "Invalid JSON from upstream", raw: text });
    }
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Error forwarding request:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
