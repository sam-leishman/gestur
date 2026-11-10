import { createAuthClient } from "better-auth/svelte";
import { usernameClient, adminClient } from "better-auth/client/plugins";
import { ac, roles } from "$lib/permissions";

export const authClient = createAuthClient({
    plugins: [usernameClient(), adminClient({ ac, roles })]
});
