export const IMAGE_EXTENSIONS = new Set([
	'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg', '.heic', '.heif'
]);

export function isImageFile(name: string): boolean {
	const dot = name.lastIndexOf('.');
	if (dot === -1) return false;
	return IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
}
