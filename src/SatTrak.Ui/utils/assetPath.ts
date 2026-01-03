export const BASE_PATH = '/SatTrak';

/**
 * Prepends the base path to a given asset path.
 * Should be used for all public folder assets (textures, data, etc.)
 */
export const assetUrl = (path: string) => {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${BASE_PATH}${cleanPath}`;
};
