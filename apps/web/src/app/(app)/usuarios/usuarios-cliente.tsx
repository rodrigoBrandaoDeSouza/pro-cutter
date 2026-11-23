'use client';

import { useState } from 'react';
import { Pencil, Plus, ShieldCheck } from 'lucide-react';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { criarUsuario, editarUsuario } from './actions';

export interface UsuarioLista {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'USUARIO';
  ativo: boolean;
  criadoEm: string;
}

export function ListaUsuarios({ usuarios, meuId }: { usuarios: UsuarioLista[]; meuId: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="hidden sm:table-cell">E-mail</TableHead>
            <TableHead>Permissão</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => (
            <TableRow key={u.id} className={u.ativo ? '' : 'text-muted-foreground'}>
              <TableCell>
                <div className="font-medium">
                  {u.nome}
                  {u.id === meuId && (
                    <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground sm:hidden">{u.email}</div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{u.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  {u.papel === 'ADMIN' ? (
                    <Badge>
                      <ShieldCheck /> Administrador
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Usuário</Badge>
                  )}
                  {!u.ativo && <Badge variant="outline">Desativado</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <DialogoUsuario usuario={u} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Sem `usuario`: botão "Novo usuário". Com `usuario`: botão de editar. */
export function DialogoUsuario({ usuario }: { usuario?: UsuarioLista }) {
  const [aberto, setAberto] = useState(false);
  const editando = !!usuario;
  const [form, setForm] = useState({
    nome: usuario?.nome ?? '',
    email: usuario?.email ?? '',
    senha: '',
    papel: usuario?.papel ?? ('USUARIO' as const),
    ativo: usuario?.ativo ?? true,
  });
  const fechar = () => setAberto(false);
  const novo = useAcao(criarUsuario, { aoConcluir: fechar });
  const edicao = useAcao(editarUsuario, { aoConcluir: fechar });
  const { pendente, erros } = editando ? edicao : novo;

  const abrir = (v: boolean) => {
    setAberto(v);
    if (v) {
      novo.limparErros();
      edicao.limparErros();
      setForm({
        nome: usuario?.nome ?? '',
        email: usuario?.email ?? '',
        senha: '',
        papel: usuario?.papel ?? 'USUARIO',
        ativo: usuario?.ativo ?? true,
      });
    }
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (editando) {
      edicao.executar({
        id: usuario.id,
        nome: form.nome,
        papel: form.papel,
        ativo: form.ativo,
        novaSenha: form.senha,
      });
    } else {
      novo.executar({ nome: form.nome, email: form.email, senha: form.senha, papel: form.papel });
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger
        render={
          editando ? (
            <Button variant="ghost" size="icon" aria-label={`Editar ${usuario.nome}`} />
          ) : (
            <Button />
          )
        }
      >
        {editando ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Novo usuário
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={enviar} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
            <DialogDescription>
              {editando
                ? usuario.email
                : 'A pessoa entra com este e-mail e a senha que você definir.'}
            </DialogDescription>
          </DialogHeader>

          <Campo id="u-nome" rotulo="Nome" erro={erros.nome}>
            <Input
              id="u-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              aria-invalid={!!erros.nome}
              autoFocus
            />
          </Campo>
          {!editando && (
            <Campo id="u-email" rotulo="E-mail" erro={erros.email}>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={!!erros.email}
              />
            </Campo>
          )}
          <Campo
            id="u-senha"
            rotulo={editando ? 'Nova senha' : 'Senha'}
            erro={erros.senha ?? erros.novaSenha}
            dica={editando ? 'Deixe em branco para manter a atual.' : 'Mínimo de 8 caracteres.'}
          >
            <Input
              id="u-senha"
              type="password"
              autoComplete="new-password"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              aria-invalid={!!(erros.senha ?? erros.novaSenha)}
            />
          </Campo>
          <Campo id="u-papel" rotulo="Permissão">
            <SelectNativo
              id="u-papel"
              value={form.papel}
              onChange={(e) => setForm({ ...form, papel: e.target.value as 'ADMIN' | 'USUARIO' })}
            >
              <option value="USUARIO">Usuário: projetos e clientes</option>
              <option value="ADMIN">Administrador: também configurações e usuários</option>
            </SelectNativo>
          </Campo>
          {editando && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Acesso ativo
            </label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              {editando ? 'Salvar' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
