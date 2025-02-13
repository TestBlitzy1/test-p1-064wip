/// <reference types="next" />
/// <reference types="next/types/global" />
/// <reference types="next/image-types/global" />

// @types/node ^20.0.0
// @types/react ^18.0.0 
// @types/react-dom ^18.0.0

// Augment process.env with Next.js environment variables
declare namespace NodeJS {
  interface ProcessEnv extends NodeJS.ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test'
    readonly NEXT_PUBLIC_VERCEL_ENV?: string
    readonly [key: `NEXT_PUBLIC_${string}`]: string | undefined
  }
}

// Next.js page component type with getInitialProps
interface NextComponentType<
  C extends BaseContext = NextPageContext,
  IP = {},
  P = {}
> extends React.ComponentType<P> {
  getInitialProps?(context: C): IP | Promise<IP>
}

// Next.js page context type
interface NextPageContext {
  req?: IncomingMessage & {
    cookies: Partial<{[key: string]: string}>
  }
  res?: ServerResponse
  pathname: string
  query: ParsedUrlQuery
  asPath?: string
  locale?: string
  locales?: string[]
  defaultLocale?: string
}

// Augment Image component props
declare module 'next/image' {
  interface ImageProps {
    priority?: boolean
    loading?: 'lazy' | 'eager'
    quality?: number | string
  }
}

// Augment Link component props
declare module 'next/link' {
  interface LinkProps {
    prefetch?: boolean
    scroll?: boolean
    shallow?: boolean
  }
}