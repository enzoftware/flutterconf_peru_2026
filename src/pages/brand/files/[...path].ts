/** Serves the published files of `brand/` at /brand/files/<path> (static, generated at build time). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { brandFiles, contentType, readBrand } from '../../../lib/brand';

export const getStaticPaths = (() => brandFiles().map((f) => ({ params: { path: f.path } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const path = String(params.path);
  return new Response(new Uint8Array(readBrand(path)), { headers: { 'Content-Type': contentType(path) } });
};
