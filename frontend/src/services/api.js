export const API_BASE = import.meta.env?.VITE_API_BASE || 'http://localhost:3601/api';

export const SITE_ACCESS_TOKEN_KEY = 'pgceapSiteAccessToken';
export const SITE_ACCESS_REQUIRED_EVENT = 'pgceap:site-access-required';

export const saveSiteAccessToken = (token, storage = window.sessionStorage) => {
  if (token) storage.setItem(SITE_ACCESS_TOKEN_KEY, token);
  else storage.removeItem(SITE_ACCESS_TOKEN_KEY);
};

export const installSiteAccessFetch = ({ windowObject = window } = {}) => {
  if (windowObject.__pgceapSiteAccessFetchInstalled) return;
  const originalFetch = windowObject.fetch.bind(windowObject);
  const normalizedApiBase = new URL(API_BASE, windowObject.location.href).href.replace(/\/$/, '');

  windowObject.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const absoluteUrl = new URL(requestUrl, windowObject.location.href).href;
    const isApiRequest = absoluteUrl === normalizedApiBase || absoluteUrl.startsWith(`${normalizedApiBase}/`);
    const options = { ...init };

    if (isApiRequest) {
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init.headers || {}).forEach((value, name) => headers.set(name, value));
      const token = windowObject.sessionStorage.getItem(SITE_ACCESS_TOKEN_KEY);
      if (token) headers.set('X-Site-Access-Token', token);
      options.headers = headers;
    }

    const response = await originalFetch(input, options);
    if (isApiRequest && response.headers.get('X-Site-Access-Required') === 'true') {
      windowObject.sessionStorage.removeItem(SITE_ACCESS_TOKEN_KEY);
      windowObject.dispatchEvent(new CustomEvent(SITE_ACCESS_REQUIRED_EVENT));
    }
    return response;
  };

  windowObject.__pgceapSiteAccessFetchInstalled = true;
};

export const authHeaders = (token) => {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
