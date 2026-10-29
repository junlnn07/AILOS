
create table if not exists operadores (
  id          text primary key,
  nome        text not null,
  login       text not null unique,
  criado_em   bigint,
  senha_hash  text
);

create table if not exists acordos (
  id             text primary key,
  operador       text not null,
  cpf            text not null default '',
  nome           text not null default '',
  telefone       text not null default '',
  tipo           text not null default '',
  valor          numeric(14,2) not null default 0,
  qtd_parc       integer not null default 1,
  valor_parc     numeric(14,2) not null default 0,
  venc           text not null default '',
  coop           text not null default '',
  fechado        text not null default '',
  ativo          text not null default 'Sim',
  status         text not null default 'prazo',
  criado_em      bigint,
  dia            text not null default '',
  atualizado_em  bigint
);
create index if not exists acordos_operador_idx on acordos (operador);
create index if not exists acordos_status_idx   on acordos (status);

create table if not exists base (
  id        text primary key,
  destino   text not null default 'TODOS',
  coop      text not null default '',
  doc       text not null default '',
  nome      text not null default '',
  razao     text not null default '',
  atraso    integer not null default 0,
  saldo     numeric(14,2) not null default 0,
  tel       text not null default '',
  garantia  text not null default '',
  msg_por   text not null default '',
  msg_em    text not null default ''
);
create index if not exists base_destino_idx on base (destino);
create index if not exists base_doc_idx on base ((regexp_replace(doc, '\D', '', 'g')));
