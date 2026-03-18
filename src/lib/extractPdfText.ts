import * as pdfjsLib from "pdfjs-dist";

/**
 * Extract text from a PDF file with spatial layout reconstruction.
 * Returns both the raw full text and a cleaned version with noise filtered out.
 */
export async function extractPdfText(file: File): Promise<{ fullText: string; cleanedText: string }> {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as any[];
    if (items.length === 0) continue;
    const lines: { y: number; items: { x: number; str: string }[] }[] = [];
    items.forEach((item) => {
      if (!item.str) return;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      let line = lines.find((l) => Math.abs(l.y - y) < 3);
      if (!line) { line = { y, items: [] }; lines.push(line); }
      line.items.push({ x, str: item.str });
    });
    lines.sort((a, b) => b.y - a.y);
    lines.forEach((line) => {
      line.items.sort((a, b) => a.x - b.x);
      fullText += line.items.map((it) => it.str).join("  ") + "\n";
    });
    fullText += "\n--- Página " + i + " ---\n\n";
  }

  const cleanedLines = fullText.split("\n").filter((line) => {
    const normalized = line.trim().replace(/\s+/g, " ");
    if (!normalized || normalized.length < 3) return false;
    if (/^Cliente:/i.test(normalized)) return false;
    if (/^Data de Nascimento:/i.test(normalized)) return false;
    if (/^Médico:.*CRM/i.test(normalized)) return false;
    if (/^Data da Ficha:/i.test(normalized)) return false;
    if (/^Ficha:/i.test(normalized)) return false;
    if (/^RECEBIDO.COLETADO/i.test(normalized)) return false;
    if (/^Exame liberado/i.test(normalized)) return false;
    if (/^Assinatura digital/i.test(normalized)) return false;
    if (/^CRM:.*RESPONSÁVEL/i.test(normalized)) return false;
    if (/^A interpretação do resultado/i.test(normalized)) return false;
    if (/^Avenida|^Rua |^Impresso em:/i.test(normalized)) return false;
    if (/^Página:|^Páginas:/i.test(normalized)) return false;
    if (/^-{3,}/.test(normalized)) return false;
    if (/^={3,}/.test(normalized)) return false;
    if (/^www\./i.test(normalized)) return false;
    if (/confiance/i.test(normalized)) return false;
    if (/^CAMPINAS|^INDAIATUBA/i.test(normalized)) return false;
    if (/^0[A-F0-9]{30,}/i.test(normalized)) return false;
    if (/^O valor preditivo/i.test(normalized)) return false;
    if (/^Nome:/i.test(normalized)) return false;
    if (/^Código:/i.test(normalized)) return false;
    if (/^Posto:/i.test(normalized)) return false;
    if (/^CNES:/i.test(normalized)) return false;
    if (/^Dr\.\(a\):/i.test(normalized)) return false;
    if (/^Recepção:/i.test(normalized)) return false;
    if (/^RG\/Passaporte:/i.test(normalized)) return false;
    if (/^Entrega:/i.test(normalized)) return false;
    if (/^PALC/i.test(normalized)) return false;
    if (/^SBPC/i.test(normalized)) return false;
    if (/^Laboratório\. CRM/i.test(normalized)) return false;
    if (/^Medicina Diagnóstica/i.test(normalized)) return false;
    if (/^Resultados? Anteriore?s?:/i.test(normalized)) return false;
    if (/^\d{2}\/\d{2}\/\d{4}\s*-\s*[\d<>,. ]+$/i.test(normalized)) return false;
    if (/^Método:/i.test(normalized)) return false;
    if (/^Coleta:/i.test(normalized)) return false;
    if (/^Liberação:/i.test(normalized)) return false;
    if (/^Revisão:/i.test(normalized)) return false;
    if (/^Observações gerais:/i.test(normalized)) return false;
    if (/^Exame realizado pelo/i.test(normalized)) return false;
    if (/^NOTA\s*\(?[0-9]*\)?:/i.test(normalized)) return false;
    if (/^Notas?:/i.test(normalized)) return false;
    if (/^Referências?:/i.test(normalized)) return false;
    if (/^Referência:/i.test(normalized)) return false;
    if (/^Atenção para nov/i.test(normalized)) return false;
    if (/^Limite de detecção/i.test(normalized)) return false;
    const hasQualitative = /reagente|negativo|positivo|normal|ausente|presente|pastosa|líquida|amarelo|marrom|verde|turva|límpida/i.test(normalized);
    const looksLikeExamLabel = /\b(?:TSH|T3|T4|TGO|TGP|VHS|VPM|HOMA|HDL|LDL|VLDL|PCR|FAN|EAS|ACTH|FSH|LH|DHEA|SHBG|IGF|IGFBP|HbA1c|Apo|B12)\b/i.test(normalized)
      || /\b(?:hemoglobina|hematocrito|eritrocitos|leucocitos|plaquetas|glicose|insulina|colesterol|triglicerides|ferritina|transferrina|creatinina|ureia|albumina|globulina|bilirrubina|fosfatase|amilase|lipase|estradiol|progesterona|prolactina|testosterona|cortisol|vitamina|zinco|magnesio|selenio|cobre|copro|urina)\b/i.test(normalized);
    if (normalized.length > 120 && !/\d+[.,]\d+/.test(normalized) && !hasQualitative && !looksLikeExamLabel) return false;
    if (normalized.length > 80 && !/\d/.test(normalized) && !hasQualitative && !looksLikeExamLabel) return false;
    if (/^Paciente de (baixo|risco|alto|muito)/i.test(normalized)) return false;
    if (/^(Desejável|Ótimo|Limítrofe|Alto|Muito alto)\s*:/i.test(normalized)) return false;
    if (/^(Com|Sem) (ou sem )?jejum/i.test(normalized)) return false;
    if (/^Maior ou igual a \d+ anos/i.test(normalized)) return false;
    if (/^Fem:|^Masc:/i.test(normalized)) return false;
    if (/^Menor que \d|^Maior que \d|^Maior ou igual a \d/i.test(normalized)) return false;
    if (/^De \d+ a \d+ anos/i.test(normalized)) return false;
    if (/^Acima de \d+ anos/i.test(normalized)) return false;
    if (/^Até \d+ anos/i.test(normalized)) return false;
    if (/^Crianças/i.test(normalized)) return false;
    if (/^Gestantes/i.test(normalized)) return false;
    if (/^1\.o trimestre|^2\.o trimestre|^3\.o trimestre/i.test(normalized)) return false;
    if (/^Adultos:/i.test(normalized)) return false;
    if (/^Homens:|^Mulheres:/i.test(normalized)) return false;
    if (/^Fase Folicular|^Pico Ovulatório|^Fase Lútea|^Menopausa/i.test(normalized)) return false;
    if (/^Estágio de Tanner/i.test(normalized)) return false;
    if (/^Recém-nascido/i.test(normalized)) return false;
    if (/^\d+ dias?:/i.test(normalized)) return false;
    if (/^Sangue de cordão/i.test(normalized)) return false;
    if (/^pode interferir/i.test(normalized)) return false;
    if (/^suspensão da biotina/i.test(normalized)) return false;
    if (/^Pacientes em tratamento/i.test(normalized)) return false;
    if (/^incompatibilidade do resultado/i.test(normalized)) return false;
    if (/^Na ausência de hiperglicemia/i.test(normalized)) return false;
    if (/^Standards of Medical/i.test(normalized)) return false;
    if (/^Diabetes Care/i.test(normalized)) return false;
    if (/^Cálculo baseado nos/i.test(normalized)) return false;
    if (/^Vermeulen/i.test(normalized)) return false;
    if (/^A estimativa da taxa/i.test(normalized)) return false;
    if (/^O uso da estimativa/i.test(normalized)) return false;
    if (/^Fonte da Fórmula/i.test(normalized)) return false;
    if (/^Miller WG/i.test(normalized)) return false;
    if (/^Imunoensaio para/i.test(normalized)) return false;
    if (/^Um resultado normal/i.test(normalized)) return false;
    if (/^No caso de obter/i.test(normalized)) return false;
    if (/^Quando se determina/i.test(normalized)) return false;
    if (/^Diferenças nos resultados/i.test(normalized)) return false;
    if (/^A concentração de ferro/i.test(normalized)) return false;
    if (/^LDL, VLDL e Colesterol não-HDL são calculados/i.test(normalized)) return false;
    if (/^Valores de Colesterol/i.test(normalized)) return false;
    if (/^A interpretação clínica/i.test(normalized)) return false;
    if (/^Para valores de triglicérides/i.test(normalized)) return false;
    if (/^Consenso Brasileiro/i.test(normalized)) return false;
    if (/^AC-##/i.test(normalized)) return false;
    if (/^Diluição de triagem/i.test(normalized)) return false;
    if (/^Para informações sobre/i.test(normalized)) return false;
    if (/^Frequência de FAN/i.test(normalized)) return false;
    if (/^Resultados reagentes/i.test(normalized)) return false;
    if (/^A definição do Padrão/i.test(normalized)) return false;
    if (/^Os padrões complexos/i.test(normalized)) return false;
    if (/^Mulheres em idade fértil/i.test(normalized)) return false;
    if (/^A NR-7/i.test(normalized)) return false;
    if (/^O resultado obtido/i.test(normalized)) return false;
    if (/^IBE\/SC/i.test(normalized)) return false;
    if (/^CARACTERES MORFOLÓGICOS/i.test(normalized)) return false;
    if (/^Valores obtidos/i.test(normalized)) return false;
    if (/^Este exame foi/i.test(normalized)) return false;
    if (/^Equipamento:/i.test(normalized)) return false;
    if (/^Ensaio:/i.test(normalized)) return false;
    if (/^Amostra:/i.test(normalized)) return false;
    if (/^Prazo de entrega/i.test(normalized)) return false;
    if (/^Orientação de preparo/i.test(normalized)) return false;
    if (/^Interferentes:/i.test(normalized)) return false;
    if (/^Valores em/i.test(normalized)) return false;
    if (/^IBMP\b/i.test(normalized)) return false;
    if (/^(?:mEq\/L|mg\/dL|ng\/mL|pg\/mL|µg\/dL|U\/L|mcg)\s*$/i.test(normalized)) return false;
    if (normalized.length < 3 && !/\d/.test(normalized)) return false;
    return true;
  });

  const cleanedText = cleanedLines
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter((l) => !/^--- Página \d+/.test(l))
    .join("\n");

  return { fullText, cleanedText };
}
