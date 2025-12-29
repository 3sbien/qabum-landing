import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
    render() {
        return (
            <Html lang="en">
                <Head>
                    {/* Robust Favicon Setup */}
                    <link rel="icon" href="/qabum-mark.svg" type="image/svg+xml" />
                    <link rel="shortcut icon" href="/qabum-mark.svg" />
                    <link rel="mask-icon" href="/qabum-mark.svg" color="#0B2E6B" />
                    <meta name="theme-color" content="#0B2E6B" />

                    {/* Fonts */}
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link
                        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                        rel="stylesheet"
                    />
                </Head>
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}
