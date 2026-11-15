import { NextResponse } from 'next/server';
import { COOKIE, IDIOMAS, idiomaDeCabecera } from './lib/i18n/config';

// "/" lleva a /es o /en: primero la preferencia guardada (cookie del selector), después el idioma del navegador.
export function middleware(request) {
  const guardado = request.cookies.get(COOKIE)?.value;
  const idioma = IDIOMAS.includes(guardado) ? guardado : idiomaDeCabecera(request.headers.get('accept-language') ?? '');
  return NextResponse.redirect(new URL(`/${idioma}${request.nextUrl.search}`, request.url));
}

export const config = { matcher: ['/'] };
