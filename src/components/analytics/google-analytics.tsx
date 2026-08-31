import Script from 'next/script';

// Renders nothing when NEXT_PUBLIC_GA_ID is unset — safe default for dev/local, and for any
// deployment before the OWNER has created a real GA4 property (phase-7.md decision #7, Non-goals:
// Claude does not create the GA4 property itself).
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');`}
      </Script>
    </>
  );
}
