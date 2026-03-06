/**
 * regexFallback.ts
 *
 * Fallback de extração por regex para marcadores que a IA frequentemente perde.
 * Extraído do index.ts para manter o orquestrador enxuto.
 */

import { parseBrNum } from "./utils.ts";

/**
 * Tenta extrair marcadores adicionais do texto do PDF via regex.
 * Complementa os resultados da IA com marcadores que foram perdidos.
 */
export function regexFallback(pdfText: string, aiResults: any[]): any[] {
  const found = new Set(aiResults.map(r => r.marker_id));
  const additional: any[] = [];

  // Helper: processar valor capturado (trata "inferior a", "superior a", operadores)
  function processValue(id: string, rawVal: string): void {
    const valStr = rawVal.trim();

    const infMatch = valStr.match(/^inferior\s+a\s+([\d,\.]+)/i);
    if (infMatch) {
      const num = parseBrNum(infMatch[1]);
      if (!isNaN(num)) {
        additional.push({ marker_id: id, value: num, text_value: `< ${num}` });
        found.add(id);
        console.log(`Regex fallback ${id}: < ${num}`);
        return;
      }
    }

    const supMatch = valStr.match(/^superior\s+a\s+([\d,\.]+)/i);
    if (supMatch) {
      const num = parseBrNum(supMatch[1]);
      if (!isNaN(num)) {
        additional.push({ marker_id: id, value: num, text_value: `> ${num}` });
        found.add(id);
        console.log(`Regex fallback ${id}: > ${num}`);
        return;
      }
    }

    const opMatch = valStr.match(/^([<>≤≥]=?)\s*([\d,\.]+)/);
    if (opMatch) {
      const num = parseBrNum(opMatch[2]);
      if (!isNaN(num)) {
        additional.push({ marker_id: id, value: num, text_value: `${opMatch[1]} ${num}` });
        found.add(id);
        console.log(`Regex fallback ${id}: ${opMatch[1]} ${num}`);
        return;
      }
    }

    const num = parseBrNum(valStr);
    if (!isNaN(num) && num >= 0) {
      additional.push({ marker_id: id, value: num });
      found.add(id);
      console.log(`Regex fallback ${id}: ${num}`);
    }
  }

  /**
   * Padrão principal Fleury: valor aparece DEPOIS de "VALOR(ES) DE REFERÊNCIA\n\n"
   */
  function tryFleury(id: string, examRegex: string, valueRegex: string): boolean {
    if (found.has(id)) return false;
    const pat = new RegExp(
      examRegex + '[\\s\\S]{0,500}?VALOR(?:ES)?\\s+DE\\s+REFER[EÊ]NCIA\\s*\\n\\s*\\n\\s*' + valueRegex,
      'i'
    );
    const m = pdfText.match(pat);
    if (m && m[1]) {
      processValue(id, m[1]);
      return found.has(id);
    }
    return false;
  }

  const NUM = '([\\d,\\.]+)';
  const OP_NUM = '(inferior\\s+a\\s+[\\d,\\.]+|superior\\s+a\\s+[\\d,\\.]+|[<>]\\s*[\\d,\\.]+|[\\d,\\.]+)';

  // =============================================
  // NUMÉRICOS — Padrão Fleury (valor após VALORES DE REFERÊNCIA)
  // =============================================

  // VHS — padrão especial (PRIMEIRA HORA : valor)
  if (!found.has('vhs')) {
    const m = pdfText.match(/HEMOSSEDIMENTA[CÇ][AÃ]O[\s\S]{0,500}?PRIMEIRA\s+HORA\s*[:\s]*(\d+)/i);
    if (m) { processValue('vhs', m[1]); }
  }

  // T4 Total — TIROXINA (T4) sem LIVRE
  tryFleury('t4_total', 'TIROXINA\\s*\\(T4\\)(?!.*LIVRE)', NUM);
  tryFleury('t3_total', 'TRIIODOTIRONINA\\s*\\(T3\\)(?!.*LIVRE)', NUM);
  tryFleury('estrona', 'ESTRONA', NUM);
  tryFleury('amh', 'ANTI[- \\u00ad]?M[UÜ]LLERIANO', NUM);
  tryFleury('aldosterona', 'ALDOSTERONA', NUM);
  tryFleury('vitamina_d_125', '1[,.]25[- ]?DIHIDROXIVITAMINA', NUM);
  tryFleury('magnesio', 'MAGN[EÉ]SIO', NUM);
  tryFleury('selenio', 'SEL[EÊ]NIO', NUM);
  tryFleury('cromo', 'CROMO', OP_NUM);
  tryFleury('fosfatase_alcalina', 'FOSFATASE\\s+ALCALINA', NUM);
  tryFleury('sodio', 'S[OÓ]DIO', NUM);
  tryFleury('potassio', 'POT[AÁ]SSIO', NUM);
  tryFleury('fosforo', 'F[OÓ]SFORO', NUM);
  tryFleury('calcitonina', 'CALCITONINA', OP_NUM);
  tryFleury('anti_tpo', 'ANTICORPOS?\\s+ANTI[- ]?PEROXIDASE(?:\\s+TI(?:R|REOI)DIANA)?|ANTI[- ]?PEROXIDASE', OP_NUM);
  tryFleury('anti_tg', 'ANTICORPOS?\\s+ANTI[- ]?TIREOGLOBULINA|ANTICORPOS?\\s+ANTITIROGLOBULINA|ANTITIROGLOBULINA', OP_NUM);
  tryFleury('trab', 'ANTI[- ]?RECEPTOR\\s+DE\\s+TSH', OP_NUM);
  tryFleury('tiroglobulina', 'TIREOGLOBULINA(?!\\s*ANTI)|TIROGLOBULINA(?!\\s*ANTI)', NUM);
  tryFleury('glicose_jejum', 'GLICOSE[\\s,]{0,20}(?:plasma|soro)', NUM);
  tryFleury('glicemia_media_estimada', 'GLICEMIA\\s+M[EÉ]DIA\\s+ESTIMADA|eAG', NUM);
  tryFleury('insulina_jejum', 'INSULINA[\\s,]{0,20}soro', NUM);
  tryFleury('acido_folico', '[AÁ]CIDO\\s+F[OÓ]LICO', OP_NUM);
  tryFleury('homocisteina', 'HOMOCISTE[IÍ]NA', NUM);

  // Ferro do painel Metabolismo do Ferro (Fleury)
  if (!found.has('ferro_metabolismo')) {
    const m = pdfText.match(/Metabolismo\s+do\s+Ferro[\s\S]{0,200}?\nFerro\s*\n[\s\S]{0,50}?\n(\d[\d,\.]*)/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 10 && num <= 500) {
        additional.push({ marker_id: 'ferro_metabolismo', value: num });
        found.add('ferro_metabolismo');
        console.log(`Regex fallback ferro_metabolismo: ${num}`);
      }
    }
  }

  // Capacidade de Fixação Latente do Ferro (UIBC)
  if (!found.has('fixacao_latente_ferro')) {
    const m = pdfText.match(/Capacidade\s+de\s+Fixa[cç][aã]o\s+Latente(?:\s+do)?\s*\nFerro\s*\n([\d,\.]+)/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 10 && num <= 600) {
        additional.push({ marker_id: 'fixacao_latente_ferro', value: num });
        found.add('fixacao_latente_ferro');
        console.log(`Regex fallback fixacao_latente_ferro: ${num}`);
      }
    } else {
      const m2 = pdfText.match(/Capacidade\s+de\s+Fixa[cç][aã]o\s+Latente[\s\S]{0,100}?([\d,\.]+)\s*µg\/dL/i);
      if (m2 && m2[1]) {
        const num = parseFloat(m2[1].replace(',', '.'));
        if (!isNaN(num) && num >= 10 && num <= 600) {
          additional.push({ marker_id: 'fixacao_latente_ferro', value: num });
          found.add('fixacao_latente_ferro');
          console.log(`Regex fallback2 fixacao_latente_ferro: ${num}`);
        }
      }
    }
  }

  // Testosterona Biodisponível
  if (!found.has('testosterona_biodisponivel')) {
    const m = pdfText.match(/Testosterona\s+Biodispon[ií]vel[\s\S]{0,50}?\n([\d,\.]+)\s*ng\/dL/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 0 && num <= 500) {
        additional.push({ marker_id: 'testosterona_biodisponivel', value: num });
        found.add('testosterona_biodisponivel');
        console.log(`Regex fallback testosterona_biodisponivel: ${num}`);
      }
    } else {
      const m2 = pdfText.match(/Testosterona\s+Biodispon[ií]vel[\s\S]{0,300}?([\d,\.]+)\s*ng\/dL/i);
      if (m2 && m2[1]) {
        const num = parseFloat(m2[1].replace(',', '.'));
        if (!isNaN(num) && num >= 0 && num <= 500) {
          additional.push({ marker_id: 'testosterona_biodisponivel', value: num });
          found.add('testosterona_biodisponivel');
          console.log(`Regex fallback2 testosterona_biodisponivel: ${num}`);
        }
      }
    }
  }

  // Cobalto
  if (!found.has('cobalto')) {
    const m = pdfText.match(/Cobalto[\s\S]{0,100}?[Aa]t[eé]\s+[\d,\.]+\s*µg\/L\s*\n([\d,\.]+)/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 0 && num <= 100) {
        additional.push({ marker_id: 'cobalto', value: num });
        found.add('cobalto');
        console.log(`Regex cobalto: ${num}`);
      }
    } else {
      tryFleury('cobalto', 'COBALTO', OP_NUM);
    }
  }

  // Arsênico
  if (!found.has('arsenico')) {
    const m = pdfText.match(/(?:Dosagem\s+de\s+)?Ars[eê]nico[\s\S]{0,200}?[Aa]t[eé]\s+[\d,\.]+\s*mcg\/L\s*\n(Inferior\s+a\s+[\d,\.]+|[<>]?\s*[\d,\.]+)/i);
    if (m && m[1]) {
      processValue('arsenico', m[1].trim());
      console.log(`Regex arsenico: ${m[1].trim()}`);
    } else {
      const m2 = pdfText.match(/(?:Dosagem\s+de\s+)?Ars[eê]nico[\s\S]{0,300}?(Inferior\s+a\s+[\d,\.]+|[<>]?\s*[\d,\.]+)\s*mcg\/L/i);
      if (m2 && m2[1]) {
        processValue('arsenico', m2[1].trim());
        console.log(`Regex fallback arsenico: ${m2[1].trim()}`);
      }
    }
  }

  // Níquel
  if (!found.has('niquel')) {
    const m = pdfText.match(/(?:Dosagem\s+de\s+)?N[ií]quel[\s\S]{0,50}?\n([\d,\.]+)\s*µg\/L/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 0 && num <= 100) {
        additional.push({ marker_id: 'niquel', value: num });
        found.add('niquel');
        console.log(`Regex niquel: ${num}`);
      }
    } else {
      tryFleury('niquel', 'N[IÍ]QUEL', OP_NUM);
    }
  }

  // Urina quantitativa — Sedimento Quantitativo (Fleury)
  if (!found.has('urina_leucocitos_quant') || !found.has('urina_hemacias_quant')) {
    const sedMatch = pdfText.match(/Sedimento\s+Quantitativo[\s\S]{0,800}/i);
    if (sedMatch) {
      const seg = sedMatch[0];
      const numPattern = /([\d.]+(?:[.,]\d+)?)\s*\/mL/gi;
      const nums: number[] = [];
      let nm: RegExpExecArray | null;
      while ((nm = numPattern.exec(seg)) !== null) {
        const cleaned = nm[1].replace(/\.(\d{3})/g, '$1').replace(',', '.');
        const v = parseFloat(cleaned);
        if (!isNaN(v) && v >= 0) nums.push(v);
      }
      console.log('Sedimento Quantitativo nums:', nums);
      if (nums.length >= 1 && !found.has('urina_leucocitos_quant')) {
        additional.push({ marker_id: 'urina_leucocitos_quant', value: nums[0] });
        found.add('urina_leucocitos_quant');
        console.log('Regex urina_leucocitos_quant: ' + nums[0]);
      }
      if (nums.length >= 2 && !found.has('urina_hemacias_quant')) {
        additional.push({ marker_id: 'urina_hemacias_quant', value: nums[1] });
        found.add('urina_hemacias_quant');
        console.log('Regex urina_hemacias_quant: ' + nums[1]);
      }
    }
  }

  tryFleury('ca_19_9', 'CA\\s*19[.-]9', NUM);
  tryFleury('ca_125', 'CA[- ]?125', NUM);
  tryFleury('ca_72_4', 'CA\\s*72[.-]4', OP_NUM);
  tryFleury('ca_15_3', 'CA\\s*15[.-]3', NUM);
  tryFleury('afp', 'ALFA[- ]?FETOPROTE[IÍ]NA', NUM);
  tryFleury('cea', 'CARCINOEMBRION[IÍA]', NUM);

  // =============================================
  // EXCEÇÕES — padrões diferentes do padrão Fleury
  // =============================================

  // HbA1c
  if (!found.has('hba1c')) {
    const m = pdfText.match(/HEMOGLOBINA\s+GLICADA[\s\S]{0,300}?RESULTADO\s*\n\s*([\d,\.]+)\s*%/i);
    if (m) { processValue('hba1c', m[1]); }
  }

  // IGFBP-3
  if (!found.has('igfbp3')) {
    const m = pdfText.match(/IGFBP[- ]?3[\s\S]{0,300}?RESULTADO\s*\n\s*\n\s*([\d,\.]+)/i);
    if (m) {
      const num = parseBrNum(m[1]);
      if (!isNaN(num)) {
        const converted = num > 100 ? num / 1000 : num;
        additional.push({ marker_id: 'igfbp3', value: converted });
        found.add('igfbp3');
        console.log(`Regex fallback igfbp3: ${num} ng/mL → ${converted} µg/mL`);
      }
    }
  }

  // PTH
  if (!found.has('pth')) {
    const m = pdfText.match(/PARATORM[OÔ]NIO[\s\S]{0,500}?VALOR(?:ES)?\s+DE\s+REFERE[NÊ]CIA\s*\n[\s\S]{0,50}?\n\s*\n\s*([\d,\.]+)/i);
    if (m) { processValue('pth', m[1]); }
  }

  // =============================================
  // FALLBACK GENÉRICO
  // =============================================

  function tryGeneric(id: string, patterns: RegExp[]): boolean {
    if (found.has(id)) return false;
    for (const pat of patterns) {
      const match = pdfText.match(pat);
      if (match && match[1]) {
        processValue(id, match[1].trim());
        if (found.has(id)) return true;
      }
    }
    return false;
  }

  // Generic fallbacks for non-Fleury formats
  tryGeneric('vhs', [
    /V\.?H\.?S\.?[\s\S]{0,200}?RESULTADO[\s:]*(\d+)/i,
    /(?:Hemossedimenta[çc][ãa]o|HEMOSSEDIMENTACAO)[^0-9]*?(\d+)\s*(?:mm)/i,
  ]);
  tryGeneric('t4_total', [/(?:T4\s+Total|Tiroxina\s+Total)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('t3_total', [/(?:T3\s+Total|Triiodotironina\s+Total)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('estrona', [/(?:Estrona|ESTRONA\s*\(E1\))[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('amh', [/(?:AMH|Anti[- ]?M[üuÜU]lleriano|HAM)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('aldosterona', [/(?:Aldosterona)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_d_125', [/(?:1[,.]25[- ]?(?:Di)?[Hh]idroxi)[^0-9]*?(\d+[.,]\d+)/i]);
  tryGeneric('magnesio', [/(?:Magn[éeÉE]sio)[\s:.\-]*?(\d[.,]\d)/i]);
  tryGeneric('selenio', [/(?:Sel[êeÊE]nio)[\s:.\-]*?(\d{2,3})/i]);
  tryGeneric('cromo', [/(?:Cromo)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('fosfatase_alcalina', [/(?:Fosfatase\s+Alcalina)[\s:.\-]*?(\d+)/i]);
  tryGeneric('sodio', [/(?:S[óoÓO]dio)[\s:.\-]*?(1[0-9]{2})/i]);
  tryGeneric('potassio', [/(?:Pot[áaÁA]ssio)[\s:.\-]*?(\d[.,]\d)/i]);
  tryGeneric('fosforo', [/(?:F[óoÓO]sforo)[\s:.\-]*?(\d[.,]\d)/i]);
  tryGeneric('calcitonina', [/(?:Calcitonina)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]\s*\d+[.,]?\d*|\d+[.,]?\d*)/i]);
  tryGeneric('anti_tpo', [
    /(?:Anti[- ]?TPO|ANTI[- ]?PEROXIDASE(?:\s+TI(?:R|REOI)DIANA)?|ANTICORPOS?\s+ANTI[- ]?PEROXIDASE|ATPO|TPO[- ]?Ab)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]\s*\d+[.,]?\d*|\d+[.,]?\d*)/i,
  ]);
  tryGeneric('anti_tg', [
    /(?:Anti[- ]?TG|ANTICORPOS?\s+ANTI[- ]?TIREOGLOBULINA|ANTICORPOS?\s+ANTITIROGLOBULINA|ANTITIROGLOBULINA|ATG|TgAb)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]\s*\d+[.,]?\d*|\d+[.,]?\d*)/i,
  ]);
  tryGeneric('trab', [/(?:TRAb|TRAB)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]\s*\d+[.,]?\d*|\d+[.,]?\d*)/i]);
  tryGeneric('tiroglobulina', [
    /(?:TIREOGLOBULINA|TIROGLOBULINA)(?!\s*(?:ANTI|anti))[\s:.\-]*?(\d+[.,]?\d*)/i,
  ]);
  tryGeneric('hba1c', [/(?:HEMOGLOBINA\s+GLICADA|HbA1c)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('glicemia_media_estimada', [/(?:GLICEMIA\s+M[EÉ]DIA\s+ESTIMADA|eAG|Estimated\s+Average\s+Glucose)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('glicose_jejum', [/(?:GLICOSE|GLICEMIA)[\s:.\-]*?(\d{2,3})\s*mg/i]);
  tryGeneric('insulina_jejum', [/(?:INSULINA)[\s,]*(?:soro|BASAL)?[\s\S]*?(?:RESULTADO|:)\s*(\d+[.,]?\d*)/i]);
  tryGeneric('acido_folico', [
    /(?:Vitamina\s+B9\s*\([^)]*\)|[ÁAáa]cido\s+F[óoÓO]lico|Folato)[\s\S]{0,50}?(\d+[.,]?\d*)\s*ng\/mL/i,
    /(?:[ÁAáa]cido\s+F[óoÓO]lico|Folato)[\s:.\-]*?(superior\s+a\s+[\d,\.]+|inferior\s+a\s+[\d,\.]+|[<>]?\s*\d+[.,]?\d*)/i
  ]);
  // IGF-1 generic fallback
  if (!found.has('igf1')) {
    const igf1Patterns = [
      /(?:IGF[- ]?1|Somatomedina\s+C)[\s\S]{0,80}?(\d{2,3}[.,]?\d*)\s*ng\/mL/i,
      /(?:IGF[- ]?1|IGF\s+I|FATOR\s+DE\s+CRESCIMENTO\s+INSULINO)[\s:.\-]*?(\d{2,3}[.,]?\d*)/i,
    ];
    for (const pat of igf1Patterns) {
      const m = pdfText.match(pat);
      if (m) {
        const num = parseBrNum(m[1]);
        if (!isNaN(num) && num >= 20 && num <= 1000) {
          additional.push({ marker_id: 'igf1', value: num });
          found.add('igf1');
          console.log(`Regex fallback igf1 (generic): ${num}`);
          break;
        }
      }
    }
  }
  tryGeneric('homocisteina', [/(?:Homociste[íi]na)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('pth', [/(?:PTH|PARATORM[OÔ]NIO)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  
  // Tumor markers generic
  tryGeneric('ca_19_9', [/(?:CA\s*19[.\-]9)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('ca_125', [/(?:CA[- ]?125)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('ca_72_4', [/(?:CA\s*72[.\-]4)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('ca_15_3', [/(?:CA\s*15[.\-]3)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('afp', [/(?:AFP|Alfafetoprote[íi]na)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('cea', [/(?:CEA|Ant[íi]geno\s+Carcinoembrion[áa]rio)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);

  // Additional commonly missed (generic)
  tryGeneric('vitamina_a', [/(?:Vitamina\s+A|Retinol)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_c', [/(?:Vitamina\s+C|[ÁAáa]cido\s+Asc[óo]rbico)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('bilirrubina_total', [/(?:Bilirrubina\s+Total)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('bilirrubina_direta', [/(?:Bilirrubina\s+Direta)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('bilirrubina_indireta', [/(?:Bilirrubina\s+Indireta)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('albumina', [/(?:Albumina)[\s:.\-]*?(\d+[.,]?\d*)\s*(?:g\/dL)/i]);
  tryGeneric('proteinas_totais', [/(?:Prote[íi]nas\s+Totais)[\s:.\-]*?(\d[.,]\d+)/i]);
  tryGeneric('ldh', [/(?:LDH|LACTATO\s+DESIDROGENASE|DESIDROGENASE\s+L[AÁ]TICA)[\s:.\-]*?(\d+)/i]);
  tryGeneric('creatinina', [/(?:Creatinina)[\s:.\-]*?(\d+[.,]?\d*)\s*(?:mg\/dL)/i]);
  tryGeneric('acido_urico', [/(?:[ÁAáa]cido\s+[ÚUúu]rico)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('tfg', [/(?:TFG|CKD[- ]?EPI|eGFR|Filtra[çc][ãa]o\s+Glomerular)[\s:.\-]*?([<>≥≤]?\s*\d+)/i]);
  tryGeneric('dimeros_d', [/(?:D[íi]meros?\s*D|D[- ]?D[íi]mero|FRAGMENTO\s+D)[\s:.\-]*?([<>]?\s*\d+)/i]);
  tryGeneric('cloro', [/(?:Cloro|CLORO|Cloreto)[\s:.\-]*?(\d{2,3})/i]);
  tryGeneric('bicarbonato', [/(?:Bicarbonato|CO2\s*Total)[\s:.\-]*?(\d+[.,]?\d*)/i]);

  // IGFBP-3 generic fallback
  if (!found.has('igfbp3')) {
    const igfPatterns = [
      /(?:IGFBP[- ]?3|PROTEINA\s+LIGADORA[- ]?3\s+DO\s+FATOR)[\s\S]{0,500}?RESULTADO\s*[:\s]*([\d.,]+)/i,
      /IGFBP[- ]?3[\s\S]*?(?:RESULTADO|:)\s*([\d.,]+)\s*ng\/mL/i,
    ];
    for (const pat of igfPatterns) {
      const m = pdfText.match(pat);
      if (m) {
        const num = parseBrNum(m[1]);
        if (!isNaN(num) && num > 0) {
          const converted = num > 100 ? num / 1000 : num;
          additional.push({ marker_id: 'igfbp3', value: converted });
          found.add('igfbp3');
          console.log(`Regex fallback igfbp3 (generic): ${num} → ${converted}`);
          break;
        }
      }
    }
  }

  // Additional generic fallbacks
  tryGeneric('ferro_serico', [/(?:Ferro\s+S[ée]rico|FERRO,?\s*SORO|SIDEREMIA)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('transferrina', [/(?:Transferrina)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('sat_transferrina', [/(?:Satura[çc][ãa]o\s+(?:da?\s+)?Transferrina|[ÍI]ndice\s+de\s+Satura[çc][ãa]o|IST)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('tibc', [/(?:TIBC|Capacidade\s+Total\s+(?:de\s+)?(?:Fixa[çc][ãa]o|Liga[çc][ãa]o)\s+(?:do\s+)?Ferro|CTFF|CTLF|Capacidade\s+Ferrop[ée]xica)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('ureia', [/(?:Ur[ée]ia|UREIA,?\s*SORO)[\s:.\-]*?(\d+[.,]?\d*)\s*(?:mg\/dL)?/i]);
  tryGeneric('cistatina_c', [/(?:Cistatina\s+C)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('calcio_total', [/(?:C[áa]lcio\s+Total|C[áa]lcio,?\s*soro)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('calcio_ionico', [/(?:C[áa]lcio\s+I[ôo]ni(?:co|z[áa]vel)|Ca\s*\+\+|Ca2\+|iCa)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('cobre', [/(?:Cobre)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('manganes', [/(?:Mangan[êe]s)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('iodo_urinario', [/(?:Iodo\s+Urin[áa]rio)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_e', [/(?:Vitamina\s+E)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_b6', [/(?:Vitamina\s+B6|Piridoxina)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_b1', [/(?:Vitamina\s+B1(?!\d)|Tiamina)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('fator_reumatoide', [/(?:Fator\s+Reumat[óo]ide|FR)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('anti_transglutaminase_iga', [/(?:Anti[- ]?Transglutaminase|tTG\s*IgA)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('g6pd', [/(?:G6PD|Glicose[- ]?6[- ]?Fosfato)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('chumbo', [/(?:Chumbo|PLUMBEMIA|Pb\s+SANGUE)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('mercurio', [/(?:Merc[úu]rio(?:\s+(?:Total|Sangue))?)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('cadmio', [/(?:C[áa]dmio)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('aluminio', [/(?:Alum[íi]nio)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('dihidrotestosterona', [/(?:Di?hidrotestosterona|DHT|D\.?H\.?T\.?|5[- ]?[Aa]lfa[- ]?DHT)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('androstenediona', [/(?:Androstenediona|Delta\s*4\s*Androstenediona)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('cortisol_livre_urina', [/(?:Cortisol\s+Livre.*?[Uu]rina|CLU|Cortisol\s+Urin[áa]rio)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('testosterona_biodisponivel', [/(?:Testosterona\s+Biodispon[ií]vel)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('anti_hbs', [/(?:Anti[- ]?HBs)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('psa_total', [/(?:PSA\s+Total)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('psa_livre', [/(?:PSA\s+Livre)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  
  tryGeneric('urina_albumina', [/(?:Albumina\s*(?:\(urina\)|urin[áa]ria)|Microalbumin[úu]ria)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('urina_creatinina', [/(?:Creatinina\s*(?:\(urina\)|urin[áa]ria))[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('urina_acr', [/(?:Raz[ãa]o\s+Albumina\s*\/\s*Creatinina|RAC|ACR)[\s:.\-]*?(\d+[.,]?\d*)/i]);

  // === URINA TIPO I — formato em colunas do Fleury ===
  const urinaMatch = pdfText.match(/URINA\s+(?:TIPO\s+)?I(?:[\s,]|$)[\s\S]{0,5000}/i);
  if (urinaMatch) {
    const u = urinaMatch[0].substring(0, 3000);

    // BLOCO 1: EXAME FÍSICO
    const fisicoMatch = u.match(
      /EXAME\s+F[IÍ]SICO[\s\S]{0,500}?(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)/i
    );
    if (fisicoMatch) {
      const fisicoFields: [string, number, boolean][] = [
        ['urina_cor', 1, false], ['urina_aspecto', 2, false],
        ['urina_ph', 3, true], ['urina_densidade', 4, true]
      ];
      for (const [markerId, groupIdx, isNumeric] of fisicoFields) {
        if (!found.has(markerId)) {
          const val = fisicoMatch[groupIdx].replace(/^:\s*/, '').trim();
          if (val.length > 0 && val.length < 100) {
            if (isNumeric) {
              const num = parseBrNum(val);
              if (!isNaN(num)) {
                additional.push({ marker_id: markerId, value: num });
                found.add(markerId);
                console.log(`Regex fallback ${markerId}: ${num}`);
              }
            } else {
              additional.push({ marker_id: markerId, value: 0, text_value: val });
              found.add(markerId);
              console.log(`Regex fallback ${markerId}: "${val}"`);
            }
          }
        }
      }
    }

    // BLOCO 2: PROTEÍNAS a NITRITO
    const protMatch = u.match(
      /PROTE[IÍ]NAS\s*\n\s*GLICOSE\s*\n[\s\S]{0,200}?(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)/i
    );
    if (protMatch) {
      const protFields: [string, number][] = [
        ['urina_proteinas', 1], ['urina_glicose', 2], ['urina_cetona', 3],
        ['urina_bilirrubina', 4], ['urina_urobilinogenio', 5], ['urina_nitritos', 6]
      ];
      for (const [markerId, groupIdx] of protFields) {
        if (!found.has(markerId)) {
          const val = protMatch[groupIdx].replace(/^:\s*/, '').trim();
          if (val.length > 0 && val.length < 150) {
            additional.push({ marker_id: markerId, value: 0, text_value: val });
            found.add(markerId);
            console.log(`Regex fallback ${markerId}: "${val}"`);
          }
        }
      }
    }

    // BLOCO 3: ELEMENTOS FIGURADOS
    const elemFields: [string, RegExp][] = [
      ['urina_celulas', /C[EÉ]LULAS\s+EPITELIAIS\s*:\s*([^\n]+)/i],
      ['urina_leucocitos', /LEUC[OÓ]CITOS\s*\n\s*:\s*([^\n]+)/i],
      ['urina_hemacias', /ERITR[OÓ]CITOS\s*\n\s*:\s*([^\n]+)/i],
      ['urina_cilindros', /CILINDROS\s*\n\s*:\s*([^\n]+)/i],
    ];
    for (const [markerId, pattern] of elemFields) {
      if (!found.has(markerId)) {
        const match = u.match(pattern);
        if (match && match[1]) {
          const val = match[1].trim();
          if (val.length > 0 && val.length < 150) {
            additional.push({ marker_id: markerId, value: 0, text_value: val });
            found.add(markerId);
            console.log(`Regex fallback ${markerId}: "${val}"`);
          }
        }
      }
    }
  }

  // Fallback genérico de urina para labs não-Fleury
  if (/(?:URINA\s+TIPO|EAS|URIN[ÁA]LISE|PARCIAL\s+DE\s+URINA|URINA\s+ROTINA|URINA\s+I\b)/i.test(pdfText)) {
    if (!found.has('urina_densidade')) {
      const m = pdfText.match(/(?:Densidade)[\s:.\-]*?(1[.,]\d{3}|1[.,]0\d{2})/i);
      if (m) {
        const densStr = m[1].replace(',', '.');
        const densVal = parseFloat(densStr);
        if (densVal >= 1.000 && densVal <= 1.060) {
          additional.push({ marker_id: 'urina_densidade', value: densVal });
          found.add('urina_densidade');
          console.log(`Regex fallback urina_densidade: ${densVal}`);
        }
      }
    }
    if (!found.has('urina_ph')) {
      const m = pdfText.match(/(?:pH\s*(?:Urin[áa]rio)?)[\s:.\-]*?(\d[.,]?\d?)/i);
      if (m) { processValue('urina_ph', m[1]); }
    }

    const urinaQualMap: [string, RegExp][] = [
      ['urina_cor', /(?:Cor)\s*[:.]\s*(amarelo?\s*(?:claro|citrino|escuro)?|[âa]mbar|[^\n]{3,30})/i],
      ['urina_aspecto', /(?:Aspecto)\s*[:.]\s*(l[íi]mpido|turvo|ligeiramente\s+turvo|[^\n]{3,30})/i],
      ['urina_proteinas', /(?:Prote[íi]nas?)\s*[:.]\s*(negativ[oa]|inferior\s+a\s+[\d,\.]+\s*[^\n]*|ausente|tra[çc]os|[^\n]{3,40})/i],
      ['urina_glicose', /(?:Glicose)\s*[:.]\s*(negativ[oa]|inferior\s+a\s+[\d,\.]+\s*[^\n]*|ausente|normal|[^\n]{3,40})/i],
      ['urina_hemoglobina', /(?:Hemoglobina|Sangue)\s*[:.]\s*(negativ[oa]|positiv[oa]|ausente|tra[çc]os|[^\n]{3,30})/i],
      ['urina_leucocitos', /(?:Leuc[óo]citos|Esterase)\s*[:.]\s*([^\n]{3,50})/i],
      ['urina_hemacias', /(?:Hem[áa]cias|Eritr[óo]citos)\s*[:.]\s*([^\n]{3,50})/i],
      ['urina_bacterias', /(?:Bact[ée]rias)\s*[:.]\s*(ausentes?|raras?|numerosas?|[^\n]{3,30})/i],
      ['urina_celulas', /(?:C[éeÉE]lulas?\s+Epiteliais?|Epiteliais?)\s*[:.]\s*(raras?|ausentes?|algumas|numerosas?|[^\n]{3,30})/i],
      ['urina_cilindros', /(?:Cilindros?)\s*[:.]\s*(ausentes?|raros?|presentes?|hialinos|[^\n]{3,30})/i],
      ['urina_cristais', /(?:Cristais?)\s*[:.]\s*(ausentes?|raros?|presentes?|[^\n]{3,30})/i],
      ['urina_nitritos', /(?:Nitritos?|NITRITO)\s*[:.]\s*(negativ[oa]|positiv[oa]|[^\n]{3,20})/i],
      ['urina_bilirrubina', /(?:Bilirrubina)\s*[:.]\s*(negativ[oa]|positiv[oa]|ausente|[^\n]{3,20})/i],
      ['urina_urobilinogenio', /(?:Urobilinog[êeÊE]nio)\s*[:.]\s*(normal|inferior\s+a\s+[\d,\.]+\s*[^\n]*|negativ[oa]|[^\n]{3,40})/i],
      ['urina_cetona', /(?:Ceton[ao]s?|Corpos?\s+Cet[ôo]nicos?)\s*[:.]\s*(negativ[oa]|positiv[oa]|ausente|[^\n]{3,20})/i],
      ['urina_muco', /(?:Muco|Filamentos?\s+(?:de\s+)?Muco)\s*[:.]\s*(ausente|presente|raros?|[^\n]{3,30})/i],
    ];
    for (const [id, regex] of urinaQualMap) {
      if (!found.has(id)) {
        const match = pdfText.match(regex);
        if (match && match[1]) {
          const val = match[1].trim();
          if (val.length > 0 && val.length < 100) {
            additional.push({ marker_id: id, value: 0, text_value: val });
            found.add(id);
            console.log(`Regex fallback ${id}: "${val}"`);
          }
        }
      }
    }
  }

  // === ELETROFORESE DE PROTEÍNAS ===
  const eletSanity: Record<string, { min: number; max: number }> = {
    eletroforese_albumina: { min: 30, max: 80 },
    eletroforese_alfa1:    { min: 1, max: 10 },
    eletroforese_alfa2:    { min: 4, max: 20 },
    eletroforese_beta1:    { min: 2, max: 12 },
    eletroforese_beta2:    { min: 1, max: 10 },
    eletroforese_gama:     { min: 5, max: 30 },
    proteinas_totais:      { min: 3, max: 12 },
  };
  if (!found.has('eletroforese_albumina') || !found.has('eletroforese_alfa1')) {
    const eletSection = pdfText.match(/ELETROFORESE DE PROTE[ÍI]NAS[\s\S]{0,3000}?(?=\n{4,}|LIPASE|COPROL[ÓO]GICO|COPROGRAMA|PARASITOL[ÓO]GICO|$)/i)?.[0];
    if (eletSection) {
      const eletMap: [string, RegExp[]][] = [
        ['eletroforese_albumina', [
          /Albumina\s*:\s*\n\s*%\s*\n\s*([\d,\.]+)/,
          /Albumina\s*:\s*\n\s*([5-9]\d[,\.]\d+)/,
          /Albumina\s*[:\s]+([5-9]\d[,\.]\d+)\s*%/,
        ]],
        ['eletroforese_alfa1',    [/Alfa\s*1\s*:\s*\n\s*([\d,\.]+)/, /Alfa\s*1\s*[:\s]+([\d,\.]+)\s*%/]],
        ['eletroforese_alfa2',    [/Alfa\s*2\s*:\s*\n\s*([\d,\.]+)/, /Alfa\s*2\s*[:\s]+([\d,\.]+)\s*%/]],
        ['eletroforese_beta1',    [/Beta\s*1\s*:\s*\n\s*([\d,\.]+)/, /Beta\s*1\s*[:\s]+([\d,\.]+)\s*%/]],
        ['eletroforese_beta2',    [/Beta\s*2\s*:\s*\n\s*([\d,\.]+)/, /Beta\s*2\s*[:\s]+([\d,\.]+)\s*%/]],
        ['eletroforese_gama',     [/Gama\s*:\s*\n\s*([\d,\.]+)/, /Gama\s*[:\s]+([\d,\.]+)\s*%/]],
        ['proteinas_totais',      [/Prote[íi]nas\s+Totais\s*:\s*\n\s*([\d,\.]+)/, /Prote[íi]nas\s+Totais\s*[:\s]+([\d,\.]+)/]],
      ];
      for (const [id, regexList] of eletMap) {
        if (!found.has(id)) {
          for (const regex of regexList) {
            const m = eletSection.match(regex);
            if (m && m[1]) {
              const val = parseFloat(m[1].replace(',', '.'));
              const sanity = eletSanity[id];
              if (!isNaN(val) && (!sanity || (val >= sanity.min && val <= sanity.max))) {
                additional.push({ marker_id: id, value: val });
                found.add(id);
                console.log(`Eletroforese regex fallback ${id}: ${val}`);
                break;
              } else if (!isNaN(val) && sanity) {
                console.log(`Eletroforese regex fallback ${id}: rejected ${val} (out of range ${sanity.min}–${sanity.max})`);
              }
            }
          }
        }
      }
    }
  }

  // === COPROLÓGICO: gordura fecal quantitativa ===
  if (!found.has('copro_gordura_quant')) {
    const gorduraMatch = pdfText.match(/(\d+(?:[,\.]\d+)?)\s*%\s*DE\s*GORDURA\s*FECAL/i)
      || pdfText.match(/Gorduras?\s*(?:\(Sudam\s*III\))?\s*[:\n]+\s*([\d,\.]+)\s*%/i);
    if (gorduraMatch && gorduraMatch[1]) {
      const val = parseFloat(gorduraMatch[1].replace(',', '.'));
      if (!isNaN(val)) {
        additional.push({ marker_id: 'copro_gordura_quant', value: val });
        found.add('copro_gordura_quant');
        console.log(`Gordura fecal quantitativa regex fallback: ${val}%`);
      }
    }
  }

  if (additional.length > 0) {
    console.log(`Regex fallback added ${additional.length} markers: ${additional.map(r => r.marker_id).join(', ')}`);
  }

  // === DIAGNOSTIC: log missing markers ===
  const criticalMarkers: [string, string[]][] = [
    ['ferro_metabolismo', ['METABOLISMO DO FERRO', 'METABOLISMO DE FERRO']],
    ['vhs', ['HEMOSSEDIMENTA', 'VHS', 'V.H.S']],
    ['t4_total', ['TIROXINA (T4)', 'T4 TOTAL', 'T4, SORO']],
    ['amh', ['MULLERIANO', 'MÜLLERIANO', 'AMH', 'HAM']],
    ['fosforo', ['FOSFORO', 'FÓSFORO']],
    ['vitamina_d_125', ['1,25-DIHIDROXI', '1.25-DIHIDROXI', 'CALCITRIOL', 'DIHIDROXIVITAMINA']],
    ['estrona', ['ESTRONA']],
    ['aldosterona', ['ALDOSTERONA']],
    ['magnesio', ['MAGNESIO', 'MAGNÉSIO']],
    ['selenio', ['SELENIO', 'SELÊNIO']],
    ['cromo', ['CROMO']],
    ['fosfatase_alcalina', ['FOSFATASE ALCALINA', 'FOSFATASE']],
    ['sodio', ['SODIO', 'SÓDIO']],
    ['potassio', ['POTASSIO', 'POTÁSSIO']],
  ];
  const textUpper = pdfText.toUpperCase();
  for (const [markerId, searchTerms] of criticalMarkers) {
    if (!found.has(markerId)) {
      const foundTerm = searchTerms.find(t => textUpper.includes(t.toUpperCase()));
      if (foundTerm) {
        const idx = textUpper.indexOf(foundTerm.toUpperCase());
        const snippet = pdfText.substring(Math.max(0, idx - 20), Math.min(pdfText.length, idx + 200)).replace(/\n/g, '\\n');
        console.log(`MISSING ${markerId}: found "${foundTerm}" in PDF at pos ${idx}. Context: "${snippet}"`);
      } else {
        console.log(`MISSING ${markerId}: NOT found in PDF text (searched: ${searchTerms.join(', ')})`);
      }
    }
  }

  // Cross-check: toxicology markers against PDF text (anti-hallucination)
  const toxMarkerTextTerms: Record<string, string[]> = {
    mercurio:  ['mercúrio', 'mercurio', 'mercury', 'hg sangue', 'hg, sangue'],
    aluminio:  ['alumínio', 'aluminio', 'aluminum', 'al, soro', 'al sérico'],
    cadmio:    ['cádmio', 'cadmio', 'cadmium', 'cd, sangue'],
    chumbo:    ['chumbo', 'plumbemia', 'lead', 'pb sangue'],
    arsenico:  ['arsênico', 'arsenico', 'arsenic', 'as, urina'],
    niquel:    ['níquel', 'niquel', 'nickel', 'ni, soro'],
    cobalto:   ['cobalto', 'cobalt', 'co, soro'],
  };
  const pdfTextLower = pdfText.toLowerCase();
  const crossChecked = [...aiResults, ...additional].filter(r => {
    const terms = toxMarkerTextTerms[r.marker_id];
    if (terms) {
      const foundInText = terms.some(t => pdfTextLower.includes(t));
      if (!foundInText) {
        console.log(`CROSS-CHECK: discarding ${r.marker_id} = ${r.value} — marker name NOT found in PDF text (hallucination)`);
        return false;
      }
    }
    return true;
  });

  // Plausibility validation for toxicology markers
  const toxPlausibility: Record<string, number> = {
    mercurio: 100, aluminio: 200, cadmio: 50,
    chumbo: 100, cobalto: 50, arsenico: 500, niquel: 100,
  };
  const filtered = crossChecked.filter(r => {
    const maxPlausible = toxPlausibility[r.marker_id];
    if (maxPlausible !== undefined && r.value !== undefined && r.value !== null && r.value > maxPlausible) {
      console.log(`Plausibility filter: discarding ${r.marker_id} = ${r.value} (max plausible: ${maxPlausible})`);
      return false;
    }
    return true;
  });

  return filtered;
}
