// Aviso padrão das telas do paciente (o PDF tem o seu próprio, em src/lib/pdf.ts).
export function Disclaimer() {
  return (
    <p className="disclaimer">
      Esta é uma ferramenta de apoio à triagem podológica. Não substitui diagnóstico ou prescrição médica.
    </p>
  );
}
