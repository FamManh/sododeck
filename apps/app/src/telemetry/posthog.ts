import posthog from 'posthog-js';

export function initPostHog(key: string, host: string) {
  posthog.init(key, {
    api_host: host,
    cookieless_mode: 'always', // no cookies / storage; privacy-preserving hash
    person_profiles: 'never',
    // Rule 5: nothing captured automatically — autocapture could record node titles.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
  });
}
