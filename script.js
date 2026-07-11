// ==========================================
// INFRAESTRUTURA CORE
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let estrelasAtivas = 0;
let debounceTimer; 
let currentUserUID = null;
let modoPlayerAtual = 'geral';
let filtroBuscaAtual = 'all';
let ultimoTermoBusca = '';

let perfilUsuario = {
    username: "Operador",
    avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
};
let avatarTemp = "";

// ==========================================
// INSTANCIAÇÃO DO FIREBASE (NUVEM)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAfPWvnGdvPKZ_lrVwOuag14WHLY9AgML8",
    authDomain: "cinenet-ifpb.firebaseapp.com",
    projectId: "cinenet-ifpb",
    storageBucket: "cinenet-ifpb.firebasestorage.app",
    messagingSenderId: "1098247355110",
    appId: "1:1098247355110:web:c9f867826f26b0ef171927"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
let biblioteca = { watchlist: {}, reviews: {} };
let isLoginMode = true;

// FUNÇÃO GERENCIADORA DE SCROLL
function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

// ESCUTA DE SESSÃO
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        db.collection("usuarios").doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if(data.biblioteca) biblioteca = data.biblioteca;
                if(data.perfil) perfilUsuario = data.perfil;
            } else {
                recuperarCacheFallback(user);
            }
            atualizarInterfacePerfil();
            renderizarMinhaLista();
        }).catch(() => {
            recuperarCacheFallback(user);
            atualizarInterfacePerfil();
            renderizarMinhaLista(); 
        });
    } else {
        if (currentUserUID !== "guest") {
            currentUserUID = null;
            document.getElementById('main-app').style.display = 'none';
            document.getElementById('auth-screen').style.display = 'flex';
        }
    }
});

function entrarComoConvidado() {
    currentUserUID = "guest"; 
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };
    perfilUsuario = JSON.parse(localStorage.getItem('cineNetflixPerfil')) || { username: "Convidado_VIP", avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" };
    
    atualizarInterfacePerfil();
    renderizarMinhaLista();
}

function recuperarCacheFallback(user) {
    biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };
    perfilUsuario = JSON.parse(localStorage.getItem('cineNetflixPerfil')) || { username: user ? user.email.split('@')[0] : "Operador", avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" };
}

function atualizarInterfacePerfil() {
    const pcTxt = document.getElementById('nav-username-txt-pc');
    const pcImg = document.getElementById('nav-avatar-img-pc');
    if(pcTxt) pcTxt.innerText = perfilUsuario.username;
    if(pcImg) pcImg.src = perfilUsuario.avatar;
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'NÚCLEO DE TRANSMISSÃO' : 'REQUISITAR NOVO ACESSO';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'AUTENTICAR SISTEMA' : 'REGISTRAR CREDENCIAIS';
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Novo por aqui?' : 'Já possui registro?';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Criar conta de acesso' : 'Fazer Login';
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    btn.innerText = "SINCRO_PROCESSANDO..."; btn.disabled = true;
    errorBox.style.display = 'none';

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            if (error.code === 'auth/user-not-found') {
                errorBox.innerText = "Usuário não encontrado. Registre-se abaixo.";
            } else if (error.code === 'auth/wrong-password') {
                errorBox.innerText = "Senha incorreta para este operador.";
            } else if (error.code === 'auth/invalid-email') {
                errorBox.innerText = "Formato de e-mail inválido (ex: usuario@email.com).";
            } else {
                errorBox.innerText = "Erro: " + error.message;
            }
            errorBox.style.display = 'block'; btn.disabled = false; btn.innerText = "AUTENTICAR SISTEMA";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email, 
                perfil: { username: email.split('@')[0], avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" },
                biblioteca: { watchlist: {}, reviews: {} }
            });
            btn.disabled = false;
        }).catch((error) => {
            errorBox.innerText = "Erro no registro: " + error.message;
            errorBox.style.display = 'block'; btn.disabled = false; btn.innerText = "REGISTRAR CREDENCIAIS";
        });
    }
}

