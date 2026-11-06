export const pdfPaperSizes = {
  A4: [210, 297], A3: [297, 420], A2: [420, 594],
  A1: [594, 841], A0: [841, 1189],
} as const;

export type PdfPaperSize = keyof typeof pdfPaperSizes | 'custom';
export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

export function pdfPageDimensions(size: PdfPaperSize, orientation: PdfOrientation, customWidth: number, customHeight: number, mapAspect: number) {
  const dimensions: readonly number[] = size === 'custom' ? [customWidth, customHeight] : pdfPaperSizes[size];
  let [width, height] = dimensions;
  if (![width, height].every(value => Number.isFinite(value) && value >= 50 && value <= 2000)) throw new Error('Informe largura e altura entre 50 e 2.000 mm.');
  const target = orientation === 'auto' ? (size === 'custom' ? width >= height : mapAspect >= 1) : orientation === 'landscape';
  if ((width >= height) !== target) [width, height] = [height, width];
  return { width, height };
}

export function pdfImagePlacement(pageWidth: number, pageHeight: number, imageWidth: number, imageHeight: number, margin = 10) {
  if (imageWidth <= 0 || imageHeight <= 0) throw new Error('A imagem do mapa está vazia.');
  const scale = Math.min((pageWidth - margin * 2) / imageWidth, (pageHeight - margin * 2) / imageHeight);
  const width = imageWidth * scale, height = imageHeight * scale;
  return { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
}
