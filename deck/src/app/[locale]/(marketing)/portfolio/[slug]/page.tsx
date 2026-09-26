import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/libs/I18nRouting';

type PortfolioDetailPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    Array.from({ length: 6 }, (_, i) => ({
      slug: `${i}`,
      locale,
    })),
  );
}

export async function generateMetadata(props: PortfolioDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'PortfolioSlug',
  });

  return {
    title: t('meta_title', { slug }),
    description: t('meta_description', { slug }),
  };
}

export default async function PortfolioDetail(props: PortfolioDetailPageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'PortfolioSlug',
  });

  return (
    <>
      <h1 className="capitalize">{t('header', { slug })}</h1>
      <p>{t('content')}</p>
    </>
  );
}

export const dynamicParams = false;
