import { NextResponse } from 'next/server';

/* Alamat tidak peka huruf besar: keyboard HP sering mengetik "/Pewaris". Dialihkan ke huruf kecil. */
export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname === pathname.toLowerCase()) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = pathname.toLowerCase();
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: ['/((?!_next/|api/).*)'] };
