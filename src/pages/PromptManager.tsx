import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Plus, Edit2, Check, X, Loader2, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AnalysisPrompt {
  id: string;
  specialty_id: string;
  specialty_name: string;
  specialty_icon: string;
  description: string | null;
  system_prompt: string;
  has_protocols: boolean;
  is_active: boolean;
  version: string;
  author: string;
  updated_at: string;
}

export default function PromptManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<AnalysisPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<AnalysisPrompt | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    specialty_id: "",
    specialty_name: "",
    specialty_icon: "🔬",
    description: "",
    system_prompt: "",
    has_protocols: false,
    is_active: true,
  });

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("analysis_prompts")
        .select("*")
        .order("specialty_name");
      if (error) throw error;
      setPrompts(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar prompts", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (prompt: AnalysisPrompt) => {
    setEditingPrompt({ ...prompt });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingPrompt) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("analysis_prompts")
        .update({
          specialty_name: editingPrompt.specialty_name,
          specialty_icon: editingPrompt.specialty_icon,
          description: editingPrompt.description,
          system_prompt: editingPrompt.system_prompt,
          has_protocols: editingPrompt.has_protocols,
          is_active: editingPrompt.is_active,
          version: editingPrompt.version,
        })
        .eq("id", editingPrompt.id);
      if (error) throw error;
      toast({ title: "Prompt salvo com sucesso!" });
      setEditDialogOpen(false);
      loadPrompts();
    } catch (err: any) {
      toast({ title: "Erro ao salvar prompt", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (prompt: AnalysisPrompt) => {
    try {
      const { error } = await supabase
        .from("analysis_prompts")
        .update({ is_active: !prompt.is_active })
        .eq("id", prompt.id);
      if (error) throw error;
      toast({ title: `Especialidade ${!prompt.is_active ? "ativada" : "desativada"}` });
      loadPrompts();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newPrompt.specialty_id || !newPrompt.specialty_name || !newPrompt.system_prompt) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("analysis_prompts").insert({
        specialty_id: newPrompt.specialty_id.toLowerCase().replace(/\s+/g, "_"),
        specialty_name: newPrompt.specialty_name,
        specialty_icon: newPrompt.specialty_icon,
        description: newPrompt.description,
        system_prompt: newPrompt.system_prompt,
        has_protocols: newPrompt.has_protocols,
        is_active: newPrompt.is_active,
      });
      if (error) throw error;
      toast({ title: "Nova especialidade criada!" });
      setNewDialogOpen(false);
      setNewPrompt({ specialty_id: "", specialty_name: "", specialty_icon: "🔬", description: "", system_prompt: "", has_protocols: false, is_active: true });
      loadPrompts();
    } catch (err: any) {
      toast({ title: "Erro ao criar especialidade", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return dateStr; }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Gerenciador de Prompts</h1>
              <p className="text-sm text-muted-foreground">
                Configure os prompts de análise clínica por especialidade
              </p>
            </div>
          </div>
          <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Especialidade
          </Button>
        </div>

        {/* Lista de prompts */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : prompts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum prompt configurado ainda.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Execute a migration SQL para criar os prompts iniciais.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {prompts.map((prompt) => (
              <Card key={prompt.id} className={!prompt.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{prompt.specialty_icon}</span>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {prompt.specialty_name}
                          <Badge variant="outline" className="text-xs font-mono">
                            {prompt.specialty_id}
                          </Badge>
                          {prompt.has_protocols && (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                              Protocolos Essentia
                            </Badge>
                          )}
                          {!prompt.is_active && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                        </CardTitle>
                        {prompt.description && (
                          <CardDescription className="mt-1">{prompt.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Switch
                          checked={prompt.is_active}
                          onCheckedChange={() => handleToggleActive(prompt)}
                        />
                        <span>{prompt.is_active ? "Ativo" : "Inativo"}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(prompt)} className="gap-1.5">
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-md p-3 font-mono text-xs text-muted-foreground max-h-24 overflow-hidden relative">
                    <div className="line-clamp-4">{prompt.system_prompt.slice(0, 400)}...</div>
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>Versão {prompt.version} · Editado por {prompt.author}</span>
                    <span>Última atualização: {formatDate(prompt.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingPrompt?.specialty_icon} Editar: {editingPrompt?.specialty_name}
            </DialogTitle>
          </DialogHeader>
          {editingPrompt && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nome da Especialidade</Label>
                  <Input
                    value={editingPrompt.specialty_name}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, specialty_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ícone (emoji)</Label>
                  <Input
                    value={editingPrompt.specialty_icon}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, specialty_icon: e.target.value })}
                    className="w-20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  value={editingPrompt.description ?? ""}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                  placeholder="Descrição curta da especialidade..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Versão</Label>
                <Input
                  value={editingPrompt.version}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, version: e.target.value })}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingPrompt.has_protocols}
                  onCheckedChange={(v) => setEditingPrompt({ ...editingPrompt, has_protocols: v })}
                />
                <Label>Usar sistema de Protocolos Essentia</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingPrompt.is_active}
                  onCheckedChange={(v) => setEditingPrompt({ ...editingPrompt, is_active: v })}
                />
                <Label>Especialidade ativa (aparece na seleção)</Label>
              </div>
              <div className="space-y-1.5">
                <Label>Prompt do Sistema</Label>
                <p className="text-xs text-muted-foreground">
                  Este é o prompt enviado ao modelo de IA como instrução de sistema. Defina o papel, foco clínico, regras e formato de saída JSON.
                </p>
                <Textarea
                  value={editingPrompt.system_prompt}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, system_prompt: e.target.value })}
                  className="font-mono text-xs min-h-[400px]"
                  placeholder="Você é um assistente clínico especializado em..."
                />
                <p className="text-xs text-muted-foreground">
                  {editingPrompt.system_prompt.length.toLocaleString("pt-BR")} caracteres
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              <X className="mr-1.5 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar Prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de nova especialidade */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Especialidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ID da Especialidade *</Label>
                <Input
                  value={newPrompt.specialty_id}
                  onChange={(e) => setNewPrompt({ ...newPrompt, specialty_id: e.target.value })}
                  placeholder="ex: dermatologia"
                />
                <p className="text-xs text-muted-foreground">Slug único, sem espaços (será convertido automaticamente)</p>
              </div>
              <div className="space-y-1.5">
                <Label>Nome da Especialidade *</Label>
                <Input
                  value={newPrompt.specialty_name}
                  onChange={(e) => setNewPrompt({ ...newPrompt, specialty_name: e.target.value })}
                  placeholder="ex: Dermatologia"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ícone (emoji)</Label>
                <Input
                  value={newPrompt.specialty_icon}
                  onChange={(e) => setNewPrompt({ ...newPrompt, specialty_icon: e.target.value })}
                  className="w-20"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  value={newPrompt.description}
                  onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                  placeholder="Descrição curta..."
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={newPrompt.has_protocols}
                onCheckedChange={(v) => setNewPrompt({ ...newPrompt, has_protocols: v })}
              />
              <Label>Usar sistema de Protocolos Essentia</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Prompt do Sistema *</Label>
              <Textarea
                value={newPrompt.system_prompt}
                onChange={(e) => setNewPrompt({ ...newPrompt, system_prompt: e.target.value })}
                className="font-mono text-xs min-h-[300px]"
                placeholder="Você é um assistente clínico especializado em..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              <X className="mr-1.5 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {saving ? "Criando..." : "Criar Especialidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
