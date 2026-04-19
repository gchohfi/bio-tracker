import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { regexFallback } from "./regexFallback.ts";

Deno.test("regexFallback rescues Anti-TPO from Anti-TPO with IU/mL", () => {
  const pdfText = `
    Anti-TPO
    Resultado: 34 IU/mL
  `;

  const results = regexFallback(pdfText, []);
  const antiTpo = results.find((r) => r.marker_id === "anti_tpo");

  assertEquals(antiTpo?.value, 34);
});

Deno.test("regexFallback rescues Anti-TG from Anti-TG with IU/mL", () => {
  const pdfText = `
    Anti-TG
    Resultado: 18 IU/mL
  `;

  const results = regexFallback(pdfText, []);
  const antiTg = results.find((r) => r.marker_id === "anti_tg");

  assertEquals(antiTg?.value, 18);
});
