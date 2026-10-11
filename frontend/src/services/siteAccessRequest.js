export const SITE_ACCESS_TIMEOUT_MS = 10000;
export const requestSiteAccess = async (url, options, controller, fetcher = fetch, timeoutMs = SITE_ACCESS_TIMEOUT_MS) => {
  const timer = setTimeout(() => controller.abort(new DOMException('Tester verification timed out.', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    // Keep the deadline active while reading a stalled response body too.
    const body = await response.json();
    if (controller.signal.aborted) throw controller.signal.reason;
    return { response, body };
  } finally { clearTimeout(timer); }
};
export const siteAccessFailureMessage = (error) => error?.name === 'TimeoutError'
  ? 'The access service took too long to respond. Check your connection and try again.'
  : error instanceof TypeError
    ? 'The access service could not be reached. Check your connection and try again.'
    : error instanceof SyntaxError
    ? 'The access service returned an unreadable response. Please try again.'
    : error?.message || 'The private access service is unavailable. Check your connection and try again.';
