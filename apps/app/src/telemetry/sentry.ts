import * as Sentry from '@sentry/react';

export function initSentry(dsn: string) {
  Sentry.init({
    dsn,
    // Collect nothing beyond the error itself.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    // Rule 5: no diagram content. UI and console breadcrumbs can contain node titles or JSON.
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb.category?.startsWith('ui.') || breadcrumb.category === 'console'
        ? null
        : breadcrumb,
    beforeSend: (event) => {
      delete event.extra;
      delete event.contexts?.state;
      return event;
    },
  });
}
