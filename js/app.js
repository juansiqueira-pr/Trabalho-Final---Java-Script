/**
 * @fileoverview Portal Acadêmico Web — app.js
 * Sistema de gerenciamento acadêmico com CRUD completo,
 * cálculo de médias, relatórios e persistência via localStorage.
 */

'use strict';

/*MÓDULO: Estado Global*/

/** @type {Array<Object>} Array principal de alunos */
let alunos = [];

/** @type {number} ID do próximo aluno a ser criado */
let proximoId = 1;

/** @type {number|null} ID do aluno sendo editado */
let alunoEmEdicao = null;

/** @type {number|null} ID do aluno com modal de notas aberto */
let alunoNotaId = null;

/** @type {{ col: string, dir: 'asc'|'desc' }} Estado de ordenação da tabela início */
let sortState = { col: 'nome', dir: 'asc' };

/** @type {{ col: string, dir: 'asc'|'desc' }} Estado de ordenação da tabela notas */
let sortStateNotas = { col: 'nome', dir: 'asc' };

/** @type {string} Termo de busca atual */
let termoBusca = '';

/*MÓDULO: DADOS / JSON*/

/**
 * Carrega os dados iniciais do arquivo JSON externo via fetch().
 * Se existirem dados no localStorage, os dados do JSON são mesclados
 * apenas se o localStorage estiver vazio.
 * @returns {Promise<void>}
 */
const carregarDados = async () => {
  const lsData = localStorage.getItem('portalAcademico_alunos');

  if (lsData) {
    //Dados já existem no localStorage — usá-los
    try {
      const parsed = JSON.parse(lsData);
      alunos = parsed.alunos || [];
      proximoId = alunos.length > 0
        ? Math.max(...alunos.map(a => a.id)) + 1
        : 1;
      inicializar();
      return;
    } catch (e) {
      console.warn('Dados do localStorage inválidos, carregando JSON:', e);
    }
  }

  //Sem dados no localStorage: carregar do arquivo JSON
  try {
    const response = await fetch('data/alunos.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    alunos = data.alunos || [];
    proximoId = alunos.length > 0
      ? Math.max(...alunos.map(a => a.id)) + 1
      : 1;
    salvarNoStorage();
  } catch (erro) {
    console.warn('Falha ao carregar JSON externo. Iniciando com array vazio.', erro);
    alunos = [];
  }

  inicializar();
};

/**
 * Persiste o array de alunos no localStorage (simulação de persistência).
 */
const salvarNoStorage = () => {
  localStorage.setItem('portalAcademico_alunos', JSON.stringify({ alunos }));
};

/*MÓDULO: UTILITÁRIOS*/

/**
 * Calcula a média de duas notas.
 * @param {number} nota1
 * @param {number} nota2
 * @returns {number}
 */
const calcularMedia = (nota1, nota2) =>
  parseFloat(((nota1 + nota2) / 2).toFixed(2));

/**
 * Determina a situação acadêmica com base na média.
 * @param {number|null|undefined} media
 * @returns {{ texto: string, classe: string }}
 */
const obterSituacao = (media) => {
  if (media === null || media === undefined || isNaN(media)) {
    return { texto: 'Sem Nota', classe: 'sem-nota' };
  }
  if (media >= 6) return { texto: 'Aprovado', classe: 'aprovado' };
  if (media >= 3) return { texto: 'Recuperação', classe: 'recuperacao' };
  return { texto: 'Reprovado', classe: 'reprovado' };
};

/**
 * Formata um valor de nota para exibição.
 * @param {number|null|undefined} valor
 * @returns {string}
 */
const formatarNota = (valor) =>
  (valor !== null && valor !== undefined && !isNaN(valor))
    ? parseFloat(valor).toFixed(1)
    : '—';

/**
 * Gera um ID único incremental.
 * @returns {number}
 */
const gerarId = () => proximoId++;

/**
 * Formata data ISO para exibição dd/mm/aaaa.
 * @param {string} isoDate
 * @returns {string}
 */
const formatarData = (isoDate) => {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
};

/*MÓDULO: TOAST (Notificações)*/
/**
 * Exibe uma notificação toast.
 * @param {string} mensagem
 * @param {'success'|'error'|'warning'|'info'} tipo
 * @param {number} [duracao=3000]
 */
const mostrarToast = (mensagem, tipo = 'info', duracao = 3000) => {
  const container = document.getElementById('toastContainer');
  const icons = {
    success: '✓',
    error:   '✕',
    warning: '!',
    info:    'i',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[tipo] || 'i'}</span>
    <span class="toast-message">${mensagem}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, duracao);
};

