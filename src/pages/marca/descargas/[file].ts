/** ZIP downloads of the design system, built at build time from `brand/`. */
import type { APIRoute, GetStaticPaths } from 'astro';
import { brandFiles, readBrand } from '../../../lib/brand';
import { zip } from '../../../lib/zip';

const BUNDLES: Record<string, { folder: string; include: (path: string) => boolean }> = {
  'chicha-dash-kit.zip': { folder: 'chicha-dash', include: () => true },
  'flutterchicha.zip': { folder: 'flutterchicha', include: (p) => p.startsWith('fonts/') },
};

export const getStaticPaths = (() => Object.keys(BUNDLES).map((file) => ({ params: { file } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const { folder, include } = BUNDLES[String(params.file)];
  const entries = brandFiles()
    .filter((f) => include(f.path))
    .map((f) => ({ name: `${folder}/${f.path}`, data: readBrand(f.path) }));
  return new Response(new Uint8Array(zip(entries)), { headers: { 'Content-Type': 'application/zip' } });
};
