/**
 * Prévia assinada da cópia de configuração, ou confirmação que envia o plano do JWT à RPC.
 * O `/brain` não descreve essa operação (gap).
 * Não chama `assertReplicationPreviewCurrent`.
 * No ramo de confirmação, recusa plano de outro `organizadorId` ou de outro `ligaId`.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { SignJWT,jwtVerify } from 'jose'
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import { requireOwnedLigaForSetup } from '@/lib/championship-setup-access'
import { success,error } from '@/lib/api-response'
import { previewCategoryReplication,REPLICATION_SECTION_SCHEMAS,type ReplicationSection,type ReplicationPreview } from '@/lib/category-replication'
import { readReplicationState } from '@/lib/category-replication-server'
const schema=z.object({sourceId:z.string().uuid(),targetIds:z.array(z.string().uuid()).min(1).max(4),sections:z.array(z.string()).min(1).max(7),mode:z.enum(['empty-only','replace-sections'])}).strict()

/** Exige `JWT_SECRET` para assinar e verificar a prévia. Sem regra correspondente no `/brain`. */
function secret(){if(!process.env.JWT_SECRET)throw new Error('Serviço de assinatura indisponível.');return new TextEncoder().encode(process.env.JWT_SECRET)}

/**
 * Dois ramos. Com `confirmationToken`, verifica JWT HS256 de audiência `category-replication`
 * e chama a RPC `replicar_configuracao_categorias` com o plano que estava no token.
 * Sem o token, aceita uma origem, de 1 a 4 destinos, de 1 a 7 seções e o modo,
 * monta a prévia e devolve um JWT com prazo de 15 minutos.
 * A RPC não foi auditada neste lote. Efeito do ramo de confirmação: o que a RPC gravar.
 */
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const ligaId=Number((await params).id),liga=await requireOwnedLigaForSetup(req,ligaId,'id,nome')
 if(liga instanceof Response)return liga
 try{
  const body=await req.json()
  if(body.confirmationToken){
   const {payload}=await jwtVerify(body.confirmationToken,secret(),{audience:'category-replication',algorithms:['HS256']})
   const plan=payload.plan as unknown as ReplicationPreview
   if(plan.organizadorId!==liga.organizadorId||plan.ligaId!==ligaId)return error('Prévia pertence a outro campeonato.',403)
   const {data,error:err}=await db.rpc('replicar_configuracao_categorias',{p_liga_id:ligaId,p_organizador_id:liga.organizadorId,p_operacao_id:payload.jti,p_plano:plan})
   return err?error('A categoria mudou ou possui operações. Gere uma nova prévia.',409):success(data)
  }
  const input=schema.parse(body)
  if(input.sections.some(s=>!Object.hasOwn(REPLICATION_SECTION_SCHEMAS,s)))return error('Seção inválida.',422)
  const [source,...targets]=await Promise.all([input.sourceId,...input.targetIds].map(id=>readReplicationState(ligaId,id,liga.organizadorId)))
  const plan=previewCategoryReplication(source,targets,input.sections as ReplicationSection[],input.mode)
  const confirmationToken=await new SignJWT({plan}).setProtectedHeader({alg:'HS256'}).setAudience('category-replication').setJti(randomUUID()).setIssuedAt().setExpirationTime('15m').sign(secret())
  return success({preview:plan,confirmationToken})
 }catch(err){return error(err instanceof z.ZodError?'Dados de replicação inválidos.':err instanceof Error?err.message:'Não foi possível copiar.',422)}
}
