import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { env } from '$env/dynamic/private';

// =================================================================================================================================
// Local Dev: Gets vars from .env, falls back to DEV_MOUNTS
// Production (Docker): Uses /data and /images (directories in the container)
//     - DOCKER_MOUNTS is the host side of the mount (set in compose.yaml) for testing, and /data and /images are the container side
// =================================================================================================================================

const isProduction = env.NODE_ENV === 'production';

function getOrCreateSecret(): string {
    if (env.BETTER_AUTH_SECRET) {
        return env.BETTER_AUTH_SECRET;
    }

    const dataDir = env.DATA_DIR || (isProduction ? '/data' : resolve(process.cwd(), 'DEV_MOUNTS/data'));
    const secretPath = resolve(dataDir, '.auth-secret');
    
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    if (existsSync(secretPath)) {
        return readFileSync(secretPath, 'utf-8').trim();
    } else {
        const newSecret = randomBytes(32).toString('hex');
        writeFileSync(secretPath, newSecret, { mode: 0o600 });
        console.log(`[Auth] Generated new auth secret at ${secretPath}`);
        return newSecret;
    }
}

export const config = {
    database: {
        url: env.DATABASE_URL || (isProduction ? '/data/gestur.db' : resolve(process.cwd(), 'DEV_MOUNTS/data/gestur.db'))
    },
    paths: {
        images: env.IMAGE_DIR || (isProduction ? '/images' : resolve(process.cwd(), 'DEV_MOUNTS/images')),
        data: env.DATA_DIR || (isProduction ? '/data' : resolve(process.cwd(), 'DEV_MOUNTS/data')),
    },
    server: {
        port: parseInt(env.PORT || (isProduction ? '3000' : '5173')),
    },
    auth: {
        secret: getOrCreateSecret(),
        origin: env.ORIGIN || (isProduction ? 'http://localhost:3000' : 'http://localhost:5173'),
    },
} as const;
