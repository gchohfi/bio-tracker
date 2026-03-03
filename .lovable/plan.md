

# Investigação: Falso Positivo na Extração de Mercúrio

## Causa raiz identificada

Existem **duas vias** pelas quais o Mercúrio pode ser extraído falsamente:

### 1. Regex fallback com padrão `Hg\b` muito curto (linha 1860)

```
/(?:Merc[úu]rio|Hg\b)[\s:.\-]*?(\d+[.,]?\d*)/i
```

O padrão `Hg\b` tem apenas 2 caracteres e pode casar com ocorrências acidentais no texto do PDF, como:
- Abreviações em referências laboratoriais (ex: "Hg" aparecendo em contexto de "mmHg" para pressão)
- Fragmentos de texto mal parseados pelo pdfjs-dist

**Nota**: `mmHg` em teoria não casa porque `Hg` precisa de word boundary (`\b`), mas PDFs mal formatados podem separar "mm" e "Hg" em linhas diferentes.

### 2. Prompt da IA na edge function (linhas ~418-420)

O prompt instrui explicitamente o modelo Gemini a mapear "MERCURIO" / "Mercúrio" / "Hg" → `mercurio`. Se o texto do PDF contiver qualquer menção contextual (ex: em notas de rodapé, disclaimers, ou listas de exames disponíveis), a IA pode interpretar como um resultado real.

### 3. O mesmo problema já reportado com Alumínio

A memória do projeto já registra: *"Existe um relato de usuário sobre falso positivo na extração de 'Alumínio' em casos onde o marcador não consta no documento original"*. O regex de Alumínio tem o mesmo problema: `Al\b` — apenas 2 caracteres.

---

## Plano de correção

### Arquivo: `supabase/functions/extract-lab-results/index.ts`

1. **Tornar os regexes de Toxicologia mais restritivos** — remover as alternativas curtas (`Hg\b`, `Al\b`, `Cd\b`) que são propensas a falso positivo, mantendo apenas os nomes completos:

```
mercurio: /(?:Merc[úu]rio(?:\s+(?:Total|Sangue))?)[\s:.\-]*?(\d+[.,]?\d*)/i
aluminio: /(?:Alum[íi]nio)[\s:.\-]*?(\d+[.,]?\d*)/i
cadmio:   /(?:C[áa]dmio)[\s:.\-]*?(\d+[.,]?\d*)/i
```

2. **Adicionar validação de plausibilidade** — após a extração via regex, verificar se o valor extraído está dentro de uma faixa plausível (ex: Mercúrio > 100 µg/L é improvável e provavelmente é falso positivo de outro campo numérico).

3. **Reforçar o prompt da IA** — adicionar instrução explícita para que a IA **não** extraia marcadores de Toxicologia que apareçam apenas em contexto de referência ou lista de exames, sem um valor de resultado associado.

### Escopo das alterações

- Um único arquivo: `supabase/functions/extract-lab-results/index.ts`
- Regexes de Toxicologia (linhas ~1859-1862)
- Seção do prompt de instrução para a IA (linhas ~418-422)
- A edge function será redeployada automaticamente

