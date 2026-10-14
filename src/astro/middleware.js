/**
 * Puts the head script first in the <head> of every HTML page. Astro's own "head-inline"
 * stage puts it last, after the site's inline scripts, which must be able to read
 * window.pageturn.arrival. A response is buffered to do so.
 *
 * After <meta charset> when there is one: it must stay within the first 1024 bytes.
 * The tag is asked for per page: a page may have the morph half, another not.
 */
export function headFirst(tagFor) {
  return async (context, next) => {
    const response = await next();
    if (!response.headers.get("content-type")?.includes("text/html")) {
      return response;
    }
    const tag = tagFor(context.url.pathname);
    const text = await response.text();
    const charset = /<meta\s+charset\s*=[^>]*>/i;
    const html = charset.test(text)
      ? text.replace(charset, (meta) => meta + tag)
      : text.replace(/<head(\s[^>]*)?>/i, (opening) => opening + tag);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
