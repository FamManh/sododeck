import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/libs/I18nNavigation';

type PortfolioPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: PortfolioPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'Portfolio',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function Portfolio(props: PortfolioPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'Portfolio',
  });

  return (
    <>
      <p>{t('presentation')}</p>

      <div className="grid grid-cols-1 justify-items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Link className="hover:text-blue-700" key={i} href={`/portfolio/${i}`}>
            {t('portfolio_name', { name: i })}
          </Link>
        ))}
      </div>
    </>
  );
}