function fazerLogout() { 
    auth.signOut().then(() => { window.location.reload(); }).catch(() => { window.location.reload(); });
}

function salvarDados() {
    localStorage.setItem('cineNetflixLibV2', JSON.stringify(biblioteca)); 
    localStorage.setItem('cineNetflixPerfil', JSON.stringify(perfilUsuario)); 

    if (currentUserUID && currentUserUID !== "guest") {
        db.collection("usuarios").doc(currentUserUID).update({ 
            biblioteca: biblioteca,
            perfil: perfilUsuario 
        }).then(() => renderizarMinhaLista()).catch(() => renderizarMinhaLista());
    } else {
        renderizarMinhaLista();
    }
}

// ==========================================
// MÓDULO DE PERFIL
// ==========================================
function abrirModalPerfil() {
    document.getElementById('edit-profile-username').value = perfilUsuario.username;
    avatarTemp = perfilUsuario.avatar;
    document.querySelectorAll('.selectable-avatar').forEach(img => {
        if(img.src === perfilUsuario.avatar) img.classList.add('active');
        else img.classList.remove('active');
    });
    document.getElementById('profileModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModalPerfil() {
    document.getElementById('profileModal').style.display = 'none';
    alternarScrollBody(false);
}

function selecionarAvatarNoModal(elemento, url) {
    document.querySelectorAll('.selectable-avatar').forEach(img => img.classList.remove('active'));
    elemento.classList.add('active');
    avatarTemp = url;
}

function guardarAlteracoesPerfil() {
    const novoNome = document.getElementById('edit-profile-username').value.trim();
    if(!novoNome) { alert("Nome inválido."); return; }
    perfilUsuario.username = novoNome;
    perfilUsuario.avatar = avatarTemp;
    atualizarInterfacePerfil();
    salvarDados();
    fecharModalPerfil();
}

// ==========================================
// ENGINE DE CARROSSEIS
// ==========================================
function injetarEstruturaRow(idContainer, tituloRow) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    if (!wrapper || document.getElementById(`${idContainer}-section`)) return;
    
    const rowHtml = `
        <div class="movie-row" id="${idContainer}-section">
            <div class="row-header">
                <h2 class="section-title">${tituloRow}</h2>
                <span class="row-counter" id="count-${idContainer}">SINC...</span>
            </div>
            <div class="row-wrapper">
                <button class="scroll-btn left" onclick="scrollRow('${idContainer}', -1)">❮</button>
                <div class="row-posters" id="${idContainer}"></div>
                <button class="scroll-btn right" onclick="scrollRow('${idContainer}', 1)">❯</button>
            </div>
        </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', rowHtml);
}

function scrollRow(idElemento, direcao) {
    const container = document.getElementById(idElemento);
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: scrollAmount * direcao, behavior: 'smooth' });
}

async function montarPostersMultiPage(urls, targetId, tipoFixo) {
    const container = document.getElementById(targetId);
    if(!container) return;
    container.innerHTML = ''; 
    let totalItemsCarregados = 0;

    for (let url of urls) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if(!data.results) continue;

            data.results.forEach(item => {
                if(!item.poster_path) return;
                totalItemsCarregados++;
                item.custom_type = tipoFixo || item.media_type || (item.name ? 'tv' : 'movie');
                
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = () => abrirModal(item);
                
                const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-bar"></div>` : "";
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}" loading="lazy">${estaNaLista}`;
                container.appendChild(card);
            });
        } catch (err) { console.error(err); }
    }
    const counterEl = document.getElementById(`count-${targetId}`);
    if(counterEl) counterEl.innerText = `[ ${totalItemsCarregados} ARQUIVOS ]`;
}