/*MÓDULO: NAVEGAÇÃO*/

/**
 * Navega para uma seção pelo seu ID.
 * Atualiza classes ativas no menu e na section.
 * @param {string} secaoId
 */
const navegarPara = (secaoId) => {
  //Ocultar todas as sections
  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.remove('active');
  });

  //Remover active de todos os links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });

  //Ativar section alvo
  const secao = document.getElementById(secaoId);
  if (secao) {
    secao.classList.add('active');
    // Re-disparar fade-in
    secao.style.animation = 'none';
    requestAnimationFrame(() => {
      secao.style.animation = '';
    });
  }

  //Ativar link correspondente
  const linkAtivo = document.querySelector(`.nav-link[data-section="${secaoId}"]`);
  if (linkAtivo) linkAtivo.classList.add('active');

  //Fechar sidebar mobile
  document.getElementById('sidebar').classList.remove('open');

  // Atualizar conteúdo dinâmico por seção
  if (secaoId === 'inicio')      renderizarTabela();
  if (secaoId === 'notas')       renderizarTabelaNotas();
  if (secaoId === 'relatorios')  renderizarRelatorios();
};

/**
 * Inicializa os eventos de navegação do menu lateral.
 */
const inicializarNavegacao = () => {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const secao = link.dataset.section;
      navegarPara(secao);
    });
  });

  //Hamburger para mobile
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar   = document.getElementById('sidebar');
  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  //Fechar sidebar ao clicar fora (mobile)
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
};

/*MÓDULO: CRUD — Criação / Atualização*/

/**
 * Valida os campos do formulário de cadastro.
 * @returns {{ valido: boolean, mensagem: string }}
 */
const validarFormulario = () => {
  const nome  = document.getElementById('inputNome').value.trim();
  const curso = document.getElementById('inputCurso').value;
  const sem   = document.getElementById('inputSemestre').value;
  const data  = document.getElementById('inputDataNasc').value;

  if (!nome)         return { valido: false, mensagem: 'O nome é obrigatório.' };
  if (nome.length < 3) return { valido: false, mensagem: 'O nome deve ter ao menos 3 caracteres.' };
  if (!curso)        return { valido: false, mensagem: 'Selecione um curso.' };
  if (!sem || parseInt(sem) < 1 || parseInt(sem) > 10)
    return { valido: false, mensagem: 'O semestre deve ser entre 1 e 10.' };
  if (!data)         return { valido: false, mensagem: 'Informe a data de nascimento.' };

  return { valido: true, mensagem: '' };
};

/**
 * Captura os dados do formulário e retorna um objeto aluno parcial.
 * @returns {{ nome: string, curso: string, semestre: number, dataNascimento: string }}
 */
const capturarFormulario = () => ({
  nome:           document.getElementById('inputNome').value.trim(),
  curso:          document.getElementById('inputCurso').value,
  semestre:       parseInt(document.getElementById('inputSemestre').value),
  dataNascimento: document.getElementById('inputDataNasc').value,
});

/**
 * Limpa todos os campos do formulário e reseta o modo.
 */
