import { LIMITS } from './domain.js';

export async function readUtf8File(file) {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Invalid UTF-8. Save the file as UTF-8 and try again.');
  }
}

export async function readAgreement(file) {
  if (file.size > LIMITS.file) throw new Error('Choose an agreement file of 8 MB or less.');
  if (/\.txt$/i.test(file.name)) {
    return { name: file.name, kind: 'text', pages: [(await readUtf8File(file)).replace(/\r\n?/g, '\n')] };
  }
  if (!/\.pdf$/i.test(file.name)) throw new Error('Choose a PDF or TXT file.');
  const { getDocument, GlobalWorkerOptions } = await import('/pdfjs/pdf.mjs');
  GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false,
    cMapUrl: '/pdfjs/cmaps/', cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/',
    iccUrl: '/pdfjs/iccs/',
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > LIMITS.pages) throw new Error('Choose a PDF with 50 pages or fewer.');
    const pages = [];
    let characters = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const { items } = await page.getTextContent();
      const text = items.filter(item => 'str' in item)
        .map(item => item.str + (item.hasEOL ? '\n' : '')).join('');
      characters += text.length;
      if (characters > LIMITS.agreement) throw new Error('The extracted agreement exceeds 100,000 characters.');
      pages.push(text);
    }
    if (!pages.some(text => text.trim())) throw new Error('This PDF has no selectable text. Paste the verified agreement text to continue.');
    return { name: file.name, kind: 'pdf', pages };
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('This PDF is locked. Use an unlocked copy or paste the verified text.');
    throw error;
  } finally {
    await task.destroy();
  }
}