async function carregarDashboard() {
    injetarEstruturaRow('row-movies', '🎬 Filmes em Destaque');
    injetarEstruturaRow('row-series', '📺 Séries e Produções');
    injetarEstruturaRow('row-animes', '🗡️ Universo Anime');
    injetarEstruturaRow('row-cartoons', '🎨 Desenhos Clássicos');
    injetarEstruturaRow('row-watchlist', '⭐ Minha Lista Pessoal');

    try {
        const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
        const dataTrending = await resTrending.json();
        if(dataTrending.results && dataTrending.results.length > 0) configurarHero(dataTrending.results[0]);
    } catch(e) { console.error(e); }

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=28&page=1`
    ], 'row-movies', 'movie');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=18&page=1`
    ], 'row-series', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&page=1`
    ], 'row-animes', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en&page=1`
    ], 'row-cartoons', 'tv');

    renderizarMinhaLista();
}

function configurarHero(item) {
    const banner = document.getElementById('hero-banner');
    if(!banner) return;
    banner.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;
    document.getElementById('hero-title').innerText = item.title || item.name;
    document.getElementById('hero-synopsis').innerText = item.overview ? item.overview.substring(0, 180) + "..." : "Sinopse operacional do sistema.";
    item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
    document.getElementById('hero-play-btn').onclick = () => { itemSelecionado = item; abrirPlayerAtual('geral'); };
}

function renderizarMinhaLista() {
    const container = document.getElementById('row-watchlist');
    const section = document.getElementById('row-watchlist-section');
    if(!container || !section) return;

    const itens = Object.values(biblioteca.watchlist).reverse();
    const counterEl = document.getElementById(`count-row-watchlist`);

    if(itens.length === 0) { 
        section.style.display = 'none'; 
        if(counterEl) counterEl.innerText = "[ 0 ARQUIVOS ]";
        return; 
    }
    section.style.display = 'block';
    if(counterEl) counterEl.innerText = `[ ${itens.length} ARQUIVOS ]`;
    container.innerHTML = '';
    itens.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = () => abrirModal(item);
        card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}"><div class="watched-bar"></div>`;
        container.appendChild(card);
    });
}

// ==========================================
// ABA DE BUSCA DEDICADA & SISTEMA DE NAVEGAÇÃO
// ==========================================
function mostrarHome() {
    document.getElementById('homepage-content').style.display = 'block';
    document.getElementById('search-results-section').style.display = 'none';
    
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-wrapper a').forEach(a => a.classList.remove('active'));
}

function mostrarPesquisaTab() {
    document.getElementById('homepage-content').style.display = 'none';
    document.getElementById('search-results-section').style.display = 'block';
    
    document.querySelectorAll('.nav-menu a').forEach(a => {
        a.classList.remove('active');
        if(a.getAttribute('href') === '#search-results-section') a.classList.add('active');
    });
    document.querySelectorAll('.mobile-nav-wrapper a').forEach(a => {
        a.classList.remove('active');
        if(a.getAttribute('href') === '#search-results-section') a.classList.add('active');
    });
    
    const inputMain = document.getElementById('main-search-input');
    if(inputMain) inputMain.focus();
}

function alterarFiltroBusca(filtro, elemento) {
    filtroBuscaAtual = filtro;
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    if(elemento) elemento.classList.add('active');
    executarBuscaGlobal(ultimoTermoBusca);
}

function limparBuscaPagina() {
    document.getElementById('main-search-input').value = '';
    const pcInput = document.querySelector('.search-input-field');
    if(pcInput) pcInput.value = '';
    ultimoTermoBusca = '';
    document.getElementById('search-grid').innerHTML = '<p style="color: #666; padding: 20px;">Digite algo para iniciar a pesquisa...</p>';
}

const inputsBusca = ['.search-input-field', '#main-search-input'];
inputsBusca.forEach(seletor => {
    const el = document.querySelector(seletor);
    if(!el) return;
    el.addEventListener('input', (e) => {
        const termo = e.target.value;
        inputsBusca.forEach(s => {
            const inputOut = document.querySelector(s);
            if(inputOut && inputOut !== e.target) inputOut.value = termo;
        });
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => executarBuscaGlobal(termo), 400);
    });
});

