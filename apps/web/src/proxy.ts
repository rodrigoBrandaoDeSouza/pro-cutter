import { NextResponse, type NextRequest } from 'next/server';

/**
 * Checagem otimista: sem cookie de sessão, manda para /entrar. A validação real (banco) acontece em
 * cada página e ação via exigirUsuario()/exigirAdmin().
 */
export function proxy(request: NextRequest) {
  const temSessao = request.cookies.has('pc_sessao');
  const { pathname, search } = request.nextUrl;
  if (!temSessao && pathname !== '/entrar') {
    const url = new URL('/entrar', request.url);
    if (pathname !== '/') url.searchParams.set('de', pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp)$).*)'],
};
