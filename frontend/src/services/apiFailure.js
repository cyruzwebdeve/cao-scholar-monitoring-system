const readMethods = new Set(['GET', 'HEAD']);

export class ApiRequestError extends Error {
  constructor(kind, { method = 'GET', path = '', status, cause } = {}) {
    const read = readMethods.has(method.toUpperCase());
    const reason = kind === 'response' ? 'The service returned an unreadable response.'
      : kind === 'server' ? 'The service is temporarily unavailable.'
      : kind === 'timeout' ? 'The service took too long to respond.'
      : 'The service could not be reached.';
    const guidance = path.endsWith('/auth/login')
      ? 'Check your connection and try signing in again.'
      : !read && path.endsWith('/applications/me/exam-result')
        ? 'Your answers remain on this page. We could not confirm whether your submission was recorded. Check your connection and retry before the deadline to confirm its status.'
        : !read && path.endsWith('/applications')
          ? 'We could not confirm whether your application was recorded. Keep this form open and contact CAO before submitting again.'
          : read
            ? 'Check your connection, then use Retry or refresh this page.'
            : 'We could not confirm whether this action completed. Check your connection and reload the affected record before trying again.';
    super(`${reason} ${guidance}`, { cause });
    this.name = kind === 'timeout' ? 'TimeoutError' : 'ApiRequestError';
    this.kind = kind;
    this.status = status;
  }
}

export const normalizeApiFailure = (error, context) => {
  if (error instanceof ApiRequestError || error?.name === 'AbortError') return error;
  if (error?.name === 'TimeoutError') return new ApiRequestError('timeout', { ...context, cause: error });
  if (error instanceof TypeError) return new ApiRequestError('connection', { ...context, cause: error });
  if (error instanceof SyntaxError) return new ApiRequestError('response', { ...context, cause: error });
  return error;
};

export const protectApiResponse = (response, context) => {
  if (response.status >= 500) throw new ApiRequestError('server', { ...context, status: response.status });
  for (const method of ['json', 'blob', 'text']) {
    const readBody = response[method].bind(response);
    response[method] = async () => {
      try {
        const body = await readBody();
        if (method === 'json' && (body === null || typeof body !== 'object')) {
          throw new ApiRequestError('response', context);
        }
        return body;
      }
      catch (error) { throw normalizeApiFailure(error, context); }
    };
  }
  return response;
};
