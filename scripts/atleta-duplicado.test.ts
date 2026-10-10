import assert from 'node:assert/strict'
import { mensagemAtletaDuplicado } from '../src/lib/atleta-duplicado'

const outra = {
  equipeId: 2,
  nomeEquipe: 'ALVO',
  nome: 'Ana Silva',
  dataNascimento: '2000-01-02',
  documentoNumero: '123.456.789-00',
}

assert.equal(mensagemAtletaDuplicado({ equipeId: 1, documentoNumero: '12345678900', nome: 'Outra' }, [outra]), 'Este atleta já está na equipe ALVO desta categoria.')
assert.equal(mensagemAtletaDuplicado({ equipeId: 2, documentoNumero: '12345678900' }, [outra]), null)
assert.equal(mensagemAtletaDuplicado({ rascunhoId: 'a', documentoNumero: '' }, [{ rascunhoId: 'b', documentoNumero: '' }]), null)
assert.equal(mensagemAtletaDuplicado({ equipeId: 1, nome: 'Ána  Silva', dataNascimento: '2000-01-02T00:00:00.000Z' }, [{ ...outra, documentoNumero: null }]), 'Este atleta já está na equipe ALVO desta categoria.')
assert.equal(mensagemAtletaDuplicado({ equipeId: 1, nome: 'Ana Silva' }, [{ ...outra, documentoNumero: null }]), null)
assert.equal(mensagemAtletaDuplicado({ equipeId: 1, nome: 'Ana Silva', dataNascimento: '2000-01-02', documentoNumero: '999' }, [outra]), null)
assert.equal(mensagemAtletaDuplicado({ rascunhoId: 'a', nome: 'Ana Silva', dataNascimento: '2000-01-02' }, [{ rascunhoId: 'a', nome: 'Ana Silva', dataNascimento: '2000-01-02' }]), null)

console.log('Atleta duplicado passou: documento, nome com nascimento e a própria equipe.')
