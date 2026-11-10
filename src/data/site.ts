/** Repository links used by the brand page (`/brand/`). */
export const REPO = 'https://github.com/enzoftware/flutterconf_peru_2026';
export const BRANCH = 'main';

/** GitHub page for a file (`blob`) or folder (`tree`) inside the repo. */
export const gh = (path: string, kind: 'blob' | 'tree' = 'blob'): string => `${REPO}/${kind}/${BRANCH}/${path}`;

/** Site-relative URL that respects the deploy base path (`/flutterconf_peru_2026/` on GitHub Pages). */
export const url = (path = ''): string => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
