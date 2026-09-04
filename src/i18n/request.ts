import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import viMessages from '../../messages/vi.json';
import enMessages from '../../messages/en.json';

const messagesByLocale = {
  vi: viMessages,
  en: enMessages,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Static imports make both catalogs explicit build dependencies. A template-string dynamic
    // import compiled successfully but the production server later tried to resolve `./vi.json`
    // from a generated chunk and failed at runtime.
    messages: messagesByLocale[locale],
  };
});
