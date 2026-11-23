import { eixoDo, indiceNivel, nivelInicial, nivelMaximo, proximoNivel } from './escada.ts';
import { posicionar } from './geometria.ts';
import type {
  ChapaPlano,
  Material,
  Nivel,
  NoCorte,
  ParametrosCorte,
  Peca,
  Plano,
} from './tipos.ts';

export type TipoErro =
  | 'excede'
  | 'medida'
  | 'girada'
  | 'quantidade'
  | 'peca-desconhecida'
  | 'material'
  | 'nivel'
  | 'niveis'
  | 'folha-vazia'
  | 'chapa';

export interface ErroPlano {
  tipo: TipoErro;
  chapa?: number;
  pecaId?: string;
  mensagem: string;
}

export interface ContextoValidacao {
  pecas: Peca[];
  materiais: Material[];
  params: ParametrosCorte;
}

/** Verifica todas as regras de um plano de corte. Lista vazia = plano válido. */
export function validarPlano(plano: Plano, ctx: ContextoValidacao): ErroPlano[] {
  const erros: ErroPlano[] = [];
  const pecas = new Map(ctx.pecas.map((p) => [p.id, p]));
  const materiais = new Map(ctx.materiais.map((m) => [m.id, m]));
  const contagem = new Map<string, number>();
  const maxIdx = indiceNivel(nivelMaximo(ctx.params.niveisMax));

  for (const chapa of plano.chapas) {
    const n = chapa.numero;
    const mat = materiais.get(chapa.materialId);
    if (!mat) {
      erros.push({
        tipo: 'chapa',
        chapa: n,
        mensagem: `Material ${chapa.materialId} não cadastrado`,
      });
    } else if (mat.chapa.comprimento !== chapa.comprimento || mat.chapa.largura !== chapa.largura) {
      erros.push({
        tipo: 'chapa',
        chapa: n,
        mensagem: `Chapa ${chapa.comprimento}×${chapa.largura} diferente do material (${mat.chapa.comprimento}×${mat.chapa.largura})`,
      });
    }

    verificarEstrutura(chapa, ctx.params.serra, maxIdx, erros);

    const geo = posicionar(chapa, { serra: ctx.params.serra, sobraMinima: ctx.params.sobraMinima });
    for (const pp of geo.pecas) {
      contagem.set(pp.pecaId, (contagem.get(pp.pecaId) ?? 0) + 1);
      const p = pecas.get(pp.pecaId);
      if (!p) {
        erros.push({
          tipo: 'peca-desconhecida',
          chapa: n,
          pecaId: pp.pecaId,
          mensagem: `Peça ${pp.pecaId} não existe`,
        });
        continue;
      }
      const normal = pp.c === p.comprimento && pp.l === p.largura;
      const girada = pp.c === p.largura && pp.l === p.comprimento;
      if (!normal && !girada) {
        erros.push({
          tipo: 'medida',
          chapa: n,
          pecaId: p.id,
          mensagem: `Peça ${p.nome}: espaço ${pp.c}×${pp.l}, peça ${p.comprimento}×${p.largura}`,
        });
      } else if (!normal && !p.podeGirar) {
        erros.push({
          tipo: 'girada',
          chapa: n,
          pecaId: p.id,
          mensagem: `Peça ${p.nome} não pode girar`,
        });
      }

      if (p.materialId !== chapa.materialId) {
        const pm = materiais.get(p.materialId);
        const alternativaOk = p.materialAlternativo && pm && mat && pm.espessura === mat.espessura;
        if (!alternativaOk) {
          erros.push({
            tipo: 'material',
            chapa: n,
            pecaId: p.id,
            mensagem: `Peça ${p.nome} (${p.materialId}) na chapa de ${chapa.materialId}`,
          });
        }
      }
    }
  }

  for (const p of ctx.pecas) {
    const qtd = contagem.get(p.id) ?? 0;
    if (qtd !== p.quantidade) {
      erros.push({
        tipo: 'quantidade',
        pecaId: p.id,
        mensagem: `Peça ${p.nome}: ${qtd} no plano, ${p.quantidade} pedidas`,
      });
    }
  }
  return erros;
}

function verificarEstrutura(chapa: ChapaPlano, serra: number, maxIdx: number, erros: ErroPlano[]) {
  const n = chapa.numero;

  /** Verifica um grupo de irmãos que dividem a região c×l no eixo do nível `esperado`. */
  const grupo = (nos: NoCorte[], esperado: Nivel, c: number, l: number, refilo: number) => {
    if (nos.length === 0) return;
    const eixoX = eixoDo(esperado) === 'X';
    const disponivel = eixoX ? c : l;
    let usado = refilo > 0 ? refilo + serra : 0;

    nos.forEach((no, i) => {
      if (no.nivel !== esperado) {
        erros.push({
          tipo: 'nivel',
          chapa: n,
          mensagem: `Nível ${no.nivel} onde se esperava ${esperado}`,
        });
      }
      if (indiceNivel(no.nivel) > maxIdx) {
        erros.push({
          tipo: 'niveis',
          chapa: n,
          mensagem: `Nível ${no.nivel} acima do máximo permitido`,
        });
      }
      usado += no.medida + (i > 0 ? serra : 0);

      if (no.filhos.length > 0) {
        if (no.pecaId !== undefined) {
          erros.push({
            tipo: 'folha-vazia',
            chapa: n,
            mensagem: `Nó ${no.nivel} com peça e filhos ao mesmo tempo`,
          });
        }
        const prox = proximoNivel(esperado);
        if (!prox) {
          erros.push({
            tipo: 'niveis',
            chapa: n,
            mensagem: `Nível ${no.nivel} não pode ser subdividido`,
          });
          return;
        }
        const [cc, ll] = eixoX ? [no.medida, l] : [c, no.medida];
        grupo(no.filhos, prox, cc, ll, no.refiloFilhos ?? 0);
      } else if (no.pecaId === undefined) {
        erros.push({
          tipo: 'folha-vazia',
          chapa: n,
          mensagem: `Nó ${no.nivel} ${no.medida} sem peça`,
        });
      }
    });

    if (usado > disponivel) {
      erros.push({
        tipo: 'excede',
        chapa: n,
        mensagem: `Nível ${esperado}: ${usado} mm usados em ${disponivel} mm disponíveis`,
      });
    }
  };

  grupo(chapa.nos, nivelInicial(chapa.inicio), chapa.comprimento, chapa.largura, chapa.refilo ?? 0);
}