const limparFormulario = () => {
  document.getElementById('inputNome').value      = '';
  document.getElementById('inputCurso').value     = '';
  document.getElementById('inputSemestre').value  = '';
  document.getElementById('inputDataNasc').value  = '';
  document.getElementById('formTitle').innerText  = 'Novo Aluno';
  document.getElementById('btnCadastrar').innerHTML =
    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
    Cadastrar Aluno`;
  document.getElementById('btnCancelarEdicao').style.display = 'none';
  alunoEmEdicao = null;
};

/**
 * Popula o formulário com os dados de um aluno para edição.
 * @param {number} id - ID do aluno a editar
 */
const editarAluno = (id) => {
  const aluno = alunos.find(a => a.id === id);
  if (!aluno) return;

  alunoEmEdicao = id;

  document.getElementById('inputNome').value      = aluno.nome;
  document.getElementById('inputCurso').value     = aluno.curso;
  document.getElementById('inputSemestre').value  = aluno.semestre;
  document.getElementById('inputDataNasc').value  = aluno.dataNascimento;

  document.getElementById('formTitle').innerText = `Editando: ${aluno.nome}`;
  document.getElementById('btnCadastrar').innerHTML =
    `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z"/></svg>
    Salvar Alterações`;
  document.getElementById('btnCancelarEdicao').style.display = 'inline-flex';

  navegarPara('cadastro');
};

/**
 * Cancela o modo de edição e limpa o formulário.
 */
const cancelarEdicao = () => {
  limparFormulario();
  mostrarToast('Edição cancelada.', 'info');
};

/**
 * Cadastra um novo aluno ou salva alterações no modo de edição.
 * Fluxo: Validar → Criar/Atualizar objeto → Array → localStorage → DOM → Dashboard
 */
const cadastrarOuSalvar = () => {
  const validacao = validarFormulario();
  if (!validacao.valido) {
    mostrarToast(validacao.mensagem, 'error');
    return;
  }

  const dados = capturarFormulario();

  if (alunoEmEdicao !== null) {
    // UPDATE
    const idx = alunos.findIndex(a => a.id === alunoEmEdicao);
    if (idx !== -1) {
      alunos[idx] = { ...alunos[idx], ...dados };
      mostrarToast(`Aluno "${dados.nome}" atualizado com sucesso!`, 'success');
    }
  } else {
    // CREATE
    const novoAluno = {
      id: gerarId(),
      nota1: null,
      nota2: null,
      ...dados,
    };
    alunos.push(novoAluno);
    mostrarToast(`Aluno "${dados.nome}" cadastrado com sucesso!`, 'success');
  }

  salvarNoStorage();
  limparFormulario();
  atualizarDashboard();
  renderizarTabela();
};

/**
 * Remove um aluno do array após confirmação.
 * @param {number} id - ID do aluno a remover
 */
const excluirAluno = (id) => {
  const aluno = alunos.find(a => a.id === id);
  if (!aluno) return;

  const confirmar = confirm(`Tem certeza que deseja excluir o aluno "${aluno.nome}"?`);
  if (!confirmar) return;

  alunos = alunos.filter(a => a.id !== id);
  salvarNoStorage();
  atualizarDashboard();
  renderizarTabela();
  renderizarTabelaNotas();
  mostrarToast(`Aluno "${aluno.nome}" removido.`, 'warning');
};

/*MÓDULO: NOTAS*/
/**
 * Abre o modal de lançamento de notas para um aluno.
 * @param {number} id - ID do aluno
 */
const abrirModalNotas = (id) => {
  const aluno = alunos.find(a => a.id === id);
  if (!aluno) return;

  alunoNotaId = id;

  document.getElementById('modalAlunoNome').value = aluno.nome;
  document.getElementById('modalNota1').value     = aluno.nota1 ?? '';
  document.getElementById('modalNota2').value     = aluno.nota2 ?? '';

  atualizarPreviewMedia();
  document.getElementById('modalNotasOverlay').classList.add('open');
};

/**
 * Fecha o modal de notas.
 */
const fecharModal = () => {
  document.getElementById('modalNotasOverlay').classList.remove('open');
  alunoNotaId = null;
};

/**
 * Atualiza o preview da média dentro do modal em tempo real.
 */
const atualizarPreviewMedia = () => {
  const n1 = parseFloat(document.getElementById('modalNota1').value);
  const n2 = parseFloat(document.getElementById('modalNota2').value);
  const preview   = document.getElementById('modalPreview');
  const mediaEl   = document.getElementById('mediaPreview');
  const situacaoEl = document.getElementById('situacaoPreview');

  if (!isNaN(n1) && !isNaN(n2)) {
    const media    = calcularMedia(n1, n2);
    const situacao = obterSituacao(media);
    mediaEl.innerText   = media.toFixed(1);
    situacaoEl.innerText = situacao.texto;
    situacaoEl.className = `situacao-badge ${situacao.classe}`;
    preview.style.display = 'flex';
  } else {
    preview.style.display = 'none';
  }
};

/**
 * Salva as notas do aluno, calcula média e situação, e atualiza tudo.
 */
const salvarNotas = () => {
  if (alunoNotaId === null) return;

  const n1 = parseFloat(document.getElementById('modalNota1').value);
  const n2 = parseFloat(document.getElementById('modalNota2').value);

  if (isNaN(n1) || n1 < 0 || n1 > 10) {
    mostrarToast('Nota 1 inválida. Deve ser entre 0 e 10.', 'error');
    return;
  }
  if (isNaN(n2) || n2 < 0 || n2 > 10) {
    mostrarToast('Nota 2 inválida. Deve ser entre 0 e 10.', 'error');
    return;
  }

  const idx = alunos.findIndex(a => a.id === alunoNotaId);
  if (idx !== -1) {
    alunos[idx].nota1 = n1;
    alunos[idx].nota2 = n2;
    alunos[idx].media = calcularMedia(n1, n2);
  }

  salvarNoStorage();
  fecharModal();
  atualizarDashboard();
  renderizarTabela();
  renderizarTabelaNotas();
  mostrarToast('Notas salvas e média calculada!', 'success');
};

/*MÓDULO: ORDENAÇÃO*/

/**
 * Ordena o array de alunos por um campo, alternando asc/desc.
 * @param {string} col - Campo a ordenar
 * @param {'inicio'|'notas'} contexto - Qual tabela
 */
const ordenarPor = (col, contexto = 'inicio') => {
  const state = contexto === 'inicio' ? sortState : sortStateNotas;

  if (state.col === col) {
    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.col = col;
    state.dir = 'asc';
  }

  if (contexto === 'inicio') {
    renderizarTabela();
  } else {
    renderizarTabelaNotas();
  }
};

/**
 * Retorna uma cópia dos alunos ordenada conforme o estado de sort.
 * @param {{ col: string, dir: 'asc'|'desc' }} state
 * @returns {Array<Object>}
 */
const alunosOrdenados = (state) => {
  const { col, dir } = state;

  return [...alunos].sort((a, b) => {
    let va = a[col];
    let vb = b[col];

    // Tratar valores nulos/undefined (sem nota)
    if (col === 'media') {
      va = a.nota1 !== null && a.nota2 !== null
        ? calcularMedia(a.nota1, a.nota2)
        : -Infinity;
      vb = b.nota1 !== null && b.nota2 !== null
        ? calcularMedia(b.nota1, b.nota2)
        : -Infinity;
    }

    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();

    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ?  1 : -1;
    return 0;
  });
};

/**
 * Atualiza os ícones de ordenação nos cabeçalhos de uma tabela.
 * @param {HTMLElement} thead
 * @param {{ col: string, dir: 'asc'|'desc' }} state
 */
const atualizarIconesSort = (thead, state) => {
  thead.querySelectorAll('th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = '↕';

    if (th.dataset.col === state.col) {
      th.classList.add(state.dir === 'asc' ? 'sort-asc' : 'sort-desc');
      if (icon) icon.textContent = state.dir === 'asc' ? '▲' : '▼';
    }
  });
};

/*MÓDULO: RENDERIZAÇÃO DOM*/

/**
 * Cria uma célula <td> via createElement + innerText.
 * @param {string|number} conteudo
 * @returns {HTMLTableCellElement}
 */
const criarCelula = (conteudo) => {
  const td = document.createElement('td');
  td.innerText = conteudo;
  return td;
};

/**
 * Cria o badge de situação acadêmica como elemento DOM.
 * @param {number|null} nota1
 * @param {number|null} nota2
 * @returns {HTMLTableCellElement}
 */
const criarCelulaSituacao = (nota1, nota2) => {
  const td = document.createElement('td');
  const media = (nota1 !== null && nota2 !== null) ? calcularMedia(nota1, nota2) : null;
  const situacao = obterSituacao(media);

  const badge = document.createElement('span');
  badge.className = `situacao-badge ${situacao.classe}`;
  badge.innerText = situacao.texto;

  td.appendChild(badge);
  return td;
};

/**
 * Renderiza a tabela principal de alunos no Início.
 * Utiliza createElement, appendChild e innerText conforme requisito.
 */
const renderizarTabela = () => {
  const tbody = document.getElementById('alunosTableBody');
  const thead = document.querySelector('#alunosTable thead');
  const emptyState = document.getElementById('emptyState');

  // Atualizar ícones sort
  atualizarIconesSort(thead, sortState);

  // Limpar tbody
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  // Filtrar por busca
  const listaOrdenada = alunosOrdenados(sortState).filter(a =>
    termoBusca === '' ||
    a.nome.toLowerCase().includes(termoBusca.toLowerCase())
  );

  if (listaOrdenada.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  listaOrdenada.forEach(aluno => {
    const tr = document.createElement('tr');

    // Nome
    const tdNome = document.createElement('td');
    tdNome.innerText = aluno.nome;
    tr.appendChild(tdNome);

    // Curso
    tr.appendChild(criarCelula(aluno.curso));

    // Semestre
    tr.appendChild(criarCelula(`${aluno.semestre}º`));

    // Média
    const media = (aluno.nota1 !== null && aluno.nota2 !== null)
      ? calcularMedia(aluno.nota1, aluno.nota2)
      : null;
    tr.appendChild(criarCelula(media !== null ? media.toFixed(1) : '—'));

    // Situação
    tr.appendChild(criarCelulaSituacao(aluno.nota1, aluno.nota2));

    // Ações
    const tdAcoes = document.createElement('td');
    const divAcoes = document.createElement('div');
    divAcoes.className = 'action-btns';

    const btnEditar = document.createElement('button');
    btnEditar.className = 'btn btn--warning btn--sm';
    btnEditar.innerText = 'Editar';
    btnEditar.dataset.id = aluno.id;
    btnEditar.addEventListener('click', () => editarAluno(aluno.id));

    const btnExcluir = document.createElement('button');
    btnExcluir.className = 'btn btn--danger btn--sm';
    btnExcluir.innerText = 'Excluir';
    btnExcluir.dataset.id = aluno.id;
    btnExcluir.addEventListener('click', () => excluirAluno(aluno.id));

    divAcoes.appendChild(btnEditar);
    divAcoes.appendChild(btnExcluir);
    tdAcoes.appendChild(divAcoes);
    tr.appendChild(tdAcoes);

    tbody.appendChild(tr);
  });
};

/**
 * Renderiza a tabela de lançamento de notas.
 */
const renderizarTabelaNotas = () => {
  const tbody = document.getElementById('notasTableBody');
  const thead = document.querySelector('#notasTable thead');

  atualizarIconesSort(thead, sortStateNotas);

  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  const lista = alunosOrdenados(sortStateNotas);

  if (lista.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.innerText = 'Nenhum aluno cadastrado.';
    td.style.textAlign = 'center';
    td.style.padding = '40px';
    td.style.color = '#64748B';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  lista.forEach(aluno => {
    const tr = document.createElement('tr');

    tr.appendChild(criarCelula(aluno.nome));
    tr.appendChild(criarCelula(aluno.curso));
    tr.appendChild(criarCelula(`${aluno.semestre}º`));

    const media = (aluno.nota1 !== null && aluno.nota2 !== null)
      ? calcularMedia(aluno.nota1, aluno.nota2)
      : null;
    tr.appendChild(criarCelula(media !== null ? media.toFixed(1) : '—'));

    tr.appendChild(criarCelulaSituacao(aluno.nota1, aluno.nota2));

    const tdAcao = document.createElement('td');
    const btnNotas = document.createElement('button');
    btnNotas.className = 'btn btn--primary btn--sm';
    btnNotas.innerText = 'Notas';
    btnNotas.dataset.id = aluno.id;
    btnNotas.addEventListener('click', () => abrirModalNotas(aluno.id));
    tdAcao.appendChild(btnNotas);
    tr.appendChild(tdAcao);

    tbody.appendChild(tr);
  });
};

/*MÓDULO: DASHBOARD*/

/**
 * Atualiza os cards do dashboard com os dados atuais.
 * Fluxo: Array → cálculos reduce/filter → DOM
 */
const atualizarDashboard = () => {
  const total = alunos.length;

  const { aprovados, recuperacao, reprovados } = alunos.reduce(
    (acc, a) => {
      if (a.nota1 === null || a.nota2 === null) return acc;
      const media = calcularMedia(a.nota1, a.nota2);
      const sit   = obterSituacao(media).classe;
      if (sit === 'aprovado')    acc.aprovados++;
      if (sit === 'recuperacao') acc.recuperacao++;
      if (sit === 'reprovado')   acc.reprovados++;
      return acc;
    },
    { aprovados: 0, recuperacao: 0, reprovados: 0 }
  );

  document.getElementById('totalAlunos').innerText     = total;
  document.getElementById('totalAprovados').innerText  = aprovados;
  document.getElementById('totalRecuperacao').innerText = recuperacao;
  document.getElementById('totalReprovados').innerText = reprovados;
};

/*MÓDULO: RELATÓRIOS*/

/**
 * Cria um card de relatório.
 * @param {string} label
 * @param {string|number} valor
 * @param {string} [classeValor='']
 * @returns {HTMLDivElement}
 */
const criarCardRelatorio = (label, valor, classeValor = '') => {
  const card = document.createElement('div');
  card.className = 'report-card';

  const lbl = document.createElement('div');
  lbl.className = 'report-card__label';
  lbl.innerText = label;

  const val = document.createElement('div');
  val.className = `report-card__value ${classeValor}`;
  val.innerText = valor;

  card.appendChild(lbl);
  card.appendChild(val);
  return card;
};

/**
 * Renderiza todos os relatórios estatísticos.
 * Usa map, filter, find, reduce conforme requisito.
 */
const renderizarRelatorios = () => {
  // --- RELATÓRIO GERAL ---
  const geralEl = document.getElementById('relatorioGeral');
  while (geralEl.firstChild) geralEl.removeChild(geralEl.firstChild);

  const total = alunos.length;
  const comNota = alunos.filter(a => a.nota1 !== null && a.nota2 !== null);

  const { aprov, recup, reprov } = comNota.reduce(
    (acc, a) => {
      const sit = obterSituacao(calcularMedia(a.nota1, a.nota2)).classe;
      if (sit === 'aprovado')    acc.aprov++;
      if (sit === 'recuperacao') acc.recup++;
      if (sit === 'reprovado')   acc.reprov++;
      return acc;
    },
    { aprov: 0, recup: 0, reprov: 0 }
  );

  geralEl.appendChild(criarCardRelatorio('Total de Alunos', total, 'azul'));
  geralEl.appendChild(criarCardRelatorio('Aprovados', aprov, 'verde'));
  geralEl.appendChild(criarCardRelatorio('Recuperação', recup, 'laranja'));
  geralEl.appendChild(criarCardRelatorio('Reprovados', reprov, 'vermelho'));

  // --- RELATÓRIO CURSOS ---
  const cursosEl = document.getElementById('relatorioCursos');
  while (cursosEl.firstChild) cursosEl.removeChild(cursosEl.firstChild);

  const cursos = ['ADS', 'ESOFT', 'PSICO'];
  const contagemCursos = cursos.map(c => ({
    curso: c,
    total: alunos.filter(a => a.curso === c).length,
  }));

  cursosEl.appendChild(criarCardRelatorio('Total de Alunos', total, 'azul'));
  contagemCursos.forEach(({ curso, total: t }) => {
    cursosEl.appendChild(criarCardRelatorio(`Alunos em ${curso}`, t));
  });

  // --- RELATÓRIO DESEMPENHO ---
  const desempEl = document.getElementById('relatorioDesempenho');
  while (desempEl.firstChild) desempEl.removeChild(desempEl.firstChild);

  if (comNota.length === 0) {
    const msg = document.createElement('p');
    msg.innerText = 'Nenhuma nota lançada ainda.';
    msg.style.padding = '16px';
    msg.style.color   = '#64748B';
    desempEl.appendChild(msg);
  } else {
    const medias = comNota.map(a => calcularMedia(a.nota1, a.nota2));
    const maiorMedia = Math.max(...medias);
    const menorMedia = Math.min(...medias);
    const mediaGeral = medias.reduce((s, m) => s + m, 0) / medias.length;

    const qtdMaior     = medias.filter(m => m === maiorMedia).length;
    const qtdAcima     = medias.filter(m => m > mediaGeral).length;
    const qtdAbaixo    = medias.filter(m => m < mediaGeral).length;

    desempEl.appendChild(criarCardRelatorio('Maior Média', maiorMedia.toFixed(1), 'verde'));
    desempEl.appendChild(criarCardRelatorio('Menor Média', menorMedia.toFixed(1), 'vermelho'));
    desempEl.appendChild(criarCardRelatorio('Média Geral', mediaGeral.toFixed(1), 'azul'));
    desempEl.appendChild(criarCardRelatorio('Com Maior Média', qtdMaior));
    desempEl.appendChild(criarCardRelatorio('Acima da Média', qtdAcima, 'verde'));
    desempEl.appendChild(criarCardRelatorio('Abaixo da Média', qtdAbaixo, 'vermelho'));
  }

  // --- TOP 5 ---
  const top5Body = document.getElementById('top5TableBody');
  while (top5Body.firstChild) top5Body.removeChild(top5Body.firstChild);

  const top5 = comNota
    .map(a => ({ ...a, media: calcularMedia(a.nota1, a.nota2) }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 5);

  if (top5.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.innerText = 'Nenhuma nota lançada.';
    td.style.textAlign = 'center';
    td.style.padding   = '32px';
    td.style.color     = '#64748B';
    tr.appendChild(td);
    top5Body.appendChild(tr);
    return;
  }

  top5.forEach((aluno, idx) => {
    const tr = document.createElement('tr');
    const pos = idx + 1;

    const tdPos = document.createElement('td');
    const posEl = document.createElement('span');
    const posClasse = pos <= 3 ? `pos-${pos}` : 'pos-other';
    posEl.className = `top5-position ${posClasse}`;
    posEl.innerText = pos;
    tdPos.appendChild(posEl);
    tr.appendChild(tdPos);

    tr.appendChild(criarCelula(aluno.nome));
    tr.appendChild(criarCelula(aluno.curso));
    tr.appendChild(criarCelula(aluno.media.toFixed(1)));
    tr.appendChild(criarCelulaSituacao(aluno.nota1, aluno.nota2));

    top5Body.appendChild(tr);
  });
};

/*MÓDULO: EVENTOS*/

/**
 * Inicializa todos os event listeners da aplicação.
 */
const inicializarEventos = () => {
  //Busca por nome
  document.getElementById('searchInput').addEventListener('input', (e) => {
    termoBusca = e.target.value;
    renderizarTabela();
  });

  //Fechar modal ao clicar fora
  document.getElementById('modalNotasOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalNotasOverlay')) {
      fecharModal();
    }
  });

  //Preview de média no modal
  document.getElementById('modalNota1').addEventListener('input', atualizarPreviewMedia);
  document.getElementById('modalNota2').addEventListener('input', atualizarPreviewMedia);

  //Tecla ESC fecha modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
  });

  //Ordenação tabela início
  document.querySelectorAll('#alunosTable thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      ordenarPor(th.dataset.col, 'inicio');
    });
  });

  //Ordenação tabela notas
  document.querySelectorAll('#notasTable thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      ordenarPor(th.dataset.col, 'notas');
    });
  });
};

/*MÓDULO: INICIALIZAÇÃO*/

/**
 * Inicializa a aplicação após carregamento dos dados.
 */
const inicializar = () => {
  inicializarNavegacao();
  inicializarEventos();
  atualizarDashboard();
  renderizarTabela();
  navegarPara('inicio');
};

// ---- ENTRY POINT ----
document.addEventListener('DOMContentLoaded', () => {
  carregarDados();
});