async function executarBuscaGlobal(termo) {
    ultimoTermoBusca = termo;
    const grid = document.getElementById('search-grid');

    if(!termo.trim()) { 
        grid.innerHTML = '<p style="color: #666; padding: 20px;">Digite algo para iniciar a pesquisa...</p>'; 
        return; 
    }

    document.getElementById('homepage-content').style.display = 'none';
    document.getElementById('search-results-section').style.display = 'block';
    grid.innerHTML = '<p style="color: var(--primary-neon); padding: 20px;">Pesquisando servidores centrais...</p>';

    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(termo)}`);
        const data = await res.json();
        if(!data.results) {
            grid.innerHTML = '<p style="color: #666; padding: 20px;">Nenhum registro encontrado.</p>';
            return;
        }

        let filtrados = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
        
        // Aplicação inteligente de filtros baseada no tipo de conteúdo e metadados originais
        if (filtroBuscaAtual !== 'all') {
            filtrados = filtrados.filter(item => {
                const type = item.media_type || (item.name ? 'tv' : 'movie');
                const genres = item.genre_ids || [];
                const lang = item.original_language || '';
                
                if (filtroBuscaAtual === 'movie') {
                    return type === 'movie';
                }
                if (filtroBuscaAtual === 'tv') {
                    return type === 'tv' && !genres.includes(16); // Séries que não são animações
                }
                if (filtroBuscaAtual === 'anime') {
                    return genres.includes(16) && lang === 'ja'; // Animação em Japonês
                }
                if (filtroBuscaAtual === 'cartoon') {
                    return genres.includes(16) && lang !== 'ja'; // Animação Ocidental
                }
                return true;
            });
        }
        
        grid.innerHTML = '';
        if(filtrados.length === 0) { 
            grid.innerHTML = '<p style="color: #666; padding: 20px;">Nenhum registro encontrado para esta categoria.</p>'; 
            return; 
        }

        filtrados.forEach(item => {
            item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
            const card = document.createElement('div');
            card.className = 'movie-card'; card.style.width = '100%';
            card.onclick = () => abrirModal(item);
            
            const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-bar"></div>` : "";
            card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}">${estaNaLista}`;
            grid.appendChild(card);
        });
    } catch(err) { 
        console.error(err); 
        grid.innerHTML = '<p style="color: #666; padding: 20px;">Erro ao processar busca.</p>';
    }
}

function limparBusca() {
    inputsBusca.forEach(s => { const el = document.querySelector(s); if(el) el.value = ""; });
    ultimoTermoBusca = '';
}

