import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FlaskConical,
  Brain,
  TrendingUp,
  Shield,
  Stethoscope,
  FileText,
  Pill,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
  ChevronRight,
} from "lucide-react";
import { useEffect } from "react";

const FEATURES = [
  {
    icon: FlaskConical,
    title: "Importação Inteligente de Exames",
    description:
      "Envie PDFs de laudos laboratoriais e o sistema extrai, normaliza e organiza automaticamente todos os marcadores com IA.",
  },
  {
    icon: Brain,
    title: "Análise Clínica com IA",
    description:
      "Relatórios interpretativos gerados por inteligência artificial com red flags, padrões clínicos e recomendações baseadas em evidência.",
  },
  {
    icon: TrendingUp,
    title: "Evolução Longitudinal",
    description:
      "Acompanhe a evolução de cada marcador ao longo do tempo com gráficos comparativos, tabelas evolutivas e exportação para PDF/Excel.",
  },
  {
    icon: Pill,
    title: "Prescrição Baseada em Protocolos",
    description:
      "Protocolos terapêuticos integrados com recomendações de suplementação e fármacos ajustados ao perfil bioquímico do paciente.",
  },
  {
    icon: Stethoscope,
    title: "Prontuário Clínico Estruturado",
    description:
      "Consultas organizadas com notas SOAP, contexto longitudinal, prescrições e análises IA vinculadas a cada atendimento.",
  },
  {
    icon: Shield,
    title: "Segurança e Privacidade",
    description:
      "Dados protegidos com criptografia, controle de acesso por profissional e conformidade com as melhores práticas de segurança de dados de saúde.",
  },
];

const BENEFITS = [
  "Redução de tempo na interpretação de exames laboratoriais",
  "Identificação precoce de padrões e tendências clínicas",
  "Visão longitudinal completa do paciente em uma só tela",
  "Protocolos terapêuticos integrados à análise bioquímica",
  "Exportação profissional de relatórios para pacientes e colegas",
  "Múltiplas especialidades: Funcional, Nutrologia, Endocrinologia e mais",
];

const AUDIENCES = [
  { label: "Médicos", description: "Análise clínica avançada integrada ao prontuário" },
  { label: "Nutricionistas", description: "Interpretação funcional de marcadores e suplementação" },
  { label: "Nutrólogos", description: "Protocolos terapêuticos e prescrição baseada em evidência" },
  { label: "Clínicas", description: "Gestão centralizada de pacientes e atendimentos" },
];

export default function Landing() {
  const navigate = useNavigate();

  // JSON-LD structured data for SEO
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Bio Tracker",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      description:
        "Plataforma clínica inteligente para rastreamento de exames laboratoriais, análise com IA e gestão de prontuários médicos.",
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock",
      },
    });
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">Bio Tracker</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Começar agora
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20 text-center relative">
          <Badge variant="secondary" className="mb-4 text-xs px-3 py-1 gap-1.5">
            <Zap className="h-3 w-3" />
            Inteligência Artificial Clínica
          </Badge>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            Análise laboratorial
            <br />
            <span className="text-primary">inteligente e longitudinal</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Bio Tracker é a plataforma clínica que transforma exames laboratoriais em insights
            acionáveis. Importação automática, análise com IA, evolução longitudinal e prontuário
            integrado — tudo em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="gap-2 text-sm" onClick={() => navigate("/auth")}>
              Criar conta gratuita
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-sm"
              onClick={() => {
                document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Solicitar demonstração
            </Button>
          </div>
        </div>
      </section>

      <Separator className="max-w-6xl mx-auto" />

      {/* ── FOR WHOM ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Para quem é o Bio Tracker?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Profissionais de saúde que buscam eficiência, precisão e rastreabilidade clínica.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AUDIENCES.map((a) => (
            <Card key={a.label} className="text-center border-border/60 hover:border-primary/30 transition-colors">
              <CardContent className="pt-6 pb-5 px-5">
                <Users className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-1">{a.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{a.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Funcionalidades</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Tudo que você precisa para transformar dados em decisão clínica.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="pt-6 pb-5 px-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Por que profissionais escolhem o Bio Tracker?
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              A combinação de importação automática, inteligência artificial e rastreabilidade
              longitudinal permite que você dedique mais tempo ao paciente e menos à burocracia.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/auth")}>
              Experimentar agora
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-3">
            {BENEFITS.map((b, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA / CONTACT ── */}
      <section id="contato" className="bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Pronto para transformar sua prática clínica?
          </h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8 leading-relaxed">
            Comece a usar o Bio Tracker gratuitamente ou agende uma demonstração personalizada
            para sua clínica.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 text-sm"
              onClick={() => navigate("/auth")}
            >
              Criar conta gratuita
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-sm border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                window.location.href = "mailto:contato@bio-tracker.com.br?subject=Demonstração Bio Tracker";
              }}
            >
              <FileText className="h-4 w-4" />
              Solicitar demonstração
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <FlaskConical className="h-3 w-3" />
            </div>
            <span className="text-sm font-semibold">Bio Tracker</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Bio Tracker. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
