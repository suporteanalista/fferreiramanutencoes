const LOGO_PATH = '/Logomarca_FF_Manutencoes_-_1254x1254.png';

let cachedLogo: string | null = null;

export async function loadLogoBase64(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = new Promise<string>((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('No canvas context'); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject('Failed to load logo');
    });
    img.src = LOGO_PATH;
    cachedLogo = await loaded;
    return cachedLogo;
  } catch {
    return null;
  }
}
