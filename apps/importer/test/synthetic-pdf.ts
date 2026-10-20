/**
 * PDF sintético para testes (Helvetica, WinAnsi): cada página é uma lista de linhas posicionadas. Só caracteres Latin-1, que o
 * WinAnsi codifica com o mesmo byte; nenhum dado real.
 */
export type SyntheticLine = { x: number; y: number; text: string };

function pdfString(text: string) {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code > 0xff) throw new Error(`Caractere fora do Latin-1 no PDF sintético: ${char}.`);
    out += code > 0x7e || '()\\'.includes(char) ? `\\${code.toString(8).padStart(3, '0')}` : char;
  }
  return out;
}

export function syntheticPdf(pages: SyntheticLine[][]): Buffer {
  const contents = pages.map((lines) => Buffer.from(['BT /F1 11 Tf', ...lines.map((line) => `1 0 0 1 ${line.x} ${line.y} Tm (${pdfString(line.text)}) Tj`), 'ET'].join('\n'), 'latin1'));
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from(`<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + 2 * index} 0 R`).join(' ')}] /Count ${pages.length} >>`),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    ...contents.flatMap((content, index) => [
      Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * index} 0 R >>`),
      Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]),
    ]),
  ];
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  const offsets: number[] = [];
  let length = parts[0]!.length;
  objects.forEach((object, index) => {
    const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')]);
    offsets.push(length); parts.push(part); length += part.length;
  });
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
    + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(parts);
}
