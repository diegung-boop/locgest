# Regras do Projeto - Locgest (Gestão de Locações)

## Preservação de Lógica e Compatibilidade
1. **Preservação do Fluxo Existente**: A lógica central do sistema (ciclo de locação: Clientes -> Propostas Multi-item -> Contratos -> Financeiro -> Entregas & OS) não deve ser alterada de forma destrutiva.
2. **Alerta de Impacto & Confirmação Prévia**: Qualquer nova funcionalidade que impacte, modifique ou descontinue alguma feature ou regra de negócio antiga DEVE ser explicitamente alertada e confirmada com o usuário antes de ser implementada.
