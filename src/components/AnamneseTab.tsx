import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, CheckCircle2, Heart, Leaf, Activity, Microscope, ClipboardList } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

interface AnamneseTabProps {
  patient: Patient;
}

const SPECIALTIES = [
  { id: "medicina_funcional", label: "Medicina Funcional", icon: <Microscope className="h-4 w-4" /> },
  { id: "nutrologia", label: "Nutrologia", icon: <Leaf className="h-4 w-4" /> },
  { id: "endocrinologia", label: "Endocrinologia", icon: <Activity className="h-4 w-4" /> },
  { id: "cardiologia", label: "Cardiologia", icon: <Heart className="h-4 w-4" /> },
];

export function AnamneseTab({ patient }: AnamneseTabProps) {
  const { toast } = useToast();
  const [activeSpecialty, setActiveSpecialty] = useState("medicina_funcional");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnamneses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("patient_anamneses")
        .select("id, specialty_id, anamnese_text")
        .eq("patient_id", patient.id);

      if (!error && data) {
        const textsMap: Record<string, string> = {};
        const idsMap: Record<string, string> = {};
        for (const row of data) {
          textsMap[row.specialty_id] = (row as any).anamnese_text ?? "";
          idsMap[row.specialty_id] = row.id;
        }
        setTexts(textsMap);
        setSavedIds(idsMap);
      }
      setLoading(false);
    };
    loadAnamneses();
  }, [patient.id]);

  const handleSave = async (specialtyId: string) => {
    setSaving(true);
    const text = texts[specialtyId] ?? "";
    const existingId = savedIds[specialtyId];

    try {
      if (existingId) {
        const { error } = await supabase
          .from("patient_anamneses")
          .update({ updated_at: new Date().toISOString() } as any)
          .eq("id", existingId);
        
        // Also update anamnese_text via raw update
        const { error: error2 } = await (supabase as any)
          .from("patient_anamneses")
          .update({ anamnese_text: text, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        
        if (error || error2) throw error || error2;
      } else {
        const { data, error } = await (supabase as any)
          .from("patient_anamneses")
          .insert({ patient_id: patient.id, specialty_id: specialtyId, anamnese_text: text })
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) {
          setSavedIds(prev => ({ ...prev, [specialtyId]: data.id }));
        }
      }
      toast({ title: "✅ Anamnese salva!", description: "As informações do paciente foram salvas com sucesso." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando anamnese...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Anamnese do Paciente</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Cole aqui as informações que o paciente já preencheu (Google Forms, e-mail, WhatsApp, etc.).
        Esses dados serão usados automaticamente pela IA na análise dos exames.
      </p>

      <Tabs value={activeSpecialty} onValueChange={setActiveSpecialty}>
        <TabsList className="grid w-full grid-cols-4 mb-4">
          {SPECIALTIES.map(s => (
            <TabsTrigger key={s.id} value={s.id} className="flex items-center gap-1 text-xs">
              {s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {SPECIALTIES.map(specialty => (
          <TabsContent key={specialty.id} value={specialty.id}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  {specialty.icon}
                  Anamnese — {specialty.label}
                  {savedIds[specialty.id] && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Informações do paciente
                  </Label>
                  <Textarea
                    placeholder={`Cole aqui as respostas do paciente para ${specialty.label}.\n\nExemplo: queixas, histórico, medicamentos, hábitos, sintomas, objetivos, etc.`}
                    value={texts[specialty.id] ?? ""}
                    onChange={e => setTexts(prev => ({ ...prev, [specialty.id]: e.target.value }))}
                    className="min-h-[320px] font-mono text-sm resize-y"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(texts[specialty.id] ?? "").length} caracteres
                  </p>
                </div>

                <Button
                  onClick={() => handleSave(specialty.id)}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Salvar Anamnese</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