// ==========================================
// MODAL DE DETALHES
// ==========================================
function abrirModal(item) {
    itemSelecionado = item;
    const id = item.id;
    const tipo = item.custom_type;

    document.getElementById('modal-hero-bg').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}')`;
    document.getElementById('modal-title').innerText = item.title || item.name;
    document.getElementById('modal-desc').innerText = item.overview || "Ficheiro protegido sem descrição associada.";
    
    const baseMatch = item.vote_average ? Math.floor(item.vote_average * 10) : 88;
    document.getElementById('modal-match').innerText = `${baseMatch}% de Match`;
    document.getElementById('modal-year').innerText = (item.release_date || item.first_air_date || '2026').substring(0,4);

    const btnEspecifico = document.getElementById('btn-player-especifico');
    if (btnEspecifico) btnEspecifico.style.display = (tipo === 'movie') ? 'none' : 'inline-flex';

    const btnList = document.getElementById('modal-watchlist-btn');
    if(biblioteca.watchlist[id]) {
        btnList.innerText = '✓ Na Minha Lista';
        btnList.style.borderColor = '#00ff88'; btnList.style.color = '#00ff88'; btnList.style.background = 'rgba(0, 255, 136, 0.1)';
    } else {
        btnList.innerText = '+ A Minha Lista';
        btnList.style.borderColor = 'rgba(255,255,255,0.2)'; btnList.style.color = 'white'; btnList.style.background = 'rgba(255,255,255,0.05)';
    }

    const dadosReview = biblioteca.reviews[id] || { rating: 0, text: "" };
    definirEstrelas(dadosReview.rating, false);
    document.getElementById('review-text').value = dadosReview.text;

    document.getElementById('detailsModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModal() { document.getElementById('detailsModal').style.display = 'none'; alternarScrollBody(false); }

function toggleWatchlist() {
    const id = itemSelecionado.id;
    if(biblioteca.watchlist[id]) delete biblioteca.watchlist[id];
    else biblioteca.watchlist[id] = itemSelecionado;
    salvarDados(); abrirModal(itemSelecionado); 
}

function definirEstrelas(nota, cliqueUsuario = true) {
    if(cliqueUsuario) estrelasAtivas = nota;
    const sps = document.getElementById('star-rating').children;
    for(let i=0; i<5; i++) {
        if(i < (cliqueUsuario ? estrelasAtivas : nota)) sps[i].classList.add('active');
        else sps[i].classList.remove('active');
    }
}

// ==========================================
// SISTEMA DE AUDITORIA E AVALIAÇÃO GLOBAL
// ==========================================
function salvarCritica() {
    if (!itemSelecionado) return;
    const nota = estrelasAtivas;
    const textoComentario = document.getElementById('review-text').value.trim();
    if (nota === 0) { alert("Selecione pelo menos 1 estrela."); return; }

    biblioteca.reviews[itemSelecionado.id] = { rating: nota, text: textoComentario };
    salvarDados(); 

    db.collection("avaliacoes_globais").add({
        userId: currentUserUID || "visitante_anonimo",
        usuario: perfilUsuario.username || "Operador Anónimo",
        conteudoId: itemSelecionado.id,
        titulo: itemSelecionado.title || itemSelecionado.name,
        categoria: itemSelecionado.custom_type,
        nota: nota,
        comentario: textoComentario,
        dataEnvio: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => { alert("Avaliação registrada globalmente no banco!"); })
    .catch((err) => { console.error(err); });
}

// ==========================================
// REPRODUTOR DE VÍDEO
// ==========================================
function abrirPlayerAtual(modo = 'geral') {
    if(!itemSelecionado) return;
    modoPlayerAtual = modo;
    const tipo = itemSelecionado.custom_type; 
    const modal = document.getElementById('playerModal');
    const epBox = document.getElementById('episodes-selectors-box');

    if (tipo === 'tv' && modo === 'especifico') { if(epBox) epBox.style.display = 'flex'; } 
    else { if(epBox) epBox.style.display = 'none'; }

    fecharModal(); atualizarIframePlayer();
    modal.style.display = 'flex';
    alternarScrollBody(true);
}

function atualizarIframePlayer() {
    if (!itemSelecionado) return;
    const id = itemSelecionado.id;
    const tipo = itemSelecionado.custom_type;
    const player = document.getElementById('videoPlayer');
    const corDestaque = "ff003c"; 

    if (tipo === 'movie') {
        player.src = `https://mgeb.top/embed/${id}?player=vidstack#color:${corDestaque}`; 
    } else {
        if (modoPlayerAtual === 'geral') {
            player.src = `https://mgeb.top/embed/${id}?player=vidstack#color:${corDestaque}`;
        } else {
            const season = document.getElementById('player-season-input').value || 1;
            const episode = document.getElementById('player-episode-input').value || 1;
            player.src = `https://mgeb.top/embed/${id}/${season}/${episode}?player=vidstack#color:${corDestaque}`; 
        }
    }
}

function fecharPlayer() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('videoPlayer').src = "";
    alternarScrollBody(false);
}

window.addEventListener('scroll', () => {
    if(window.innerWidth < 769) return;
    if(document.getElementById('search-results-section').style.display === 'block') return;
    
    const sections = ['homepage-content', 'row-movies-section', 'row-series-section', 'row-animes-section', 'row-cartoons-section', 'row-watchlist-section'];
    let current = '';
    sections.forEach(s => { const el = document.getElementById(s); if(el) { const rect = el.getBoundingClientRect(); if(rect.top <= 120) current = s; } });
    document.querySelectorAll('.nav-menu a').forEach(a => { a.classList.remove('active'); if(a.getAttribute('href') === `#${current}`) a.classList.add('active'); });
});

carregarDashboard();