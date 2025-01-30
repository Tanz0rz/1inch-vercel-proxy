export default async function handler(req, res) {
  const { API_AUTH_TOKEN } = process.env;

  if (!API_AUTH_TOKEN) {
    return res.status(500).json({ error: "API_AUTH_TOKEN is missing from env" });
  }

  try {
    // Remove the leading "/api/" from req.url
    // e.g. "/api/foo/bar" -> "foo/bar"
    const path = req.url.replace(/^\/api\//, '');

    console.log('Path');
    console.log(path);

    if (!path) {
      return res.status(400).json({ error: "Missing path parameter" });
    }

    // Build the target URL
    const targetUrl = `https://api.1inch.dev/${path}`;
    console.log("Forwarding request to:", targetUrl);

    // Prepare headers
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${API_AUTH_TOKEN}`);

    // Copy client headers, excluding host
    for (let [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() !== "host") {
        headers.set(key, value);
      }
    }

    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });
    
    // If the response code is anything other than a 200, check if there is a response body before parsing it. 
    // content-length is not reliable using this proxy, so we only check it when the requests errors.
    if (response.status !== 200) {
      const contentLength = response.headers.get("content-length");
      if (!contentLength || parseInt(contentLength, 10) === 0) {
        // If there is no content in a non-200 response, return this
        return res.status(response.status).json({ error: "No content returned" });
      }
    }
    
    // Parse response body and return it to the caller
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Error forwarding request:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
