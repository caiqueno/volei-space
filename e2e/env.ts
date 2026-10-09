export const BASE_URL = 'http://127.0.0.1:3001'
export const WEBHOOK_SECRET = 'teste-local-infinitepay-webhook'
export const JWT_SECRET = 'teste-local-jwt-secret-32-chars-min'

export const candidaturaDoRoteiro = {
  nome: 'Volei Touchet',
  responsavel: 'João Silva',
  email: 'joao@email.com',
  telefone: '(11) 99999-9999',
  categoria: 'MASCULINO',
  serie: 'OURO',
  ligaId: 1,
  diasDisponiveis: ['SEG', 'QUA', 'SAB'],
  horarios: { manha: false, tarde: false, noite: true },
  quadraInfo: {
    cobertura: true,
    piso: 'Madeira',
    banheiro: true,
    endereco: 'Rua das Palmeiras, 100',
  },
}

export const jogadorDoRoteiro = {
  nome: 'Maria Souza',
  dataNascimento: '2000-04-12',
  cpf: '529.982.247-25',
  email: 'maria.souza@email.com',
  celular: '11999990000',
  telefoneEmergencia: '11988880000',
  posicao: 'LV',
  numero: 7,
}
