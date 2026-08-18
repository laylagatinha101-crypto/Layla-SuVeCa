export interface DailyMotivation {
  id: string;
  quote: string;
  author: string;
  theme: 'foco' | 'persistência' | 'estudo';
}

/** Curadoria curta de autores e pensadores para a tela inicial. */
export const DAILY_MOTIVATIONS: DailyMotivation[] = [
  {
    id: 'pessoa-alma',
    quote: 'Tudo vale a pena se a alma não é pequena.',
    author: 'Fernando Pessoa',
    theme: 'persistência',
  },
  {
    id: 'mandela-educacao',
    quote: 'A educação é a arma mais poderosa que você pode usar para mudar o mundo.',
    author: 'Nelson Mandela',
    theme: 'estudo',
  },
  {
    id: 'curie-entender',
    quote: 'Na vida, não há nada a temer, mas a entender.',
    author: 'Marie Curie',
    theme: 'foco',
  },
  {
    id: 'seneca-adiamos',
    quote: 'Enquanto adiamos, a vida passa.',
    author: 'Sêneca',
    theme: 'foco',
  },
  {
    id: 'angelou-faca',
    quote: 'Nada funcionará a menos que você faça.',
    author: 'Maya Angelou',
    theme: 'persistência',
  },
  {
    id: 'freire-pessoas',
    quote: 'Educação não transforma o mundo. Educação muda pessoas.',
    author: 'Paulo Freire',
    theme: 'estudo',
  },
];

export const getDailyMotivation = (date = new Date()): DailyMotivation => {
  const seed = Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() /
      86_400_000
  );
  return DAILY_MOTIVATIONS[Math.abs(seed) % DAILY_MOTIVATIONS.length];
};
