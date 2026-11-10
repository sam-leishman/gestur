# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.12.6 create --template minimal --types ts --add prettier eslint tailwindcss="plugins:forms" sveltekit-adapter="adapter:node" better-auth="demo:password" drizzle="database:sqlite+sqlite:better-sqlite3" --install pnpm gestur
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Accounts and roles

There is no public registration. On first launch (no users in the database) every page redirects to `/setup`, where you create the admin account. Set `SETUP_TOKEN` to require a token on that form.

- `admin`: manages users (`/admin/users`), and has access to Browse, Data, and edits to global data (subjects, fields, image titles, relinking, bulk actions).
- `user`: can draw, like, view stats, and tag images in the session modal.

Role definitions and the admin-only route lists live in `src/lib/permissions.ts`. After changing `src/lib/server/auth.ts` plugins, run `npm run auth:schema` and `npm run db:generate`.

If you lock yourself out, set a user's role directly: `UPDATE user SET role = 'admin' WHERE username = '...';`

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
